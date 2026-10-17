# HANDOFF — Octopus AI (สำหรับ session ใหม่)

คัดลอกข้อความด้านล่างนี้ไปเปิด session ใหม่ได้เลย (มีฉบับเดียวกันนี้ในไฟล์ HANDOFF.md)

---

โปรเจกต์: **Octopus AI** — เว็บ AI Gateway (Next.js 14 App Router + TypeScript) ที่ `C:\Users\Administrator\Desktop\Ai-agent\octopus-ai`
Stack: Next.js 14 + Tailwind 3 + FontAwesome 6 + Drizzle ORM + Supabase (Postgres + Google OAuth ผ่าน @supabase/ssr) | Node 24, npm
คำสั่ง: `npm run dev` / `build` / `start` | DB: `npm run db:generate` / `db:push` / `db:seed`

## สิ่งที่ทำเสร็จแล้ว (อย่าทำซ้ำ)
- แอปครบ: landing `/`, `/signin` (ย้ายมาจาก /login แล้ว), auth routes (`/auth/callback|demo|signout`), shell มี sidebar+drawer มือถือ
- `/dashboard` (กราฟแท่ง hourly/7d/30d + อันดับโมเดล + requests ล่าสุด), `/requests` (ค้นหา/กรอง/แบ่งหน้า + modal รายละเอียด), `/keys` (จำกัด 3 คีย์ โชว์ครั้งเดียว), `/credits` (UI อย่างเดียว), `/admin` + `/admin/providers` + `/admin/routes` (จัด fallback priority)
- DB: schema 8 ตารางใน `src/db/schema.ts`, migration SQL แล้วที่ `supabase/migrations/`, seed script `src/db/seed.ts`
- โหมด Demo: `src/lib/config.ts` ตรวจ placeholder env (your_project/[PASSWORD]/REPLACE_ME) — ถ้า env จริงระบบสลับออกจาก demo เอง
- Design system ใหม่ตาม skill `.zcode/skills/ui-ux-kit` (ติดตั้งแล้ว ใช้ทุกครั้งที่แตะ UI — อ่าน SKILL.md + references/surface-rules.md + quality-floor.md ก่อน):
  - Token ทั้งหมดใน `tailwind.config.ts`: พื้น ink 3 ระดับ (950/900/850), ข้อความ `text-fg / fg-muted / fg-subtle` (คำนวณผ่าน AA ทุกพื้นแล้ว — **ห้ามใช้ slate-500**), radius 3 ขั้น (md/lg/xl), type scale แบบ fluid, motion tokens (duration-fast/base/slow)
  - ฟอนต์ Space Grotesk + JetBrains Mono (ตั้งใน `src/app/layout.tsx` + tailwind `--font-grotesk/--font-mono`)
  - กฎ: ห้าม gradient text, ห้าม border เป็นตัวแยกการ์ด (แยกด้วยพื้น+เงา `.card`), ห้ามอนิเมชันวิ่งตลอดเวลา, animate เฉพาะ transform/opacity, ตัวเลขใช้คลาส `.tnum`, เส้นคั่น `border-white/[0.07]`, ต้องมี focus-visible + prefers-reduced-motion
- Performance: ถอด aurora conic-animation, sheen, ping, blur ก้อนใหญ่ (เปลี่ยนเป็น radial-gradient ธรรมดา), ลด backdrop-blur เหลือจุดจำเป็น — วัดแล้ว 60fps ไม่มีเฟรมหล่นทุกหน้า
- Nav หน้าแรก sticky ตาม scroll แล้ว (จุดสำคัญ: ตัวครอบหน้าใช้ `overflow-x-clip` ไม่ใช่ `hidden` เพราะ hidden ทำลาย sticky)
- logo.png อยู่ที่ `public/logo.png` ใช้ใน `src/components/Logo.tsx` (next/image) + favicon แล้ว
- Build ผ่าน ✓ (landing/signin ตอบ 200)

## งานค้าง (ทำต่อจากนี้)
1. **[บล็อกหลัก] รหัสผ่าน DB ผิด**: ใน `.env.local` ผู้ใช้ใส่ค่าจริงแล้ว (Supabase project `hqtgbmkmbashxstrbqlf`, pooler `aws-0-ap-southeast-2`) แต่ต่อไม่ผ่านสักวิธี — ทุกแบบ (raw / encodeURIComponent / encode %) ได้ error Postgres `28P01 password authentication failed` ส่วน raw ได้ `URI malformed` (รหัสมีอักขระ `* % !`) → รหัสผ่านผิด ให้ผู้ใช้ reset รหัส DB ใน Supabase Dashboard แล้วแก้ `.env.local` (ถ้ามีอักขระพิเศษไม่ต้อง encode เอง — `src/db/index.ts` มี `normalizeDbUrl()` encode ให้อัตโนมัติแล้ว)
2. **สร้างตาราง**: หลัง DB ต่อได้ รัน `npm run db:push` แล้ว `npm run db:seed` (ตอนนี้ยังตรวจตารางไม่ได้เพราะ auth ไม่ผ่าน)
3. **เขียน `DESIGN_SYSTEM.md` ที่ root ตามข้อบังคับของ skill** (Step 5): ใช้ template `.zcode/skills/ui-ux-kit/references/DESIGN_SYSTEM.template.md` เติมค่าจริงทั้ง 14 sections (concept = "instrumentation ที่แม่นยำ", สี/ฟอนต์/radius ตามที่ระบุข้างบน)
4. **ตรวจสายตาหน้าแอปหลัง migrate**: requests / keys / credits / admin 3 หน้าถูกสคริปต์แทนคลาสใหม่แล้วแต่ยังไม่ได้ดูภาพจริง (ดูแล้วเฉพาะ landing/signin/dashboard) — ทำเมื่อ DB ใช้ได้แล้ว login ได้ (หรือลบค่า env ชั่วคราวเพื่อกลับ demo mode แล้วเข้า `/auth/demo?role=admin`)
5. (เผื่อ) `drizzle.config.ts` อ่าน DATABASE_URL ตรง ๆ ถ้าเจอ URI malformed ตอนรัน drizzle-kit ให้ encode รหัสผ่านใน env ตรง ๆ

## สิ่งที่ผู้ใช้ต้องการจากดีไซน์
เรียบหรู พรีเมียม ไม่เหมือนงาน AI ทำ, เน้นความเร็ว/ไม่กระตุก, nav ตาม scroll (เสร็จ), ใช้ logo.png (เสร็จ), โทนสีแบรนด์ Deep Ocean #0B0F1A + Indigo #6366F1/Purple #A855F7/Aqua #22D3EE (ใช้แบบยับยั้ง ไม่ราดเต็มหน้า)
