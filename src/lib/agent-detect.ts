/**
 * ระบุว่า "ใคร" เป็นคนยิง request เข้ามา — ใช้เติมคอลัมน์ Agent ในประวัติการใช้งาน
 *
 * ไม่ให้ผู้ใช้เห็นคำว่า "api" ดิบ ๆ เพราะแยกไม่ออกว่าแอปไหนเรียก
 * ลำดับการตรวจ: header x-octopus-agent (client ตั้งเอง) → User-Agent ของ SDK/เครื่องมือ
 * ที่รู้จัก → เบราว์เซอร์ = "web" → ไม่รู้ที่มา = "other"
 */

/** รูปแบบใน User-Agent → ชื่อ agent ที่แสดง (เรียงจากเฉพาะเจาะจงไปทั่วไป) */
const RULES: Array<[RegExp, string]> = [
  [/claude[-_ ]?(code|cli)/i, "claude-code"],
  [/codex[_-]?cli|openai[_-]?codex/i, "codex"],
  [/opencode/i, "opencode"],
  [/zcode/i, "zcode"],
  [/\bzed\//i, "zcode"],
  [/hermes/i, "hermes"],
  [/cursor/i, "cursor"],
  [/windsurf|codeium/i, "windsurf"],
  [/aider/i, "aider"],
  [/\bcontinue\//i, "continue"],
  [/copilot|vscode|visual studio code/i, "copilot"],
  [/roo[-_ ]?code/i, "roo-code"],
  [/cline/i, "cline"],
  [/langchain|llama[_-]?index/i, "langchain"],
  [/openai\/python|python\/openai/i, "python-sdk"],
  [/openai\/node|node-openai/i, "node-sdk"],
  [/anthropic[-_]sdk/i, "anthropic-sdk"],
  [/postman/i, "postman"],
  [/insomnia/i, "insomnia"],
  [/^curl\//i, "curl"],
  [/\bcurl\//i, "curl"],
  [/^wget\//i, "wget"],
  [/python-requests|python-httpx|aiohttp|httpx/i, "python-sdk"],
  [/node(-|\.)|undici|got\/|axios\/|fetch\//i, "node-sdk"],
  [/go-http-client/i, "go-sdk"],
  [/okhttp/i, "android-app"],
  [/swift|darwin\//i, "ios-app"],
  [/(chrome|chromium|edg|firefox|safari|mozilla|opera)\//i, "web"],
];

/** ค่าจาก client เชื่อไม่ได้ทั้งหมด — กรองให้เหลือเฉพาะตัวอักษรที่ปลอดภัย */
function sanitize(value: string | null): string | null {
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return null;
  const clean = v.replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  return clean || null;
}

export function detectAgent(headers: Headers): string {
  return (
    sanitize(headers.get("x-octopus-agent")) ??
    sanitize(headers.get("x-app-name")) ??
    matchUserAgent(headers.get("user-agent")) ??
    "other"
  );
}

function matchUserAgent(ua: string | null): string | null {
  const value = (ua ?? "").trim();
  if (!value) return null;
  for (const [re, name] of RULES) if (re.test(value)) return name;
  // UA แปลก ๆ ที่ไม่อยู่ในลิสต์ — เอาคำแรกมาเป็นชื่อพอให้แยกออกว่าไม่ใช่เว็บ
  const first = sanitize(value.split(/[\s/]/)[0] ?? "");
  return first ? first.slice(0, 20) : null;
}
