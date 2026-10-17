/** คําแปลหน้าในแอป (ต้องล็อกอิน): sidebar, dashboard, keys, models, requests, credits, subscription */
export const appPages = {
  // ---------- Sidebar ----------
  "ผู้ดูแลระบบ": "Administrator",
  "โหมด Demo — ข้อมูลตัวอย่าง": "Demo mode — sample data",

  // ---------- Dashboard ----------
  "สรุปการใช้งาน AI API ของคุณ — อัปเดตทุกครั้งที่เข้าหน้านี้":
    "A summary of your AI API usage — refreshed every time you open this page",
  "ประวัติทั้งหมด": "Full history",
  "จัดการ API Keys": "Manage API keys",
  "Requests วันนี้": "Requests today",
  "Tokens วันนี้": "Tokens today",
  "อัตราสําเร็จ": "Success rate",
  "อัตราสําเร็จรวม": "Overall success rate",
  "Latency เฉลี่ย": "Average latency",
  "โมเดลที่ใช้ได้": "Available models",
  "ยังไม่มีโมเดลที่เปิดให้ใช้": "No models enabled yet",
  "แอดมินจะเปิดโมเดลให้ผู้ใช้เห็นจากหน้า โมเดลที่แสดง":
    "An admin can enable models for users from the Models page",
  "{n} โมเดล": "{n} models",
  "อันดับโมเดลยอดนิยม": "Top models",
  "เรียงตาม tokens ที่ใช้ทั้งหมด": "Ranked by total tokens used",
  "Requests ล่าสุด": "Recent requests",
  "ยังไม่มีประวัติการเรียกใช้": "No request history yet",
  "สร้าง API key แล้วยิง request แรกของคุณ เพื่อดูสถิติที่นี่":
    "Create an API key and send your first request to see stats here",
  "สร้าง API key": "Create an API key",
  "รองรับรูปภาพ": "Supports images",
  "เทียบเมื่อวาน": "vs. yesterday",

  // ---------- Keys ----------
  "คีย์สําหรับเรียก Octopus API": "Keys for calling the Octopus API",
  "สร้างได้สูงสุด": "up to",
  "คีย์ต่อบัญชี": "keys per account",
  "สร้างคีย์ใหม่": "Create a new key",
  "สรุปการใช้งานจากทุกคีย์": "Usage across all keys",
  "Tokens รวม": "Total tokens",
  "คีย์ที่ใช้งานอยู่": "Active keys",
  "ยังไม่มีคีย์": "No keys yet",
  "สร้างคีย์แรกของคุณจากช่องด้านบน แล้วนําไปใช้เรียก Octopus API ได้ทันที":
    "Create your first key in the field above, then use it to call the Octopus API right away",
  "สร้าง:": "Created:",
  "ใช้ล่าสุด:": "Last used:",
  "ยังไม่เคยใช้": "Never used",
  "สร้างคีย์สําเร็จ — คัดลอกไปเก็บไว้เลย": "Key created — copy it now and store it safely",
  "คีย์เต็มจะแสดงเพียงครั้งเดียวเท่านั้น หากลืมจะต้องสร้างใหม่":
    "The full key is shown only once. If you lose it, you will need to create a new one",
  "ชื่อคีย์ เช่น Development, Production": "Key name, e.g. Development, Production",
  "การกระทํานี้ไม่สามารถย้อนกลับได้": "This action cannot be undone",
  "ยกเลิกคีย์": "Revoke key",

  // ---------- Models ----------
  "โมเดลทั้งหมดที่บัญชีของคุณเรียกใช้ได้ผ่าน Octopus API พร้อมราคาต่อ 1M tokens":
    "Every model your account can call through the Octopus API, with pricing per 1M tokens",
  "โมเดลทั้งหมด": "All models",
  "ราคาต่อ 1M tokens (USD) · เรียงตามชื่อ provider":
    "Price per 1M tokens (USD) · sorted by provider name",
  "ไม่รองรับ": "Not supported",
  "ใช้ไป (ของฉัน)": "Used (mine)",
  "ยังไม่ใช้": "Not used yet",
  "อยากเริ่มยิง request? ไปสร้างคีย์ที่หน้า":
    "Want to start sending requests? Create a key on the",
  "ดูเพดานการใช้งานและแผนที่หน้า": "See your limits and plan on the",

  // ---------- Requests ----------
  "ทุก request ที่เรียกผ่าน Octopus API — คลิกแถวเพื่อดูรายละเอียด":
    "Every request made through the Octopus API — click a row for details",
  "ค้นหาประวัติการเรียกใช้": "Search request history",
  "ค้นหาจากโมเดล, agent, route หรือ provider...":
    "Search by model, agent, route or provider...",
  "ไม่พบรายการที่ตรงกับเงื่อนไข": "No matching records",
  "ลองปรับคําค้นหา หรือล้างตัวกรองสถานะเพื่อดูรายการทั้งหมด":
    "Try adjusting your search, or clear the status filter to see everything",
  "ล้างตัวกรอง": "Clear filters",
  "Request ID": "Request ID",
  "Tokens (in/out)": "Tokens (in/out)",
  "เวลาที่เรียกใช้": "Requested at",
  "โมเดล (Model)": "Model",
  "Route / Public model": "Route / public model",

  // ---------- Credits ----------
  "ใช้เครดิตจ่ายค่าเรียกโมเดลตามอัตราที่แต่ละ provider กําหนด — คิดเป็น USD":
    "Credits pay for model calls at each provider's rates — billed in USD",
  "ใช้ไปแล้ว": "Used",
  "ในรอบนี้": "this cycle",
  "เครดิตหักตามการใช้งานจริง ไม่มีค่าสมาชิกรายเดือน และไม่มีวันหมดอายุ":
    "Credits are deducted by actual usage. No monthly fee, and they never expire",
  "เติมเครดิต": "Add credits",
  "เลือกจํานวนเงินที่ต้องการเติม (USD)": "Choose how much to add (USD)",
  "โบนัส": "bonus",
  "คุ้มที่สุด": "Best value",
  "ไม่รวมโบนัส": "No bonus",
  "เร็ว ๆ นี้": "Coming soon",
  "ระบบชําระเงินจะเปิดใช้งานเร็ว ๆ นี้": "Payments will be available soon",
  "ระบบเติมเครดิตยังไม่เปิดใช้งานในเวอร์ชันนี้ — ทีมงานกําลังเตรียมการชําระเงินผ่าน PromptPay และบัตรเครดิต":
    "Top-ups are not enabled in this version yet — the team is preparing payment via PromptPay and credit card",
  "ประวัติธุรกรรม": "Transaction history",
  "ยังไม่มีรายการธุรกรรม": "No transactions yet",
  "เมื่อคุณเติมเครดิตหรือแอดมินปรับเครดิต รายการจะแสดงที่นี่":
    "Top-ups and admin credit adjustments will appear here",
  "หักเครดิต": "Credit deducted",

  // ---------- Subscription ----------
  "เปรียบเทียบแผนและเพดานการใช้งาน — เปลี่ยนแผนเพื่อเพิ่มโควต้า requests และ tokens ต่อเดือน":
    "Compare plans and usage limits — upgrade to raise your monthly request and token quotas",
  "แผนปัจจุบัน:": "Current plan:",
  "แผนปัจจุบัน": "Current plan",
  "เครดิต/เดือน": "credits/month",
  "requests / เดือน": "requests / month",
  "tokens / เดือน": "tokens / month",
  "อัปเกรดเป็น Pro": "Upgrade to Pro",
  "การอัปเกรดแผนจะเปิดใช้งานเร็ว ๆ นี้": "Plan upgrades will be available soon",
  "ดูโมเดลที่เรียกใช้ได้และราคาต่อ 1M tokens ที่หน้า":
    "See available models and per-1M-token pricing on the",
  "เติมเครดิตได้ที่หน้า": "Add credits on the",
  "ใช้พร้อมกันได้ {n} โมเดล": "Up to {n} models at once",

  // ---------- UsageChartCard ----------
  "รายชั่วโมง (วันนี้)": "Hourly (today)",
  "รายวัน (7 วันล่าสุด)": "Daily (last 7 days)",
  "รายวัน (1 เดือนล่าสุด)": "Daily (last 30 days)",
  "ช่วงเวลาของกราฟ": "Chart time range",
  "7 วัน": "7 days",
  "30 วัน": "30 days",
  "ภาพรวมการใช้งาน": "Usage overview",

  // ---------- BarChart ----------
  "ค่าสูงสุด": "Peak",
  "กราฟแท่งแสดงจํานวน {metric} ตามช่วงเวลา": "Bar chart of {metric} over time",

  // ---------- UsageSummaryCard ----------
  "สะสมทั้งหมด": "All time",
  "ช่วงเวลาของสรุปการใช้งาน": "Usage summary period",
  "เพดาน {n}": "Limit {n}",
  "รอบเดือนนี้": "This billing cycle",
  "USD · หักตามใช้จริง": "USD · billed by actual usage",
  "Routing fallback {state}": "Routing fallback {state}",
  "เปิด": "on",
  "ปิด": "off",
  "— อัปเป็น Pro เพื่อให้ระบบสลับโมเดลอัตโนมัติเมื่อ provider ล่ม":
    "— upgrade to Pro for automatic model switching when a provider goes down",
  "รวมทุกการใช้งาน": "All-time usage",

  // ---------- QuotaBar ----------
  "ใช้ไป {n}%": "{n}% used",
  "ใช้ไป {n} เปอร์เซ็นต์": "{n} percent used",
  "ใช้ครบเพดานรอบนี้แล้ว": "Limit reached for this cycle",
  "ใกล้ถึงเพดานแล้ว": "Approaching the limit",

  // ---------- ToggleSwitch ----------
  "คลิกเพื่อปิด": "Click to disable",
  "คลิกเพื่อเปิด": "Click to enable",

  // ---------- LiveUsagePanel ----------
  "tokens / นาที": "tokens / min",
  "คีย์เก็บฝั่ง server": "Keys stay server-side",
  "fallback อัตโนมัติ": "Automatic fallback",

  // ---------- RankingList ----------
  "กรุณาเข้าสู่ระบบก่อน": "Please sign in first",
  "กรุณาตั้งชื่อคีย์ เช่น Development": "Please name the key, e.g. Development",
  "โมเดลเร็ว ราคาถูก เหมาะกับงานทั่วไป": "Fast, cheap model for general work",
  "โมเดลฉลาดพิเศษ สําหรับงานซับซ้อน": "Extra-smart model for complex work",
  "สนทนาทั่วไป ประหยัดสูงสุด": "General chat, most economical",
  "ยิง request ผิดนโยบายการใช้งาน": "Requests violating the usage policy",
  "สมชาย วงศ์ไทย": "Somchai Wongthai",
  "โมเดลฉลาดพิเศษ สำหรับงานซับซ้อน": "Extra-smart model for complex work",
  "ยังไม่มีการใช้งาน": "No usage yet",
  "รอบบิลเดือนนี้ เทียบเพดานของแผน": "This billing cycle, measured against your plan limits",
  "รวมทุกการใช้งานตั้งแต่เริ่มบัญชี": "All usage since the account was created",
  "เดือนนี้": "This month",
  "ทั้งหมด": "All",
  "8 รายการล่าสุดของคุณ": "8 of your latest requests",
  "{a}/{b} คีย์": "{a}/{b} keys",
  "คีย์สําหรับเรียก Octopus API — สร้างได้สูงสุด {n} คีย์ต่อบัญชี": "Keys for calling the Octopus API — up to {n} keys per account",
  "{n} requests / เดือน": "{n} requests / month",
  "{n} tokens / เดือน": "{n} tokens / month",
  "{n} รายการ": "{n} items",
  "จาก": "of",
  "หน้า": "Page",
  "{a} โมเดล · {b} provider": "{a} models · {b} providers",
  "{n} โมเดลพร้อมใช้กับบัญชีของคุณ": "{n} models available to your account",
  "สวัสดี {name}": "Hello {name}",
  "เครดิตคงเหลือ {v}": "Remaining credits {v}",
  "รวมทั้งหมด {n} requests · เทียบเมื่อวาน": "{n} requests total · vs. yesterday",
  "รวมทั้งหมด {n} tokens · เทียบเมื่อวาน": "{n} tokens total · vs. yesterday",
  "ผิดพลาด {e} จาก {n} requests": "{e} errors out of {n} requests",
  "{label} ใช้ไป {n} เปอร์เซ็นต์": "{label} is {n} percent used",
  "คุณมีคีย์ครบ {max} คีย์แล้ว — ยกเลิกคีย์เดิมก่อนจึงจะสร้างใหม่ได้": "You already have all {max} keys — revoke one before creating another",
  "ดู": "View",
  "แผน {plan}": "Plan {plan}",
  "ยิง request เดียว ถึงทุกโมเดล": "One request, every model",

  // ---------- Server actions ----------
  "กรุณาตั้งชื่อคีย์": "Please name the key",
  "ชื่อคีย์ยาวเกินไป (สูงสุด 40 ตัวอักษร)": "Key name is too long (max 40 characters)",
  "ไม่พบผู้ใช้": "User not found",
  "ไม่พบคีย์นี้": "Key not found",

  // ---------- โมเดลที่ใช้ได้ (หน้า /models) ----------
  "คัดลอก": "Copy",
  "คัดลอกแล้ว": "Copied",
  "คัดลอก {value}": "Copy {value}",
  "ราคา / 1M tokens": "Price / 1M tokens",
  "รับรูปได้": "Accepts images",
  "โมเดลปลายทางที่พร้อมให้บริการ ({n})": "Target models available ({n})",
  "หลัก": "Primary",

  // ---------- โควต้า USD ----------
  "รอบ {d} วันนี้ · เทียบโควต้าของแผน (USD)": "This {d}-day cycle · vs. plan quota (USD)",
  "รอบ {d} วันนี้": "{d}-day cycle",
  "รอบนี้": "This cycle",
  "ใช้ไปวันนี้": "Spent today",
  "โควต้าคงเหลือ": "Quota left",
  "เพดาน {v}": "Cap {v}",
  "ไม่จํากัดรายวัน": "No daily cap",
  "จาก {v}": "of {v}",
  "โควต้าต่อรอบ ({d} วัน)": "Cycle quota ({d} days)",
  "sub-quota รายวัน": "Daily sub-quota",
  "แผนนี้ไม่ตั้งเพดานรายวัน": "This plan has no daily cap",
  "โควต้าของรอบนี้ใช้ครบแล้ว — ระบบจะไม่รีเซตตามรายวันจนกว่ารอบใหม่จะเริ่ม":
    "This cycle's quota is used up — daily limits will not reset it until a new cycle starts",
  "รอบบิลปัจจุบัน เทียบโควต้าของแผน": "Current billing cycle vs. plan quota",
  "/ รอบ {d} วัน": "/ {d}-day cycle",
  "เพดานรายวัน {v}": "Daily cap {v}",
  "ไม่จํากัดจํานวน requests": "Unlimited requests",
  "{n} requests / รอบ": "{n} requests / cycle",
} as const;