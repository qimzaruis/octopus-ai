/** คําแปลหน้าในแอป (ต้องล็อกอิน): sidebar, dashboard, keys, models, requests, credits, subscription */
export const appPages = {

  // ---------- ตัวอย่างใหม่ (dialog / เลือกมโมเดล / สร้ังรูป) ----------
  "ยืนยันการทำรายการนี้": "Confirm this action",
  "ยืนยัน": "Confirm",
  "ยกเลิก API Key": "Revoke API key",
  "ยกเลิกคีย": "Revoke key",
  "กลับ": "Back",
  "ตัวเลือกชัต": "Chat options",
  "แก้งชื่อแชท": "Rename chat",
  "ตั้งชื่อที่หาเจนได้ง่ายในปรวกศาอันแชท":
    "Pick a name that is easy to find in your chat history",
  "ชื่อแชท": "Chat name",
  "บันทึก": "Save",
  "ลบแชทนี้?": "Delete this chat?",
  "ข้อความและไฟล้วในแชทจะถืกลบตราม การกระทำนี้ย้อนกลับไม่ได้":
    "The messages and files in this chat will be permanently deleted. This cannot be undone.",
  "ลบแชทไม่ไปรยกต์": "Could not delete the chat",
  "แก้งชื่อแชทไม่ไปรยกต์": "Could not rename the chat",
  "ถามได้เลย": "Ask anything",
  "พิมพ้อข้อความ": "Type a message",
  "ส่งข้อความ": "Send message",
  "ระบบเลือกมโมเดลปลายทางให้เองแลคอย่างอัตเลขมี — เรียกชื่อเดียวได้ครบตัวั่น":
    "We pick the upstream model for you automatically — one name covers them all",
  "ดูรายละเอียด": "Details",
  "ราคา / 1M tokens (เข้า / ออก)": "Price / 1M tokens (input / output)",
  "ฝรี": "Free",
  "ความยางคอนเทคศ์": "Context length",
  "รับรูปภาพ": "Image input",
  "ข้อความเท่านั้น": "Text only",
  "Uptime วันนี้": "Uptime today",
  "หมดสถิติไม่ไปรยกต์": "Could not load statistics",
  "ยังไม่มีข้อมูล": "No data yet",
  "จำนวน request วันนี้": "Requests today",
  "Tokens ที่ใช้วันนี้": "Tokens used today",
  "อญิบรูปที่ต้องการ": "Describe the image you want",
  "ส่วนตุ่รรูปภาพ": "Aspect ratio",
  "ส่วนตุ {r}": "{r} ratio",
  "รูปอ้างอิง (ไม่บังคับ)": "Reference images (optional)",
  "แนบรูอ้าง": "Attach reference",
  "แนบรูป": "Add image",
  "แนบรูอ้างได้สูงสุด {n} รูป": "You can attach up to {n} reference images",
  "รับเฉพาะไฟล้หมหารูปภาพ: {name}": "Only image files are accepted: {name}",
  "ระบบกำลังต่อเชิมมโดเรญสร้างรูปภาพ — งานที่ส่งจะถืกเกบเว้นเครื่องและดำเนนนี่":
    "Image generation is being connected — submitted jobs are queued and listed here",
  "บันทึกเข้าคิวแล้ว — ระบบจะแสดงรูปทันที่สร้างเสร็จ":
    "Saved to the queue — the image will appear here once it is ready",
  "ส่งงานไม่ไปรยกต์ กรุณลองใหม่": "Could not submit the job. Please try again",
  "งานสร้างรูปของคุณ": "My image jobs",
  "{n} งาน": "{n} jobs",
  "ยังไม่มีงานสร้างรูป — พิมพ้อคำอธิบัยแล้วกดสร้างได้เลย":
    "No image jobs yet — describe what you want and press create",
  "ในคิว": "Queued",
  "{n} รูปอ้างอิง": "{n} reference images",
  "ตัวเลือกงาน": "Job options",
  "ลบงานนี้?": "Delete this job?",
  "รายการงานจะหายไปจากปรวกศาอัน การกระทำนี้ย้อนกลับไม่ได้":
    "The job entry will disappear from your history. This cannot be undone.",
  "ลบงานไม่ไปรยกต์": "Could not delete the job",
  'ยกเลิกคีย์ "{name}" ? การกระทำนี้ไม่สามารถย้อนกลับได้':
    'Revoke key "{name}"? This cannot be undone.',
  // ---------- Agent tools (web search + local workspace) ----------
  "เลือกโฟลเดอร์งานบนเครื่องของคุณ": "Pick a workspace folder on your computer",
  "เบราว์เซอร์นี้ยังไม่รองรับการเลือกโฟลเดอร์":
    "This browser cannot pick folders yet — use Chrome or Edge",
  "เลือกโฟลเดอร์งาน": "Pick workspace",
  "โฟลเดอร์งาน: {name}": "Workspace: {name}",
  "แปลงโค้ดที่วางเป็นไฟล์ {name} ให้แล้ว — พิมพ์คำถามสั้น ๆ ต่อได้เลย":
    "Pasted code was attached as {name} — now type a short question",
  "ตั้งค่าเครื่องมือเอเจนต์": "Agent tool settings",
  "การค้นหาเว็บ": "Web search",
  "ค้นหาจากเบราว์เซอร์ของคุณเอง คีย์เก็บอยู่ในเครื่องนี้ ไม่ส่งขึ้นเซิร์ฟเวอร์ของเรา":
    "Search runs in your browser. Keys stay on this device and never reach our server",
  "API key ของผู้ให้บริการที่เลือก": "API key for the selected provider",
  "โฟลเดอร์งาน": "Workspace",
  "เอเจนต์อ่านและแก้ไฟล์ได้ในโฟลเดอร์ {name}": "The agent can read and edit files in {name}",
  "ยังไม่ได้เลือก — เอเจนต์จะค้นหาเว็บได้อย่างเดียว":
    "Not selected yet — the agent can only search the web",
  "เปลี่ยนโฟลเดอร์": "Change folder",
  "เลือกโฟลเดอร์": "Choose folder",
  "ถอดการเชื่อมต่อ": "Disconnect",
  "เขียนไฟล์ได้ทันทีโดยไม่ต้องขออนุญาตทุกครั้ง": "Write files without asking every time",
  "การลบไฟล์จะขอยืนยันเสมอ": "Deleting always needs your confirmation",
  "อัตโนมัติ": "Automatic",
  "ลบไฟล์หรือโฟลเดอร์นี้?": "Delete this file or folder?",
  "สร้างโฟลเดอร์นี้?": "Create this folder?",
  "เขียนทับไฟล์นี้?": "Overwrite this file?",
  "สร้างไฟล์ใหม่?": "Create this file?",
  "ปฏิเสธ": "Deny",
  "อนุญาต": "Allow",
  "ลบเลย": "Delete it",
  "การลบย้อนกลับไม่ได้ — ถ้าเป็นโฟลเดอร์จะถูกลบทั้งโฟลเดอร์":
    "Deleting cannot be undone — a folder is removed together with everything inside",
  "เนื้อหาที่จะเขียน ({n} ตัวอักษร)": "Content to write ({n} characters)",
  "ค้นเว็บ": "Search the web",
  "ไลสต์ไฟล์": "List files",
  "ค้นในไฟล์": "Search inside files",
  "อ่านไฟล์": "Read file",
  "เขียนไฟล์": "Write file",
  "สร้างโฟลเดอร์": "Create folder",
  "ลบ": "Delete",
  "เอเจนต์ไม่ได้ตอบกลับมา": "The agent returned no answer",
  "ไม่ได้รับสิทธิ์เข้าถึงโฟลเดอร์นี้ เอเจนต์จะอ่านและแก้ไฟล์ไม่ได้":
    "Folder access was not granted — the agent cannot read or edit files",
  "ยังไม่มีสิทธิ์เข้าถึงโฟลเดอร์งาน — เอเจนต์จะอ่านและแก้ไฟล์ไม่ได้":
    "No workspace access yet — the agent cannot read or edit files",

  // ---------- Agent tools (round 2) ----------
  "เบราว์เซอร์นี้ยังไม่รองรับการเลือกโฟลเดอร์ (ใช้ Chrome หรือ Edge)":
    "This browser cannot pick folders — use Chrome or Edge",
  "การค้นเว็บใช้โควตาของระบบ (Google ผ่าน Bright Data) ไม่ต้องใส่คีย์ในเครื่องคุณ":
    "Web search uses the platform's quota (Google via Bright Data) — no key needed on your device",
  "เปิดดูในแท็บใหม่": "Open in a new tab",
  "เปิดดู": "Open",
  "คัดลอกโค้ด": "Copy code",
  "คำตอบถูกตัดเพราะยาวเกินจำกัด — ให้เอเจนต์เขียนต่อเป็นท่อน ๆ ได้":
    "The answer was cut off by the token limit — ask the agent to continue in smaller parts",
  "เขียนต่อท้ายไฟล์นี้?": "Append to this file?",

  // ---------- Agent message actions ----------
  "ขั้นตอนการทำงาน": "Working steps",
  "หยุด": "Stop",
  "หยุดแล้ว": "Stopped",
  "คัดลอกข้อความ": "Copy message",
  "แก้ไข": "Edit",
  "แก้ข้อความนี้แล้วส่งใหม่": "Edit and resend this message",
  "แก้ข้อความนี้": "Edit this message",
  "แก้ข้อความ": "Edited message",
  "กำลังแก้ข้อความนี้ — กดส่งเพื่อถามใหม่ คำตอบหลังจากนี้จะถูกลบ":
    "Editing this message — press send to ask again, later answers will be removed",
  "ยกเลิกการแก้": "Cancel editing",
  "แก้ข้อความแล้วกดส่ง": "Edit then press send",
  "ส่งใหม่": "Resend",
  "สร้างคำตอบใหม่": "Regenerate answer",
  "เล็มประวัติไม่สำเร็จ แต่จะส่งข้อความที่แก้ใหม่ไปแทน":
    "Could not trim the history, but the edited message will still be sent",
  "ข้อความและไฟล์ในแชทนี้จะหายไปจากประวัติของคุณ":
    "This chat's messages and files will disappear from your history",
  "ใช้เวลา {n} วิ": "Took {n}s",
  "{n} วิ": "{n}s",
  "{n} ขั้นตอน": "{n} steps",
  "กำลังคิด...": "Thinking...",
  "กระบวนการคิด": "Thought process",
  "ปิดการแจ้งเตือน": "Dismiss notice",
  "บทสนทนา": "Conversation",

  // ---------- Agent empty state ----------
  "มีอะไรให้ช่วย?": "What can I help with?",
  "ถาม ตัดโค้ด ค้นเว็บ หรือให้เอเจนต์ช่วยแก้ไฟล์ในเครื่อง — แนบไฟล์และรูปได้เลย":
    "Ask, write code, search the web, or let the agent edit files on your computer — attach files and images",
  "สร้างหน้าเว็บ": "Build a web page",
  "HTML/CSS หน้าเดียวที่เปิดดูได้ทันที":
    "A single HTML/CSS page you can open right away",
  "ช่วยสร้างหน้าเว็บ portfolio เรียบ ๆ สวย ๆ หนึ่งหน้าให้หน่อย":
    "Build me a clean and attractive one-page portfolio website",
  "ค้นเว็บและสรุป": "Search & summarize",
  "ข้อมูลล่าสุดพร้อมลิงก์อ้างอิง": "Fresh information with source links",
  "ช่วยค้นเว็บแล้วสรุปข่าว AI ล่าสุดให้ฟังหน่อย พร้อมลิงก์อ้างอิง":
    "Search the web and summarize the latest AI news with source links",
  "ช่วยเขียนโค้ด": "Write code",
  "อธิบายแนวคิดและเขียนให้พร้อมใช้": "Explained and ready to use",
  "ช่วยเขียนฟังก์ชัน TypeScript สำหรับเรียก API พร้อมจัดการ error ให้หน่อย":
    "Write a TypeScript function that calls an API and handles errors",
  "ร่างข้อความ": "Draft a message",
  "อีเมล ประกาศ หรือโพสต์โทนมืออาชีพ":
    "Emails, announcements, or professional posts",
  "ช่วยร่างอีเมลตอบลูกค้าที่แจ้งปัญหาการใช้งาน ให้สุภาพและกระชับ":
    "Draft a polite and concise reply to a customer reporting a problem",

  // ---------- Agent history ----------
  "วันนี้": "Today",
  "เมื่อวาน": "Yesterday",
  "7 วันล่าสุด": "Previous 7 days",
  "เก่ากว่า": "Older",
  "ค้นหาแชท": "Search chats",
  "ล้างคำค้น": "Clear search",
  "ไม่พบแชทที่ตรงกัน": "No matching chats",

  // ---------- Sidebar ----------
  "ผู้ดูแลระบบ": "Administrator",

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
  "ค้นหาจากโมเดล, agent หรือ route...":
    "Search by model, agent or route...",
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

  // ---------- รูป / หมวด / แอดมินโมเดล ----------
  "ไม่ระบุหมวด": "Uncategorized",
  "อื่น ๆ": "Other",
  "— ไม่มีรูป —": "— No image —",
  "— ไม่ใช้รูป —": "— No image —",
  "รูปเดิม": "Current image",
  "รูปของ {name}": "Image for {name}",
  "คลังรูป — ชื่อรูปคือชื่อหมวดของโมเดล":
    "Image library — the image name is the model category",
  "ชื่อรูป / ชื่อหมวด": "Image / category name",
  "ชื่อรูปจะถูกใช้เป็นชื่อหมวดของโมเดลอัตโนมัติ — ไม่ต้องสร้างหมวดแยก":
    "The image name becomes the model category automatically — no separate category needed",
  "ชื่อรูปจะกลายเป็นชื่อหมวดของโมเดลนี้":
    "The image name becomes this model's category",
  "รูป / หมวด": "Image / category",
  "เช่น Claude": "e.g. Claude",
  "{n} หมวด": "{n} categories",
  "{n} ปลายทาง": "{n} targets",
  "{n} route": "{n} routes",
  "สร้างโมเดล / Route ใหม่": "Create a model / route",
  "ชื่อที่ผู้ใช้เห็น": "Display name",
  "id ที่ใช้เรียก": "Callable id",
  "id ที่ใช้เรียก *": "Callable id *",
  "เปลี่ยนแล้วไคลเอนต์ที่เรียก id เดิมจะใช้ไม่ได้":
    "Clients still calling the old id will stop working",
  "ว่าง = ตั้งชื่อจาก id ให้อัตโนมัติ": "Leave empty to derive it from the id",
  "โมเดลปลายทางตัวแรก": "First target model",
  "— ยังไม่เพิ่มโมเดล —": "— No target yet —",
  "เพิ่ม fallback ลำดับถัดไปได้หลังสร้างเสร็จ":
    "You can add more fallbacks after creating it",
  "router — แสดงรายการเดียว": "router — one model entry",
  "model — กางโมเดลปลายทาง": "model — list target models",
  "โหมด router": "Router mode",
  "โหมด model": "Model mode",
  "ราคา In / Out (USD / 1M)": "Price In / Out (USD / 1M)",
  "ราคา In / Out": "Price In / Out",
  "ราคา input": "Input price",
  "ราคา output": "Output price",
  "เช่น Claude Haiku 5.5": "e.g. Claude Haiku 5.5",
  "เช่น claude-haiku-5-5": "e.g. claude-haiku-5-5",
  "แต่ละรายการคือโมเดลที่ผู้ใช้เรียกได้ — ตั้งชื่อ id รูป/หมวด ราคา และลําดับ fallback ได้จากที่นี่":
    "Each entry is a model users can call — set its name, id, image/category, price and fallback order here",

  // ---------- โมเดลที่ใช้ได้ (หน้า /models) ----------
  "คัดลอก": "Copy",
  "คัดลอกแล้ว": "Copied",
  "คัดลอก {value}": "Copy {value}",
  "ราคา / 1M tokens": "Price / 1M tokens",
  "รับรูปได้": "Accepts images",
  "คอนเท็กซ์": "context",
  "ต้องใช้แผน {plan} ขึ้นไป": "Requires {plan} plan or higher",
  "โมเดลปลายทางที่พร้อมให้บริการ ({n})": "Target models available ({n})",
  "หลัก": "Primary",
  "ค้นหาและกรองโมเดลที่บัญชีของคุณเรียกใช้ได้ พร้อมราคา uptime และ tokens ที่ใช้ไป":
    "Search and filter the models your account can call, with pricing, uptime and total tokens",
  "ค้นหาโมเดล, id หรือหมวด...": "Search models, id or category...",
  "ค้นหาโมเดล": "Search models",
  "ล้างคำค้นหา": "Clear search",
  "เรียงตาม": "Sort by",
  "ความนิยม (tokens รวม)": "Popularity (total tokens)",
  "ชื่อโมเดล": "Model name",
  "ราคาต่ำ → สูง": "Price low → high",
  "uptime สูงสุด": "Highest uptime",
  "ราคา": "Price",
  "กรองตามราคา": "Filter by price",
  "ฟรี": "Free",
  "แสดง {n} จาก {total} โมเดล": "Showing {n} of {total} models",
  "ไม่พบโมเดลที่ตรงกับตัวกรอง": "No models match these filters",
  "ลองเปลี่ยนคำค้นหา หมวด หรือช่วงราคา":
    "Try a different search, category or price range",
  "ยังไม่มี request วันนี้": "No requests today yet",
  "uptime วันนี้ · {n} requests": "Uptime today · {n} requests",
  "uptime —": "uptime —",
  "{n} tokens รวมทุกผู้ใช้ · {r} requests": "{n} tokens across all users · {r} requests",
  "ดูรายละเอียด {name}": "View details for {name}",

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
  "โควต้ารายวัน": "Daily quota",
  "แผนนี้ไม่ตั้งเพดานรายวัน": "This plan has no daily cap",
  "โควต้าของรอบนี้ใช้ครบแล้ว — ระบบจะไม่รีเซตตามรายวันจนกว่ารอบใหม่จะเริ่ม":
    "This cycle's quota is used up — daily limits will not reset it until a new cycle starts",
  "รอบบิลปัจจุบัน เทียบโควต้าของแผน": "Current billing cycle vs. plan quota",
  "/ รอบ {d} วัน": "/ {d}-day cycle",
  "เพดานรายวัน {v}": "Daily cap {v}",
  "ไม่จํากัดจํานวน requests": "Unlimited requests",
  "{n} requests / รอบ": "{n} requests / cycle",

  // ---------- บริการ (sidebar) ----------
  "บริการ": "Services",

// ---------- Web Agent (โหมดแชท) ----------
  "แชทใหม่": "New chat",
  "สร้างรูป": "Create image",
  "ประวัติแชท": "Chat history",
  "ยังไม่มีประวัติแชท": "No chat history yet",
  "ลบแชท": "Delete chat",
  "ขยายแถบข้าง": "Expand sidebar",
  "ย่อแถบข้าง": "Collapse sidebar",
  "เปิดเมนู": "Open menu",
  "กลับหน้าหลัก": "Back to home",
  "แชทกับ AI พร้อมแนบไฟล์และรูปภาพ": "Chat with AI — file and image attachments",
  "เริ่มบทสนทนากับ OctopusAI ได้เลย": "Start a conversation with the OctopusAI",
  "แนบไฟล์ได้สูงสุด {n} ไฟล์": "You can attach up to {n} files",
  "ไฟล์ใหญ่เกิน 10MB: {name}": "File is larger than 10MB: {name}",
  "อ่านไฟล์ไม่สำเร็จ: {name}": "Could not read the file: {name}",
  "เริ่มแชทไม่สำเร็จ ลองอีกครั้ง": "Could not start the chat — please try again",
  "โหลดประวัติแชทไม่สำเร็จ": "Could not load the chat history",
  "{n}/{max} ไฟล์": "{n}/{max} files",
  "แนบไฟล์ (สูงสุด {n})": "Attach file (up to {n})",
  "ยังเชื่อม CHAT_DATABASE_URL ไม่ได้ — ประวัติแชทจะไม่ถูกบันทึก":
    "Cannot reach CHAT_DATABASE_URL — chat history will not be saved",
  "OctopusAI อาจทําผิดพลาดได้ โปรดตรวจสอบข้อมูลสําคัญอีกครั้ง":
    "OctopusAI can make mistakes — please double-check important information",
  "ไปที่ Web Agent": "Go to Web Agent",
  "เลือกโมเดล": "Select model",
  "แอดมินต้องเปิดโมเดลให้ผู้ใช้เห็นก่อน จึงจะเริ่มแชทได้":
    "An admin must make at least one model visible to users before chatting",
  "แนบไฟล์": "Attach file",
  "แนบไฟล์จากคลิปบอร์ดแล้ว": "File attached from the clipboard",
  "ลบไฟล์": "Remove file",
  "ส่ง": "Send",
  "เกิดข้อผิดพลาด": "Something went wrong",
  "กําลังคิด...": "Thinking...",

  // ---------- สร้างรูปภาพ ----------
  "สร้างรูปภาพ": "Image generation",
  "สร้างภาพจากข้อความด้วยโมเดล AI": "Create images from text with an AI model",
  "ยังใช้ไม่ได้ในตอนนี้": "Not available yet",
  "ฟีเจอร์สร้างรูปภาพยังเปิดใช้งานไม่ได้": "Image generation is not available yet",
  "ระบบสร้างรูปภาพกําลังอยู่ระหว่างพัฒนา โปรดติดตามการอัปเดตถัดไป":
    "Image generation is under development — stay tuned for the next update",
  "อธิบายรูปที่ต้องการ...": "Describe the image you want...",
  "เช่น แมวส้มใส่ชุดอวกาศ สไตล์ภาพวาดน้ํามัน":
    "e.g. an orange cat in a spacesuit, oil painting style",
  "สร้าง": "Create",

  // ---------- คลังไฟล์ ----------
  "คลังไฟล์": "File library",
  "ไฟล์ที่ AI สร้างให้ในแชทของคุณ": "Files the AI created for you in your chats",
  "ยังไม่มีไฟล์ — ลองให้ AI สร้างหน้า HTML หรือ artifact ในแชท":
    "No files yet — ask the AI to build an HTML page or artifact in chat",
  "โหลดคลังไฟล์ไม่สำเร็จ": "Couldn't load the file library",
  "ดาวน์โหลดไม่สำเร็จ ลองอีกครั้ง": "Download failed — try again",
  "แชร์ไม่สำเร็จ ลองอีกครั้ง": "Share failed — try again",
  "แชร์ {name} แล้ว": "Shared {name}",
  "ยังหาไฟล์นี้ในคลังไม่เจอ — ลองใหม่อีกครั้ง":
    "Couldn't find this file in your library yet — try again",
  "แชร์เป็นลิงก์สาธารณะ": "Share as a public link",
  "ลิงก์สาธารณะถึง {date}": "Public link until {date}",
  "คัดลอกลิงก์": "Copy link",
  "คัดลอกลิงก์แล้ว": "Link copied",
  "คัดลอกลิงก์แชร์ไฟล์นี้": "Copy this file's share link",
  "แชร์": "Share",
  "เปิดลิงก์": "Open link",
  "ดาวน์โหลด": "Download",
  "กำลังโหลด...": "Loading...",
} as const;