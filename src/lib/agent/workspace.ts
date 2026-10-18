/**
 * โฟลเดอร์งานบนเครื่องผู้ใช้ (File System Access API)
 *
 * ทุกอย่างรันในเบราว์เซอร์ของผู้ใช้เท่านั้น — ไฟล์ไม่เคยถูกส่งขึ้นเซิร์ฟเวอร์ของเรา
 * เซิร์ฟเวอร์เห็นแค่ "ข้อความขอเรียกเครื่องมือ" กับ "ผลลัพธ์ที่โมเดลส่งกลับ"
 *
 * รองรับ Chrome / Edge เท่านั้น (Firefox กับ Safari ยังไม่มี showDirectoryPicker)
 * จึงมี canPickFolder() ให้ UI บอกผู้ใช้ชัดเจนแทนที่จะพังเงียบ ๆ
 */

const DB_NAME = "octopus-agent";
const DB_STORE = "kv";
const HANDLE_KEY = "workspace-dir";

/** โฟลเดอร์ที่มักทำให้การไลสต์รายการใหญ่เกินประโยชน์ */
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "out",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".cache",
  "__pycache__",
  ".venv",
  "venv",
  ".idea",
  ".vscode",
]);

/** อ่านไฟล์เป็นข้อความได้ไม่เกินนี้ — กันโมเดลดึงไฟล์ใหญ่เข้าคอนเท็กซ์จนล้น */
export const MAX_READ_BYTES = 200_000;

export type WorkspaceEntry = {
  path: string;
  kind: "file" | "dir";
  size: number;
};

export function canPickFolder(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

/** ผู้ใช้เลือกโฟลเดอร์งาน — คืน null เมื่อเขากดยกเลิก (NotAllowedError/AbortError) */
export async function pickWorkspaceFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!canPickFolder()) return null;
  try {
    const handle = await window.showDirectoryPicker!({
      id: "octopus-workspace",
      mode: "readwrite",
    });
    await rememberWorkspace(handle);
    return handle;
  } catch {
    return null;
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(DB_STORE)) req.result.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** DirectoryHandle clone เก็บใน IndexedDB ได้ ทำให้รีเฟรชแล้วยังใช้โฟลเดอร์เดิมต่อ */
async function setStoredHandle(handle: FileSystemDirectoryHandle | null): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      const store = tx.objectStore(DB_STORE);
      if (handle) store.put(handle, HANDLE_KEY);
      else store.delete(HANDLE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* โหมดส่วนตัว/เบราว์เซอร์เก่า — ไม่บังคับ */
  }
}

export async function rememberWorkspace(handle: FileSystemDirectoryHandle): Promise<void> {
  await setStoredHandle(handle);
}

export async function forgetWorkspace(): Promise<void> {
  await setStoredHandle(null);
}

export async function recallWorkspace(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDb();
    const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const req = tx.objectStore(DB_STORE).get(HANDLE_KEY);
      req.onsuccess = () => resolve((req.result as FileSystemDirectoryHandle) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return handle;
  } catch {
    return null;
  }
}

/**
 * ขออนุญาตอ่าน/เขียนจริง
 *
 * หลังรีเฟรชเบราว์เซอร์จะลดสิทธิ์ลงเป็น "prompt" เสมอ จึงต้อง requestPermission
 * ทุกครั้งที่เริ่มใช้ (เบราว์เซอร์จะถามผู้ใช้เฉพาะตอนที่จำเป็น)
 */
export async function grantWorkspaceAccess(
  handle: FileSystemDirectoryHandle,
  mode: "read" | "readwrite",
): Promise<boolean> {
  const withPermission = handle as FileSystemDirectoryHandle & {
    queryPermission?: (d: { mode: string }) => Promise<PermissionState>;
    requestPermission?: (d: { mode: string }) => Promise<PermissionState>;
  };
  if (!withPermission.queryPermission || !withPermission.requestPermission) return true;
  if ((await withPermission.queryPermission({ mode })) === "granted") return true;
  return (await withPermission.requestPermission({ mode })) === "granted";
}

/** ทำความสะอาด path จากโมเดล: ห้าม "..", ห้าม absolute, กัน backslash แบบ windows */
export function normalizeWorkspacePath(input: string): string {
  const cleaned = input
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "")
    .split("/")
    .filter((seg) => seg && seg !== ".")
    .filter((seg) => seg !== "..")
    .join("/");
  if (!cleaned) throw new Error("path is empty");
  return cleaned;
}

async function getDir(
  root: FileSystemDirectoryHandle,
  segments: string[],
  create: boolean,
): Promise<FileSystemDirectoryHandle> {
  let dir = root;
  for (const seg of segments) {
    dir = await dir.getDirectoryHandle(seg, { create });
  }
  return dir;
}

