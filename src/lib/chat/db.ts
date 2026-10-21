import { createClient, type Client, type InStatement } from "@libsql/client";
import { cached, invalidateCache } from "@/lib/catalog-cache";

/**
 * ที่เก็บประวัติแชทของ Web Agent — อยู่บน Turso (libSQL) แยกจาก Postgres หลัก
 *
 * ตั้งค่า CHAT_DATABASE_URL / CHAT_DATABASE_TOKEN ใน .env.local
 * ตารางถูกสร้างอัตโนมัติเมื่อใช้งานครั้งแรก (CREATE TABLE IF NOT EXISTS) จึงไม่ต้องรัน migration
 */

let client: Client | null = null;
let schemaReady: Promise<void> | null = null;

function getChatUrl(): string {
  const url = process.env.CHAT_DATABASE_URL;
  if (!url) throw new Error("CHAT_DATABASE_URL is not configured");
  return url;
}

export function getChatDb(): Client {
  if (!client) {
    client = createClient({
      url: getChatUrl(),
      authToken: process.env.CHAT_DATABASE_TOKEN || undefined,
    });
  }
  return client;
}

const DDL = [
  `create table if not exists chat_conversations (
     id text primary key,
     user_id text not null,
     title text not null default '',
     model text not null default '',
     created_at text not null,
     updated_at text not null,
     deleted_at text
   )`,
  `create index if not exists chat_conversations_user_idx
     on chat_conversations(user_id, updated_at desc)`,
  `create table if not exists chat_messages (
     id text primary key,
     conversation_id text not null,
     role text not null,
     content text not null default '',
     created_at text not null
   )`,
  `create index if not exists chat_messages_conv_idx
     on chat_messages(conversation_id, created_at)`,
  `create table if not exists chat_attachments (
     id text primary key,
     message_id text not null,
     name text not null default '',
     mime text not null default '',
     data_url text not null default ''
   )`,
  `create index if not exists chat_attachments_msg_idx
     on chat_attachments(message_id)`,
  `create table if not exists chat_settings (
     key text primary key,
     value text not null default ''
   )`,
  `create table if not exists chat_files (
     id text primary key,
     user_id text not null,
     conversation_id text not null default '',
     name text not null default '',
     kind text not null default 'html',
     content text not null default '',
     size_bytes integer not null default 0,
     share_url text,
     share_token text,
     share_expires_at text,
     created_at text not null
   )`,
  `create index if not exists chat_files_user_idx
     on chat_files(user_id, created_at desc)`,
  `create table if not exists image_jobs (
     id text primary key,
     user_id text not null,
     prompt text not null default '',
     model text not null default '',
     ratio text not null default '1:1',
     refs text not null default '[]',
     status text not null default 'queued',
     error text not null default '',
     created_at text not null
   )`,
  `create index if not exists image_jobs_user_idx
     on image_jobs(user_id, created_at desc)`,
];

/**
 * ตารางเก่าที่ CREATE TABLE IF NOT EXISTS แก้ให้ไม่ได้ — เพิ่มคอลัมน์ให้ฐานข้อมูลที่มีอยู่ก่อน
 * SQLite ไม่มี ADD COLUMN IF NOT EXISTS และ ALTER ใน batch เดียวจะ rollback ทั้งชุด
 * ถ้าคอลัมน์ใดมีอยู่แล้ว จึงต้องรันทีละคำสั่งและข้ามตัวที่ล้ม
 */
const ALTERS = [
  `alter table chat_conversations add column deleted_at text`,
  `alter table chat_files add column share_token text`,
  `alter table chat_files add column share_expires_at text`,
];

/** index ที่อ้างคอลัมน์ใหม่ — ต้องสร้างหลัง ALTER เท่านั้น */
const INDEXES = [
  `create index if not exists chat_files_share_token_idx
     on chat_files(share_token)`,
];

