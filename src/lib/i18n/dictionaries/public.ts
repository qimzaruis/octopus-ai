/** คําแปลหน้าสาธารณะ: landing, signin, banned, nav, footer */
export const publicPages = {
  // ---------- SiteNav ----------
  "เริ่มใช้งาน": "Get started",

  // ---------- Landing hero ----------
  "เชื่อมต่อได้แล้ววันนี้": "Available today",
  "ทางเข้าหนึ่งเดียว": "One gateway",
  "สู่ทุกโมเดล AI": "to every AI model",
  "เริ่มใช้งานด้วย Google": "Get started with Google",
  "ดูตัวอย่าง API": "See API example",
  "โหมด Demo — เข้าสู่ระบบเพื่อชมแดชบอร์ดพร้อมข้อมูลตัวอย่าง":
    "Demo mode — sign in to explore the dashboard with sample data",
  "เริ่มต้นฟรี ไม่ต้องใช้บัตรเครดิต": "Free to start — no credit card required",
  "Agent ที่รองรับ": "Supported agents",

  // ---------- Stats band ----------
  "โมเดลจากทุกค่าย": "models from every vendor",
  "Uptime ของ gateway": "gateway uptime",
  "Overhead ต่อ request": "overhead per request",
  "API keys ต่อบัญชี": "API keys per account",

  // ---------- Features ----------
  "ทุกอย่างที่ทีมต้องการ อยู่ในที่เดียว": "Everything your team needs, in one place",
  "เรียกทุกโมเดลผ่าน endpoint เดียวที่เข้ากันได้กับ OpenAI SDK — เปลี่ยนโมเดลโดยไม่ต้องแก้ code":
    "Call every model through one OpenAI-SDK-compatible endpoint — swap models without touching code",
  "ตั้งลําดับ fallback ได้เอง ระบบสลับโมเดลให้อัตโนมัติเมื่อเจอ rate limit หรือปลายทางล่ม":
    "Set your own fallback order; the system switches models automatically on rate limits or outages",
  "เห็นทุก request ละเอียดถึง token, latency, agent และสถานะ พร้อมกราฟรายชั่วโมงและรายวัน":
    "See every request down to token, latency, agent and status, with hourly and daily charts",
  "คีย์ของ provider เก็บฝั่ง server เท่านั้น คุณสร้างคีย์ของตัวเองได้สูงสุด 3 คีย์ และยกเลิกได้ทันที":
    "Provider keys stay server-side only. You can create up to 3 of your own keys and revoke them instantly",

  // ---------- Models table ----------
  "โมเดลยอดนิยม": "Popular models",
  "โมเดลระดับ frontier ของทุกแล็บใหญ่ เรียกได้ผ่าน endpoint เดียว":
    "Frontier models from every major lab, callable through a single endpoint",
  "ผู้พัฒนา": "Builder",
  "เหมาะกับ": "Best for",
  "ให้เหตุผลและงาน agent": "Reasoning and agent work",
  "เขียนโค้ดและวิเคราะห์ลึก": "Coding and deep analysis",
  "เอกสารยาวและมัลติโมดัล": "Long documents and multimodal",
  "ตอบเร็ว เกาะข้อมูลล่าสุด": "Fast answers on the latest data",
  "สมดุลระหว่างความเร็วกับต้นทุน": "Balance of speed and cost",
  "โอเพนเวต ปรับแต่งเองได้": "Open weights, fine-tunable",
  "และอีกหลายสิบโมเดลทั้งของค่ายใหญ่และโอเพนเวต — เพิ่มใหม่ได้ตลอดเวลา":
    "Plus dozens more, from big labs and open weights — add new ones anytime",
  "ทุกโมเดลที่เปิดใช้อยู่เรียกผ่าน API เดียวกัน": "Every live model is reachable through one API",

  // ---------- Developer section ----------
  "คุ้นเคยตั้งแต่บรรทัดแรก": "Familiar from the first line",
  "ไม่ต้องเรียน SDK ใหม่ ไม่ต้องรื้อ workflow — แค่เปลี่ยน base URL ใส่คีย์ แล้วยิง request แรกได้เลย":
    "No new SDK to learn, no workflow to rebuild — just change the base URL, add your key, and send your first request",
  "OpenAI-compatible chat completions": "OpenAI-compatible chat completions",
  "รองรับ streaming แบบเรียลไทม์": "Real-time streaming support",
  "Usage analytics และ metering ราย request": "Per-request usage analytics and metering",
  "Fallback อัตโนมัติเมื่อโมเดลใช้งานไม่ได้": "Automatic fallback when a model is unavailable",
  "รับ API key ของคุณ": "Get your API key",

  // ---------- Final CTA ----------
  "พร้อมให้ทุกโมเดลทํางาน": "Ready to put every model",
  "ให้คุณแล้วหรือยัง?": "to work for you?",
  "สมัครด้วยบัญชี Google แล้วสร้าง API key แรกของคุณได้ทันที":
    "Sign up with Google and create your first API key right away",
  "เข้าสู่ระบบด้วย Google": "Sign in with Google",
  "ดูเอกสาร API": "Read the API docs",

  // ---------- Sign in page ----------
  "แดชบอร์ดใช้งานแบบเรียลไทม์": "Real-time usage dashboard",
  "API key ของคุณเอง สูงสุด 3 คีย์": "Your own API keys, up to 3",
  "routing พร้อม fallback อัตโนมัติ": "Routing with automatic fallback",
  "ติดตาม token และค่าใช้จ่ายครบ": "Full token and cost tracking",
  "จัดการโมเดล คีย์ และค่าใช้จ่ายทั้งหมดของทีมคุณจากที่เดียว — เริ่มได้ภายในไม่กี่นาที ไม่ต้องตั้งโครงสร้างพื้นฐานเอง":
    "Manage your team's models, keys and costs from one place — live in minutes, with no infrastructure to run",
  "ใช้อีเมลองค์กรหรือบัญชี Google ของคุณก็ได้": "Use your work email or your Google account",
  "การยืนยันตัวตนไม่สําเร็จ กรุณาลองอีกครั้ง": "Authentication failed. Please try again",
  "เข้าสู่ระบบแสดงว่าคุณยอมรับข้อกําหนดการใช้งานและนโยบายความเป็นส่วนตัว":
    "By signing in you accept the terms of service and privacy policy",
  "โหมด Demo — ทดลองได้โดยไม่ต้องตั้งค่า Supabase":
    "Demo mode — try it without configuring Supabase",
  "ยังไม่มีบัญชี? การเข้าสู่ระบบด้วย Google จะสร้างบัญชีให้อัตโนมัติครั้งแรก":
    "No account yet? Signing in with Google creates one automatically on first use",

  // ---------- LoginForm ----------
  "เชื่อมต่อ Google ไม่สําเร็จ กรุณาลองใหม่": "Could not connect to Google. Please try again",
  "เกิดข้อผิดพลาดในการเข้าสู่ระบบ": "Something went wrong while signing in",
  "ดําเนินการต่อด้วย Google": "Continue with Google",
  "หรือทดลองใช้โหมด Demo": "or try demo mode",
  "เข้าสู่ระบบเป็นผู้ใช้ทั่วไป": "Sign in as a regular user",
  "เข้าสู่ระบบเป็นแอดมิน": "Sign in as admin",
  "ตั้งค่า": "Set",
  "ใน .env.local เพื่อเปิด Google Sign-in": "in .env.local to enable Google sign-in",

  // ---------- Banned page ----------
  "บัญชีถูกระงับ": "Account suspended",
  "บัญชีนี้ถูกระงับการใช้งานชั่วคราว หากคิดว่าเป็นความผิดพลาด กรุณาติดต่อทีมงานเพื่อตรวจสอบ":
    "This account has been temporarily suspended. If you believe this is a mistake, please contact the team to review it",
  "เหตุผล:": "Reason:",

  // ---------- Footer ----------
  "ทางเข้าหนึ่งเดียวสู่ทุกโมเดล AI — เชื่อมต่อ วิเคราะห์ และควบคุมได้จากที่เดียว":
    "One gateway to every AI model — connect, analyze and control from one place",
  "บัญชี": "Account",
  "ตั้งลำดับ fallback ได้เอง ระบบสลับโมเดลให้อัตโนมัติเมื่อเจอ rate limit หรือปลายทางล่ม": "Set your own fallback order; the system switches models automatically on rate limits or outages",
  "เชื่อมต่อ OpenAI, Claude, Gemini และอีกหลายสิบโมเดลผ่านแพลตฟอร์ม OctopusAI พร้อมแดชบอร์ดวิเคราะห์การใช้งาน และ OctopusRouter Free": "Connect OpenAI, Claude, Gemini and dozens more models through the OctopusAI platform, with a usage dashboard and OctopusRouter Free.",

  // ---------- Legal (terms / privacy / footer / signin checkbox) ----------
  "ข้อกําหนดการใช้งาน": "Terms of Service",
  "นโยบายความเป็นส่วนตัว": "Privacy Policy",
  "ฉันยอมรับ": "I accept the",
  "ติ๊กยอมรับข้อกําหนดเพื่อปลดล็อกการเข้าสู่ระบบ":
    "Tick to accept the terms and unlock sign-in",
  "ปรับปรุงล่าสุด: 17 ตุลาคม 2026": "Last updated: October 17, 2026",

  // ---------- หน้าข้อกําหนดการใช้งาน ----------
  "การยอมรับข้อกําหนด": "Acceptance of terms",
  "การเข้าถึงหรือใช้งาน Octopus AI ถือว่าคุณได้อ่าน เข้าใจ และตกลงผูกพันตามข้อกําหนดฉบับนี้ หากไม่เห็นด้วยกับข้อใด โปรดหยุดการใช้งาน":
    "By accessing or using Octopus AI you acknowledge that you have read and understood these terms and agree to be bound by them. If you disagree with any part, please stop using the service",
  "บัญชีผู้ใช้": "User accounts",
  "คุณเข้าสู่ระบบผ่านบัญชี Google ของตนเอง และรับผิดชอบในการรักษาความปลอดภัยของบัญชี รวมถึงกิจกรรมทั้งหมดที่เกิดขึ้นภายใต้บัญชี ห้ามมอบสิทธิ์การใช้งานให้ผู้อื่นในลักษณะที่อาจก่อความเสียหาย":
    "You sign in with your own Google account and are responsible for keeping it secure, including all activity under your account. Do not grant access to others in a way that could cause harm",
  "การใช้งานที่อนุญาต": "Permitted use",
  "บริการนี้มีไว้เพื่องานที่ชอบด้วยกฎหมาย ห้ามใช้เพื่อสร้างหรือเผยแพร่เนื้อหาที่ผิดกฎหมาย ละเมิดสิทธิ์ของผู้อื่น หรือโจมตีระบบคอมพิวเตอร์ ทางเราอาจกําหนดขีดจํากัดการใช้งาน (rate limit) เพื่อรักษาความเสถียรของบริการ":
    "The service is provided for lawful work only. Do not use it to create or distribute unlawful content, infringe others' rights, or attack computer systems. We may apply rate limits to keep the service stable",
  "API Key และการเชื่อมต่อ": "API keys and connections",
  "คุณสามารถสร้าง API key ของตัวเองได้สูงสุด 3 คีย์ต่อบัญชี และยกเลิกได้ทุกเมื่อ คีย์ของผู้ให้บริการโมเดล (provider) จะถูกเก็บฝั่ง server เท่านั้น หากพบว่าคีย์ของคุณรั่วไหล กรุณายกเลิกและสร้างคีย์ใหม่ทันที":
    "You can create up to 3 of your own API keys per account and revoke them at any time. Provider keys are stored server-side only. If your key is ever leaked, revoke it and create a new one immediately",
  "ค่าใช้จ่ายและเครดิต": "Usage and credits",
  "ปริมาณการใช้งานวัดเป็น token ตามที่แสดงในแดชบอร์ด ค่าใช้จ่ายคิดตามอัตราของโมเดลและ provider ที่ระบบ routing เลือกใช้ โดยมี fallback อัตโนมัติเมื่อปลายทางมีปัญหา":
    "Usage is measured in tokens as shown in the dashboard. Costs follow the rates of the model and provider the router picks, with automatic fallback when an endpoint fails",
  "ความพร้อมใช้งาน": "Service availability",
  "บริการให้ใช้งานในสภาพปัจจุบัน (as is) ระบบ fallback ช่วยลดผลกระทบจากปลายทางที่ล่ม แต่เราไม่รับประกันว่าบริการจะพร้อมใช้ต่อเนื่องปราศจากข้อผิดพลาด":
    "The service is provided as is. Automatic fallback reduces the impact of failing endpoints, but we do not guarantee uninterrupted or error-free availability",
  "การระงับและยกเลิกบัญชี": "Suspension and termination",
  "หากพบการใช้งานที่ละเมิดข้อกําหนดนี้ ทางเราอาจระงับหรือยกเลิกบัญชีโดยแจ้งให้ทราบ คุณสามารถหยุดใช้งานได้ทุกเมื่อโดยไม่ต้องแจ้งล่วงหน้า":
    "We may suspend or terminate accounts that violate these terms, with notice. You may stop using the service at any time without prior notice",
  "การเปลี่ยนแปลงข้อกําหนด": "Changes to these terms",
  "ข้อกําหนดนี้อาจได้รับการปรับปรุงเป็นระยะ ฉบับล่าสุดจะเผยแพร่บนหน้านี้เสมอ การใช้งานต่อเนื่องหลังมีการปรับปรุงถือว่าคุณยอมรับฉบับใหม่":
    "These terms may be updated from time to time. The latest version is always published on this page; continued use after an update means you accept the new version",
  "การติดต่อ": "Contact",
  "หากมีคําถามเกี่ยวกับข้อกําหนดการใช้งาน สามารถติดต่อทีมสนับสนุนได้ผ่านช่องทางในหน้าเว็บไซต์":
    "If you have questions about these terms, contact the support team through the channels on the website",

  // ---------- หน้านโยบายความเป็นส่วนตัว ----------
  "ข้อมูลที่เราเก็บ": "Data we collect",
  "ข้อมูลบัญชี: ชื่อ อีเมล และรูปโปรไฟล์ที่ได้จากการเข้าสู่ระบบด้วย Google":
    "Account data: your name, email and profile picture obtained from Google sign-in",
  "บันทึกการใช้งาน: โมเดลที่เรียกใช้ จํานวน token latency สถานะ และเวลาของแต่ละ request เพื่อแสดงสถิติและค่าใช้จ่ายในแดชบอร์ด":
    "Usage logs: the model called, token count, latency, status and time of each request, used to show usage statistics and costs in the dashboard",
  "เนื้อหาที่ส่งผ่านระบบ": "Content sent through the service",
  "ข้อความและไฟล์ที่คุณส่งจะถูกส่งต่อไปยังผู้ให้บริการโมเดล AI เพื่อประมวลผลตามคําขอของคุณ เนื้อหาดังกล่าวอาจถูกเก็บเป็นบันทึกชั่วคราวเพื่อการแก้ปัญหาเท่านั้น":
    "Messages and files you send are forwarded to AI model providers to process your request. Such content may be kept as temporary logs for troubleshooting only",
  "วิธีที่เราใช้ข้อมูล": "How we use data",
  "ใช้เพื่อให้บริการ routing คิดค่าใช้จ่าย แสดงสถิติการใช้งาน และป้องกันการใช้งานในทางทุจริต เราไม่ขายข้อมูลส่วนบุคคลของคุณให้บุคคลที่สาม":
    "Used to provide routing, compute costs, show usage statistics and prevent abuse. We never sell your personal data to third parties",
  "การแบ่งปันข้อมูล": "Data sharing",
  "ข้อมูลถูกส่งต่อเฉพาะผู้ให้บริการโมเดลที่จําเป็นต่อการประมวลผลคําขอของคุณ และหน่วยงานที่กฎหมายกําหนดเท่านั้น":
    "Data is shared only with the model providers needed to process your request, and with authorities where the law requires",
  "การเก็บรักษาและความปลอดภัย": "Retention and security",
  "เราเก็บข้อมูลเท่าที่จําเป็นต่อการให้บริการ คีย์และข้อมูลที่อ่อนไหวเก็บฝั่ง server แบบเข้ารหัส และจํากัดการเข้าถึงเฉพาะผู้ที่จําเป็น":
    "We keep data only as long as needed to run the service. Keys and sensitive data are stored encrypted server-side, with access limited to those who need it",
  "คุกกี้": "Cookies",
  "เว็บไซต์ใช้คุกกี้ที่จําเป็นเท่านั้น ได้แก่ session การเข้าสู่ระบบและการตั้งค่าภาษา ไม่มีคุกกี้โฆษณาหรือติดตามข้ามเว็บไซต์":
    "Only essential cookies are used: your sign-in session and language preference. No advertising or cross-site tracking cookies",
  "สิทธิ์ของคุณ": "Your rights",
  "คุณสามารถขอเข้าถึง ส่งออก หรือลบข้อมูลและบัญชีของคุณได้ โดยติดต่อทีมสนับสนุนผ่านช่องทางในหน้าเว็บไซต์":
    "You can request access to, export of, or deletion of your data and account by contacting the support team through the channels on the website",
  "การแจ้งเปลี่ยนแปลง": "Changes to this policy",
  "นโยบายนี้อาจได้รับการปรับปรุงเป็นระยะ ฉบับล่าสุดจะเผยแพร่บนหน้านี้เสมอ":
    "This policy may be updated from time to time. The latest version is always published on this page",
} as const;