/** ไลสต์รายการใต้โฟลเดอร์ (ค่าเริ่มต้นไม่รวมโฟลเดอร์ย่อยลึกเกิน 2 ชั้น เพื่อความรวดเร็ว) */
export async function listWorkspace(
  root: FileSystemDirectoryHandle,
  sub = "",
  options: { depth?: number; limit?: number } = {},
): Promise<WorkspaceEntry[]> {
  const depth = options.depth ?? 2;
  const limit = options.limit ?? 400;
  const out: WorkspaceEntry[] = [];

  async function walk(dir: FileSystemDirectoryHandle, prefix: string, level: number) {
    for await (const [name, handle] of dir.entries()) {
      if (out.length >= limit) return;
      const path = prefix ? `${prefix}/${name}` : name;
      if (handle.kind === "directory") {
        if (IGNORED_DIRS.has(name)) continue;
        out.push({ path: `${path}/`, kind: "dir", size: 0 });
        if (level < depth) await walk(handle as FileSystemDirectoryHandle, path, level + 1);
      } else {
        const file = await (handle as FileSystemFileHandle).getFile();
        out.push({ path, kind: "file", size: file.size });
      }
    }
  }

  const start = sub && sub !== "." && sub !== "/" ? await getDir(root, normalizeWorkspacePath(sub).split("/"), false) : root;
  await walk(start, sub && sub !== "." ? normalizeWorkspacePath(sub) : "", 1);
  return out;
}

export async function readWorkspaceFile(
  root: FileSystemDirectoryHandle,
  path: string,
  maxBytes = MAX_READ_BYTES,
): Promise<string> {
  const segments = normalizeWorkspacePath(path).split("/");
  const name = segments.pop()!;
  const dir = segments.length ? await getDir(root, segments, false) : root;
  const handle = await dir.getFileHandle(name);
  const file = await handle.getFile();
  if (file.size > maxBytes) {
    const slice = await file.slice(0, maxBytes).text();
    return `${slice}\n\n[ไฟล์ถูกตัดเหลือ ${maxBytes} จาก ${file.size} ไบต์ — ใช้อ่านทีละส่วนหรือระบุช่วงบรรทัด]`;
  }
  return file.text();
}

/** มีไฟล์อยู่แล้วหรือยัง — ใช้บอกผู้ใช้ในกล่องยืนยันก่อนเขียนทับ */
export async function workspaceFileExists(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<boolean> {
  try {
    const segments = normalizeWorkspacePath(path).split("/");
    const name = segments.pop()!;
    const dir = segments.length ? await getDir(root, segments, false) : root;
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

/**
 * เขียนไฟล์ (สร้างโฟลเดอร์กลางทางให้ด้วย)
 *
 * mode=append ใช้ต่อท้ายไฟล์เดิม สำหรับตอนที่โมเดลเขียนโค้ดยาวเกินกว่าจะส่งมา
 * ครบใน tool_call เดียว — จะได้ไม่พังทั้งไฟล์
 */
export async function writeWorkspaceFile(
  root: FileSystemDirectoryHandle,
  path: string,
  content: string,
  mode: "write" | "append" = "write",
): Promise<{ path: string; mode: "created" | "overwrote" | "appended" }> {
  const segments = normalizeWorkspacePath(path).split("/");
  const name = segments.pop()!;
  const dir = segments.length ? await getDir(root, segments, true) : root;
  const handle = await dir.getFileHandle(name, { create: true });
  let body = content;
  let result: "created" | "overwrote" | "appended" = "created";
  try {
    const existing = await handle.getFile();
    result = mode === "append" ? "appended" : "overwrote";
    if (mode === "append") body = `${await existing.text()}${content}`;
  } catch {
    /* ไฟล์ยังไม่เคยมี */
  }
  const writable = await handle.createWritable();
  await writable.write(body);
  await writable.close();
  return { path: normalizeWorkspacePath(path), mode: result };
}

export async function makeWorkspaceDir(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<string> {
  const normalized = normalizeWorkspacePath(path);
  await getDir(root, normalized.split("/"), true);
  return normalized;
}

export async function removeWorkspaceEntry(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<string> {
  const segments = normalizeWorkspacePath(path).split("/");
  const name = segments.pop()!;
  const dir = segments.length ? await getDir(root, segments, false) : root;
  await dir.removeEntry(name, { recursive: true });
  return normalizeWorkspacePath(path);
}

/** ค้นข้อความในไฟล์ (grep แบบง่าย) — ใช้ตอนโมเดลหาว่าโค้ดอยู่ไฟล์ไหน */
export async function searchWorkspace(
  root: FileSystemDirectoryHandle,
  needle: string,
  options: { limit?: number; glob?: string } = {},
): Promise<{ path: string; line: number; text: string }[]> {
  const limit = options.limit ?? 40;
  const pattern = options.glob?.toLowerCase();
  const query = needle.toLowerCase();
  const hits: { path: string; line: number; text: string }[] = [];

  async function walk(dir: FileSystemDirectoryHandle, prefix: string) {
    for await (const [name, handle] of dir.entries()) {
      if (hits.length >= limit) return;
      const path = prefix ? `${prefix}/${name}` : name;
      if (handle.kind === "directory") {
        if (IGNORED_DIRS.has(name)) continue;
        await walk(handle as FileSystemDirectoryHandle, path);
        continue;
      }
      if (pattern && !path.toLowerCase().includes(pattern)) continue;
      const file = await (handle as FileSystemFileHandle).getFile();
      if (file.size > MAX_READ_BYTES) continue;
      const text = await file.text();
      if (!text.toLowerCase().includes(query)) continue;
      const lines = text.split("\n");
      for (let i = 0; i < lines.length && hits.length < limit; i += 1) {
        if (lines[i].toLowerCase().includes(query)) {
          hits.push({ path, line: i + 1, text: lines[i].trim().slice(0, 240) });
        }
      }
    }
  }

  await walk(root, "");
  return hits;
}