/** สร้างตารางทั้งหมดถ้ายังไม่มี — เรียกครั้งเดียวต่อ process */
export async function ensureChatSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getChatDb();
      // ส่งเป็น batch เดียว: Turso อยู่คนละเครื่อง แต่ละ statement คิดเป็น ~115ms
      // ถ้าไล่ส่งทีละคำสั่งอย่างเดิม = ค้าง ~2 วินาทีตอน request แรกหลัง server รีสตาร์ท
      await db.batch(DDL.map((stmt) => ({ sql: stmt })));
      for (const stmt of ALTERS) {
        try {
          await db.execute(stmt);
        } catch {
          /* คอลัมน์มีอยู่แล้ว */
        }
      }
      await db.batch(INDEXES.map((stmt) => ({ sql: stmt })));
    })().catch((err) => {
      // ให้ลองใหม่ในคำขอถัดไปถ้าล้ม
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChatAttachment = { name: string; mime: string; dataUrl: string };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments: ChatAttachment[];
  createdAt: string;
};

export type ChatConversation = {
  id: string;
  title: string;
  model: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatSettings = { maxAttachments: number };

export const DEFAULT_CHAT_SETTINGS: ChatSettings = { maxAttachments: 5 };

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

function rowToConversation(r: Record<string, unknown>): ChatConversation {
  return {
    id: String(r.id),
    title: String(r.title ?? ""),
    model: String(r.model ?? ""),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export async function listConversations(userId: string): Promise<ChatConversation[]> {
  await ensureChatSchema();
  const res = await getChatDb().execute({
    sql: `select id, title, model, created_at, updated_at
          from chat_conversations
          where user_id = ? and deleted_at is null
          order by updated_at desc`,
    args: [userId],
  });
  return res.rows.map((r) => rowToConversation(r as Record<string, unknown>));
}

export type ChatConversationWithMessages = ChatConversation & {
  messages: ChatMessage[];
  /** ไฟล์ที่เอเจนต์สร้างในห้องนี้ (ไม่มีเนื้อหา) — ใช้จับคู่ artifact ในข้อความกับปุ่มแชร์ */
  artifacts: ChatArtifactRef[];
};

export type ChatArtifactRef = {
  id: string;
  name: string;
  kind: string;
  sizeBytes: number;
  shareUrl: string | null;
  shareExpiresAt: string | null;
};

/**
 * อ่านห้องทั้งห้อง (ข้อความ + ไฟล์แนบ + artifact) ใน 1 รอบไป Turso
 *
 * เดิมไล่ query ไฟล์แนบทีละข้อความ = 1+N รอบ (วัดได้ ~107ms ต่อรอบบนเครื่องผู้ใช้
 * แชท 17 ข้อความจึงค้างเกือบ 2 วินาทีทั้งที่ตารางแนบไฟล์ว่างเปล่า)
 * batch() ส่งทุกคำสั่งใน request เดียว และการ left join ทำให้จำนวนรอบคงที่
 */
export async function getConversation(
  userId: string,
  id: string,
): Promise<ChatConversationWithMessages | null> {
  await ensureChatSchema();
  const rows = await getChatDb().batch([
    {
      sql: `select id, title, model, created_at, updated_at
            from chat_conversations where id = ? and user_id = ? and deleted_at is null`,
      args: [id, userId],
    },
    {
      sql: `select m.id, m.role, m.content, m.created_at, a.name, a.mime, a.data_url
            from chat_messages m
            left join chat_attachments a on a.message_id = m.id
            where m.conversation_id = ?
            order by m.created_at, m.rowid, a.rowid`,
      args: [id],
    },
    {
      sql: `select id, name, kind, size_bytes, share_url, share_expires_at
            from chat_files where conversation_id = ? order by created_at`,
      args: [id],
    },
  ]);

  const conv = rows[0];
  if (conv.rows.length === 0) return null;

  // จัดกลุ่มไฟล์แนบกลับเข้าข้อความเป็นลำดับเดิม (ข้อความเป็นตัวคุมลำดับ)
  const byMessage = new Map<string, ChatMessage>();
  for (const r of rows[1].rows) {
    const row = r as Record<string, unknown>;
    const msgId = String(row.id);
    let m = byMessage.get(msgId);
    if (!m) {
      m = {
        id: msgId,
        role: String(row.role) as ChatMessage["role"],
        content: String(row.content ?? ""),
        createdAt: String(row.created_at),
        attachments: [],
      };
      byMessage.set(msgId, m);
    }
    if (row.data_url != null) {
      m.attachments.push({
        name: String(row.name ?? ""),
        mime: String(row.mime ?? ""),
        dataUrl: String(row.data_url),
      });
    }
  }

  const artifacts: ChatArtifactRef[] = rows[2].rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      name: String(row.name ?? ""),
      kind: String(row.kind ?? "html"),
      sizeBytes: Number(row.size_bytes ?? 0),
      shareUrl: row.share_url ? String(row.share_url) : null,
      shareExpiresAt: row.share_expires_at ? String(row.share_expires_at) : null,
    };
  });

  return {
    ...rowToConversation(conv.rows[0] as Record<string, unknown>),
    messages: [...byMessage.values()],
    artifacts,
  };
}

export async function createConversation(input: {
  userId: string;
  title?: string;
  model?: string;
}): Promise<ChatConversation> {
  await ensureChatSchema();
  const now = new Date().toISOString();
  const conv: ChatConversation = {
    id: crypto.randomUUID(),
    title: input.title?.trim() || "",
    model: input.model || "",
    createdAt: now,
    updatedAt: now,
  };
  await getChatDb().execute({
    sql: `insert into chat_conversations (id, user_id, title, model, created_at, updated_at)
          values (?, ?, ?, ?, ?, ?)`,
    args: [conv.id, input.userId, conv.title, conv.model, conv.createdAt, conv.updatedAt],
  });
  return conv;
}

export async function updateConversation(
  userId: string,
  id: string,
  patch: { title?: string; model?: string },
): Promise<void> {
  await ensureChatSchema();
  const sets: string[] = [];
  const args: (string | number)[] = [];
  if (patch.title !== undefined) {
    sets.push("title = ?");
    args.push(patch.title);
  }
  if (patch.model !== undefined) {
    sets.push("model = ?");
    args.push(patch.model);
  }
  sets.push("updated_at = ?");
  args.push(new Date().toISOString());
  args.push(id, userId);
  await getChatDb().execute({
    sql: `update chat_conversations set ${sets.join(", ")} where id = ? and user_id = ?`,
    args,
  });
}

/**
 * ลบแบบ soft delete — ซ่อนห้องแชทจากผู้ใช้คนเดียว
 *
 * ข้อความ ไฟล์ และ attachment ยังอยู่ในฐานข้อมูลตามเดิม (ผู้ดูแลยังกู้คืนหรือ
 * ตรวจย้อนหลังได้) การลบของจริงต้องทำจากฝั่งผู้ดูแลเท่านั้น
 */
export async function deleteConversation(userId: string, id: string): Promise<void> {
  await ensureChatSchema();
  const db = getChatDb();
  await db.execute({
    sql: `update chat_conversations
          set deleted_at = ?
          where id = ? and user_id = ? and deleted_at is null`,
    args: [new Date().toISOString(), id, userId],
  });
}

/**
 * ลบถาวรห้องที่ผู้ใช้ลบไปแล้วและเก่ากว่ากำหนด — ให้ตัวจับเวลาเรียก
 *
 * soft delete ทำให้ห้องหายไปจากสายตาเจ้าของ แต่ข้อความ ไฟล์แนบ และ artifact
 * ยังกินดิสก์กับ bandwidth ของ Turso ตลอดไป จึงตัดตามรอบ (ครั้งละไม่เกิน 200 ห้อง
 * เพื่อไม่ให้ request ของ cron ยาวเกินจำเป็น)
 */
export async function purgeDeletedConversations(
  beforeIso: string,
): Promise<{ conversations: number; messages: number }> {
  await ensureChatSchema();
  const db = getChatDb();
  const found = await db.execute({
    sql: `select id from chat_conversations
          where deleted_at is not null and deleted_at < ? limit 200`,
    args: [beforeIso],
  });
  const ids = found.rows.map((r) => String(r.id));
  if (ids.length === 0) return { conversations: 0, messages: 0 };

  const marks = ids.map(() => "?").join(",");
  const counted = await db.execute({
    sql: `select count(*) as c from chat_messages where conversation_id in (${marks})`,
    args: ids,
  });

  // batch เดียว = one round trip + ทรานแซกชันเดียว ไม่มีห้องที่ถูกลบครึ่งเดียว
  await db.batch(
    [
      {
        sql: `delete from chat_attachments
              where message_id in (select id from chat_messages where conversation_id in (${marks}))`,
        args: ids,
      },
      { sql: `delete from chat_messages where conversation_id in (${marks})`, args: ids },
      { sql: `delete from chat_files where conversation_id in (${marks})`, args: ids },
      { sql: `delete from chat_conversations where id in (${marks})`, args: ids },
    ],
    "write",
  );

  return { conversations: ids.length, messages: Number(counted.rows[0]?.c ?? 0) };
}

/**
 * ตัดข้อความตั้งแต่ลำดับที่ `from` (0-based) จนถึงท้ายห้อง — ใช้ตอนผู้ใช้แก้คำถามแล้วส่งใหม่
 *
 * เรียงลำดับเดียวกับที่หน้า /c/<id> อ่านไปแสดง จึงคำนวณ index ฝั่ง client ได้ตรงกัน
 */
export async function deleteMessagesFromIndex(conversationId: string, from: number): Promise<number> {
  await ensureChatSchema();
  const db = getChatDb();
  const rows = await db.execute({
    sql: `select id from chat_messages where conversation_id = ? order by created_at, rowid`,
    args: [conversationId],
  });
  const ids = rows.rows.slice(Math.max(0, from)).map((r) => String((r as Record<string, unknown>).id));
  if (ids.length === 0) return 0;
  const marks = ids.map(() => "?").join(",");
  await db.batch([
    { sql: `delete from chat_attachments where message_id in (${marks})`, args: ids },
    { sql: `delete from chat_messages where conversation_id = ? and id in (${marks})`, args: [conversationId, ...ids] },
  ]);
  return ids.length;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function addMessage(input: {
  conversationId: string;
  role: ChatMessage["role"];
  content: string;
  attachments?: ChatAttachment[];
  /**
   * เวลาที่ข้อความนี้เริ่มเกิด (ค่าเริ่มต้น = ตอนบันทึก)
   *
   * ใช้กับคำตอบบางส่วนที่บันทึกหลังผู้ใช้กดหยุด: ผู้ใช้อาจส่งคำถามใหม่ไปแล้ว
   * ถ้าประทับเวลาตอนบันทึก คำตอบเก่าจะไปต่อท้ายคำถามใหม่และเรียงผิดในประวัติ
   */
  createdAt?: string;
}): Promise<ChatMessage> {
  await ensureChatSchema();
  const now = new Date().toISOString();
  const createdAt = input.createdAt ?? now;
  const msg: ChatMessage = {
    id: crypto.randomUUID(),
    role: input.role,
    content: input.content,
    attachments: input.attachments ?? [],
    createdAt,
  };
  // ข้อความ + ไฟล์แนบ + เลื่อน updated_at ของห้อง = request เดียว
  // (เดิมไล่ส่งทีละคำสั่ง ห้องที่มีรูปแนบจึงจ่ายค่ารอบละ ~107ms ฟรี ๆ ก่อนโมเดลจะเริ่มตอบ)
  const stmts: InStatement[] = [
    {
      sql: `insert into chat_messages (id, conversation_id, role, content, created_at)
            values (?, ?, ?, ?, ?)`,
      args: [msg.id, input.conversationId, msg.role, msg.content, createdAt],
    },
  ];
  for (const a of msg.attachments) {
    stmts.push({
      sql: `insert into chat_attachments (id, message_id, name, mime, data_url)
            values (?, ?, ?, ?, ?)`,
      args: [crypto.randomUUID(), msg.id, a.name, a.mime, a.dataUrl],
    });
  }
  stmts.push({
    sql: `update chat_conversations set updated_at = ? where id = ?`,
    args: [now, input.conversationId],
  });
  await getChatDb().batch(stmts);
  return msg;
}

// ---------------------------------------------------------------------------
// Settings (แอดมินตั้งค่าได้)
// ---------------------------------------------------------------------------
/** ค่าตั้งต้นทั้งระบบ (แอดมินแก้) — แคชไว้เพราะแต่ละ query ไป Turso ใช้เวลา ~375ms */
const SETTINGS_TTL_MS = 60_000;

export function getChatSettings(): Promise<ChatSettings> {
  return cached("chat-settings", SETTINGS_TTL_MS, loadChatSettings);
}

async function loadChatSettings(): Promise<ChatSettings> {
  await ensureChatSchema();
  const res = await getChatDb().execute({
    sql: `select key, value from chat_settings`,
  });
  const map = new Map<string, string>();
  for (const r of res.rows) {
    const row = r as Record<string, unknown>;
    map.set(String(row.key), String(row.value ?? ""));
  }
  const raw = Number(map.get("max_attachments"));
  return {
    maxAttachments:
      Number.isFinite(raw) && raw >= 1 ? Math.min(50, Math.floor(raw)) : DEFAULT_CHAT_SETTINGS.maxAttachments,
  };
}

export async function updateChatSettings(patch: Partial<ChatSettings>): Promise<void> {
  await ensureChatSchema();
  invalidateCache("chat-settings");
  const db = getChatDb();
  if (patch.maxAttachments !== undefined) {
    await db.execute({
      sql: `insert into chat_settings (key, value) values ('max_attachments', ?)
            on conflict(key) do update set value = excluded.value`,
      args: [String(patch.maxAttachments)],
    });
  }
}

// ---------------------------------------------------------------------------
// Files (คลังไฟล์ — ไฟล์ที่ AI สร้างให้ในแชท)
// ---------------------------------------------------------------------------

export type ChatFile = {
  id: string;
  conversationId: string;
  name: string;
  /** html | image | text */
  kind: string;
  content: string;
  sizeBytes: number;
  shareUrl: string | null;
  /** token สำหรับลิงก์ /s/<token> ที่เสิร์ฟเนื้อหาล่าสุดเสมอ */
  shareToken: string | null;
  shareExpiresAt: string | null;
  createdAt: string;
};

function rowToFile(r: Record<string, unknown>): ChatFile {
  return {
    id: String(r.id),
    conversationId: String(r.conversation_id ?? ""),
    name: String(r.name ?? ""),
    kind: String(r.kind ?? "html"),
    content: String(r.content ?? ""),
    sizeBytes: Number(r.size_bytes ?? 0),
    shareUrl: r.share_url ? String(r.share_url) : null,
    shareToken: r.share_token ? String(r.share_token) : null,
    shareExpiresAt: r.share_expires_at ? String(r.share_expires_at) : null,
    createdAt: String(r.created_at),
  };
}

export async function addFile(input: {
  userId: string;
  conversationId?: string;
  name: string;
  kind: string;
  content: string;
}): Promise<ChatFile> {
  const [file] = await addFiles([input]);
  return file;
}

/** เก็บหลายไฟล์ใน request เดียว — โมเดลหนึ่งรอบเขียน artifact พร้อมกันหลายไฟล์ได้ */
export async function addFiles(
  list: {
    userId: string;
    conversationId?: string;
    name: string;
    kind: string;
    content: string;
  }[],
): Promise<ChatFile[]> {
  await ensureChatSchema();
  const now = new Date().toISOString();
  const rows = list.map((input) => ({
    file: {
      id: crypto.randomUUID(),
      conversationId: input.conversationId ?? "",
      name: input.name,
      kind: input.kind,
      content: input.content,
      sizeBytes: new TextEncoder().encode(input.content).length,
      shareUrl: null as string | null,
      shareToken: null as string | null,
      shareExpiresAt: null as string | null,
      createdAt: now,
    } satisfies ChatFile,
    userId: input.userId,
  }));
  if (rows.length > 0) {
    await getChatDb().batch(
      rows.map(({ file, userId }) => ({
        sql: `insert into chat_files
                (id, user_id, conversation_id, name, kind, content, size_bytes, share_url, share_expires_at, created_at)
              values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          file.id,
          userId,
          file.conversationId,
          file.name,
          file.kind,
          file.content,
          file.sizeBytes,
          null,
          null,
          file.createdAt,
        ],
      })),
    );
  }
  return rows.map((r) => r.file);
}

export async function listFiles(userId: string): Promise<ChatFile[]> {
  await ensureChatSchema();
  const res = await getChatDb().execute({
    sql: `select id, conversation_id, name, kind, content, size_bytes, share_url, share_token, share_expires_at, created_at
          from chat_files where user_id = ? order by created_at desc`,
    args: [userId],
  });
  return res.rows.map((r) => rowToFile(r as Record<string, unknown>));
}

export async function getFile(userId: string, id: string): Promise<ChatFile | null> {
  await ensureChatSchema();
  const res = await getChatDb().execute({
    sql: `select id, conversation_id, name, kind, content, size_bytes, share_url, share_token, share_expires_at, created_at
          from chat_files where id = ? and user_id = ?`,
    args: [id, userId],
  });
  if (res.rows.length === 0) return null;
  return rowToFile(res.rows[0] as Record<string, unknown>);
}

export async function setFileShare(
  userId: string,
  id: string,
  share: { shareUrl: string; shareToken: string; shareExpiresAt: string },
): Promise<void> {
  await ensureChatSchema();
  await getChatDb().execute({
    sql: `update chat_files set share_url = ?, share_token = ?, share_expires_at = ? where id = ? and user_id = ?`,
    args: [share.shareUrl, share.shareToken, share.shareExpiresAt, id, userId],
  });
}

/** ไฟล์ที่แชร์สาธารณะ — ค้นด้วย token ที่สุ่มขึ้น ไม่ใช่ id ของไฟล์ */
export async function getFileByShareToken(token: string): Promise<ChatFile | null> {
  await ensureChatSchema();
  const res = await getChatDb().execute({
    sql: `select id, conversation_id, name, kind, content, size_bytes, share_url, share_token, share_expires_at, created_at
          from chat_files where share_token = ? limit 1`,
    args: [token],
  });
  if (res.rows.length === 0) return null;
  return rowToFile(res.rows[0] as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// งานสร้างรูปภาพ (คิวของผู้ใช้ — ตัวสร้างรูปจริงต่อเข้ากับ upstream ในขั้นถัดไป)
// ---------------------------------------------------------------------------

export type ImageJob = {
  id: string;
  prompt: string;
  model: string;
  ratio: string;
  /** ชื่อไฟล์อ้างอิงที่ผู้ใช้แนบมา (ไม่เก็บตัวไฟล์) */
  refs: string[];
  /** queued | done | failed */
  status: string;
  error: string;
  createdAt: string;
};

function rowToJob(r: Record<string, unknown>): ImageJob {
  let refs: string[] = [];
  try {
    const parsed = JSON.parse(String(r.refs ?? "[]"));
    if (Array.isArray(parsed)) refs = parsed.map((x) => String(x));
  } catch {
    /* ค่าเดิมไม่ใช่ JSON — ปล่อยเป็นว่าง */
  }
  return {
    id: String(r.id),
    prompt: String(r.prompt ?? ""),
    model: String(r.model ?? ""),
    ratio: String(r.ratio ?? "1:1"),
    refs,
    status: String(r.status ?? "queued"),
    error: String(r.error ?? ""),
    createdAt: String(r.created_at),
  };
}

export async function addImageJob(input: {
  userId: string;
  prompt: string;
  model: string;
  ratio: string;
  refs: string[];
}): Promise<ImageJob> {
  await ensureChatSchema();
  const job: ImageJob = {
    id: crypto.randomUUID(),
    prompt: input.prompt,
    model: input.model,
    ratio: input.ratio,
    refs: input.refs,
    status: "queued",
    error: "",
    createdAt: new Date().toISOString(),
  };
  await getChatDb().execute({
    sql: `insert into image_jobs (id, user_id, prompt, model, ratio, refs, status, error, created_at)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      job.id,
      input.userId,
      job.prompt,
      job.model,
      job.ratio,
      JSON.stringify(job.refs),
      job.status,
      job.error,
      job.createdAt,
    ],
  });
  return job;
}

export async function listImageJobs(userId: string, limit = 24): Promise<ImageJob[]> {
  await ensureChatSchema();
  const res = await getChatDb().execute({
    sql: `select id, prompt, model, ratio, refs, status, error, created_at
          from image_jobs where user_id = ? order by created_at desc limit ?`,
    args: [userId, limit],
  });
  return res.rows.map((r) => rowToJob(r as Record<string, unknown>));
}

export async function deleteImageJob(userId: string, id: string): Promise<void> {
  await ensureChatSchema();
  await getChatDb().execute({
    sql: `delete from image_jobs where id = ? and user_id = ?`,
    args: [id, userId],
  });
}