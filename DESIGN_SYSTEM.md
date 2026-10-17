# DESIGN_SYSTEM.md

> ข้อกำหนดการออกแบบอย่างเป็นทางการของ Octopus AI — ทุกหน้า/คอมโพเนนต์ที่สร้างต่อจากนี้ต้องเป็นไปตามไฟล์นี้
> แหล่งควบคุมฉบับเต็ม (hard bans / countable gate): `.zcode/skills/ui-ux-kit/SKILL.md` → "Pre-flight check"

---

## 1. Project overview

- **ชื่อผลิตภัณฑ์:** Octopus AI — One Gateway to Every AI
- **ประเภท:** เว็บแอป SaaS (landing + dashboard/admin ในโปรเจกต์เดียว)
- **Surface profile:** Landing/Marketing (`/`, `/signin`) + Dashboard/Admin (`/dashboard`, `/requests`, `/keys`, `/credits`, `/subscription`, `/admin/*`)
- **แพลตฟอร์ม:** web (responsive 390px → desktop)
- **กลุ่มเป้าหมาย:** นักพัฒนาไทย/ทีมที่ใช้โมเดล AI หลายค่ายในงาน production
- **เป้าหมายการออกแบบ:** เรียบหรู อ่านง่าย เร็ว และ "ไม่เหมือนงาน AI ทำ" — ใช้สีแบรนด์แบบยับยั้ง

## 2. Brand direction

- **สไตล์:** minimal-restrained developer tool (อ้างอิง Vercel/Linear)
- **อารมณ์:** นิ่ง แม่นยำ น่าเชื่อถือ
- **บุคลิก:** brutalist-technical ผ่อนลงเป็น instrumentation — เครื่องมือวัดที่แม่นยำ
- **คอนเซปต์ (Step 2.7):** "หน้าจอคือเครื่องมือวัดความแม่นยำ" — เส้นคั่นบาง ๆ ตลอด, ตัวเลขทุกตัวเป็น tabular mono, สีแบรนด์ indigo ใช้เป็น "สัญญาณ" ไม่ใช่ "ตกแต่ง", อนิเมชันมีเฉพาะเพื่อฟีดแบ็ก
- **Adversarial verdict:** ปิดชื่อแบรนด์แล้วยังอ่านออกว่าเป็น dev-tool instrumentation (เส้น hairline + tnum + โทนอินดิโก้ยับยั้ง) — จุดอ่อนที่เจอและแก้แล้ว: gradient text กับ blur ก้อนใหญ่ทำให้อ่านเป็น "AI slop" → ถอดออกทั้งหมด
- **References:** Vercel (ความยับยั้ง ตัวอักษรเป็นพระเอก), OpenRouter (hero กลางจอ + stat band), ai.thirx.com (signin จัดเรียบ), Linear (density)
- **Voice:** ภาษาไทยตรงไปตรงมา กริยานำ ("สร้างคีย์ใหม่" ไม่ใช่ "เริ่มต้น"), ตัวเลข/ชื่อโมเดลเป็นของจริงหรือกำกับว่า mock

## 3. Color system

| Role | Token | Hex | ใช้ที่ |
|---|---|---|---|
| 60% พื้นหลัก | `ink-950` | `#0B0F1A` | พื้นหน้าทุกหน้า |
| 30% ยกขึ้น | `ink-900` | `#111726` | section, sidebar, การ์ดรอบนอก, mockup frame |
| ยกขึ้นกว่า | `ink-850` | `#161E31` | การ์ด/แผงลอย (`.card`) |
| ข้อความหลัก | `fg` | `#E8ECF5` | หัวข้อ ค่าสำคัญ |
| ข้อความรอง | `fg-muted` | `#A9B4C7` | body, คำอธิบาย |
| เมทาดาทา | `fg-subtle` | `#8B97AD` | label เล็ก, caption (≥13px) |
| 10% Accent | `brand-500` | `#6366F1` | ปุ่มหลัก, จุด active, กราฟ |
| Accent อ่านง่าย | `brand-300` | `#B4BEFC` | ข้อความเน้นบนพื้นเข้ม |
| Accent สว่างสุด | `brand-200` | `#CBD2FE` | hover ของข้อความ accent |
| สถานะ | `leaf #34D399` / `amber-glow #FBBF24` / rose-500 / `aqua #22D3EE` / `pulse #A855F7` | — | สําเร็จ/รอ/ผิดพลาด/ข้อมูล/แอดมิน |
| สถานะ (ข้อความ) | `pulse-300 #C4B5FD` | — | ข้อความโทนแอดมินบนพื้นเข้ม — `pulse` เดิมได้แค่ 4.20:1 บน ink-850 (ไม่ผ่าน AA) จึงใช้ `pulse-300` (9.00:1) แทนทุกครั้งที่เป็นข้อความไอคอน |

**กติกา:**
- พื้น: แยกชั้นด้วย "ระดับสีพื้น" (950→900→850) + เงา บุคคลเดียว ไม่ใช้เส้นขอบเป็นตัวแยกการ์ด
- ข้อความ: ใช้ `text-fg/fg-muted/fg-subtle` เท่านั้น (คอนทราสต์ที่คํานวณแล้ว 16.17/9.15/6.49:1 บน ink-950, 14.04/7.94/5.64:1 บน ink-850 — ผ่าน AA ทุกคู่) **ห้าม slate-500/600/700**
- **ห้ามใช้สีบอกอันดับแบบลอยนอกพาเลต** (`slate`/`orange`) — อันดับ 1/2/3 ใช้ `amber-glow` → `aqua` → `brand-300` บนพื้น tint 15% ของสีเดียวกัน
- **ห้าม gradient ทุกกรณี** รวมถึงแถบสัดส่วน/แท่งกราฟ/ป้าย badge — ใช้สีทึบเดียวหรือ tint (`brand-500/60`)
- **ห้าม `blur-[..]` ขนาดใหญ่** — แสงเรืองใช้ `radial-gradient` นิ่ง หรือ tint + `ring-1 ring-inset`
- สถานะแอดมิน (pulse): พื้น `bg-pulse/[0.08]` + `ring-pulse/20` (ไม่ใช่ gradient ไล่สี), ข้อความ/ไอคอนใช้ `text-pulse-300`
- ปุ่ม: หลักพื้นทึบ `brand-500` hover `brand-600`; รองพื้น `white/[0.06]`
- เส้นคั่น (input/ตาราง/divider): `border-white/[0.07]` ค่าเดียวทั้งโปรเจกต์
- Focus ring: `ring-brand-400/70 ring-offset-ink-950` ผ่าน `:focus-visible` เท่านั้น

## 4. Typography system

- **บุคลิก:** brutalist-technical ผ่อนลง → grotesque + mono
- **ชุดฟอนต์ (3 ตัว):**
  - **Space Grotesk** (`--font-grotesk`) — ละติน heading + body
  - **IBM Plex Sans Thai** (`--font-thai`) — ภาษาไทยทั้งหมด
  - **JetBrains Mono** (`--font-mono`) — ตัวเลข/ชื่อโมเดล/โค้ด
  - ลําดับในสแตก: `var(--font-grotesk) → var(--font-thai) → system` (เบราว์เซอร์ไล่หาฟอนต์แรกที่มี glyph ของตัวอักษรนั้น)
- **เหตุผล:** Space Grotesk **ไม่มี glyph ไทยเลย** ถ้าไม่ประกาศฟอนต์ไทย ข้อความไทยจะตกไปใช้ฟอนต์ระบบ (Tahoma/Leelawadee) ซึ่งนํ้าหนัก/ความกว้างไม่ตรงกับละติน ทําให้ข้อความไทย-อังกฤษปนกันดูกระโดด. เลือก IBM Plex Sans Thai เพราะเป็น technical grotesque ชุดเดียวกับคอนเซปต์ "instrumentation" — จงใจไม่ใช้ Noto Sans Thai ซึ่งเป็นค่าตั้งต้นโดยไม่คิดของงานไทย (เทียบเท่า Inter ของงานละติน)
- **สเกล (นิยามใน tailwind.config.ts ครั้งเดียว ห้าม inline ขนาดเอง):**
  - `display` clamp(2.25 → 4.25rem) / 1.05 — ใช้เฉพาะ hero
  - `h1` clamp(1.875 → 2.75rem) / 1.15
  - `h2` clamp(1.5 → 2rem) / 1.25
  - `h3` 1.125rem / 1.4
  - `body-lg` 17px, `body` 16px (**ต่ำสุดของเนื้อหา**), `body-sm` 14px, `caption` 13px
  - `label` 11px — label ในปุ่ม/ตาราง/ตัวห้อย; `micro` 10px — เมทาดาทาเล็กสุด (badge, ป้ายสถานะ)
  - `stat` 26px — ตัวเลขหลักในการ์ดสถิติ (นิยามครั้งเดียว ห้าม inline `text-[26px]`)
  - **ห้าม `text-[Npx]` แบบลอย** — ทุกขนาดต้อง map กับขั้นในสเกลนี้ (เดิมมี 10/11/13px กระจัดกระจาย 76 จุด → ปรับเป็น token แล้ว)
- **ตัวเลขทุกตัวในตาราง/สถิติ:** คลาส `.tnum` (font-variant-numeric: tabular-nums + mono)
- **Mobile:** สเกล fluid ย่อเอง; ห้าม clip/truncate หัวข้อ

## 5. Layout system

- **Container:** `max-w-6xl px-6` (สาธารณะ) / `max-w-7xl` (แอป)
- **จังหวะ section:** landing py-24 สลับพื้น ink-900/50 ทุกสอง section; แอป space-y-6
- **ลำดับหน้าแรก:** nav → hero (กลางจอ) → product mockup → stat band → features (แถวเลขกำกับ ไม่ใช่ grid การ์ด) → models table → developer (sticky + โค้ด) → CTA → footer — ≥3 layout families
- **Hero:** centered editorial, สูง `min-h-[calc(100svh-4rem)]` จัดกลางสองแกน, headline ≤2 บรรทัด, ไม่ใช่ split
- **Nav sticky:** ใช้ `overflow-x-clip` (ไม่ใช่ hidden) บนตัวครอบหน้า — hidden ทำลาย sticky
- **CTA:** ปุ่มหลัก "เริ่มใช้งานด้วย Google" ซ้ำ 3 จุด (hero/mid/ท้าย) สไตล์เดียวกันทั้งหมด
- **แอป:** sidebar 64rem จอใหญ่ / drawer + ปุ่มลอยจอเล็ก; topbar สูง 4rem
- **Breakpoints:** 390 / 768 / 1280+

## 6. Component system

- **Base:** งานเองทั้งหมดบน Tailwind + semantic HTML (details/summary, form action) — ไม่มี UI library
- **Chart:** SVG เขียนเอง (`BarChart`) — แท่งสีเดียว (`brand-400` hover / `brand-500/32` ปกติ), grid จาง 5 เส้น, ป้ายสเกล, tooltip เป็นกล่องค่ามุมขวา (ไม่ลอย)
- **ปุ่ม:** `.btn-primary` / `.btn-secondary` / `.btn-quiet` / `.btn-danger` — สถานะครบ (hover/active:scale/disabled) นิยามใน globals.css
- **การ์ด:** `.card` = พื้น ink-850 + `shadow-raised` ไม่มีขอบ
- **Badge:** tone เดียวต่อความหมาย (leaf=สำเร็จ, amber=เตือน, pulse=แอดมิน, aqua=ข้อมูล)
- **Navbar:** `SiteNav` (โปร่ง → ทึบเมื่อ scroll > 12px), `SiteFooter` — ใช้ร่วมทุกหน้าสาธารณะ
- **ฟอร์ม:** `.input` ring-inset (ขอบจริงเพราะต้องเห็นขอบเขต), label บน, validate หลัง blur
- **Data view states:** ทุกตารางมี empty (`EmptyState` บอก action ถัดไป) + loading + error
- **สรุปการใช้งาน (`UsageSummaryCard`):** การ์ดเดียวใน Dashboard ที่แสดงโควต้า/เพดานของแผน — สลับ "เดือนนี้ / ทั้งหมด" ด้วย `.segmented`+`.chip-toggle` (แบบเดียวกับ `UsageChartCard`); โควต้าเป็นเรื่องของ usage ไม่กระจายไปหน้า โมเดล/เครดิต/Subscription
- **เมนูบัญชี (`Sidebar`):** การ์ดผู้ใช้ล่างแถบข้างเป็น dropdown (คลิกทั้งการ์ด) — `aria-haspopup="menu"`/`aria-expanded`, ปิดเมื่อคลิกนอก/Escape/เปลี่ยนหน้า; แสดงชื่อ+อีเมล+role และปุ่ม "ออกจากระบบ" ในแผง
- **Topbar:** ไม่มี badge บทบาทผู้ใช้ — สถานะบัญชีอยู่ในเมนู Sidebar; topbar เหลือ ทางลัด API Keys + เครดิตคงเหลือ

## 7. Card & section style

- **สไตล์:** borderless soft-elevation
- **Radius:** 3 ค่าเท่านั้น — `md` 8px (คอนโทรลเล็ก), `lg` 12px (การ์ด/ปุ่ม), `xl` 16px (แผงใหญ่)
- **เงา:** `raised` (การ์ด) / `floating` (แผง/modal) — tint ดำอมน้ำเงิน ไม่ใช้ glow สี
- **Gradients:** อนุญาตเฉพาะพื้นหลัง radial-gradient แบบนิ่ง (hero glow) ห้ามใช้กับข้อความ/ปุ่ม/แท่งกราฟ
- **Glassmorphism:** เฉพาะ sticky nav/topbar (`backdrop-blur-sm` แถบเดียว) — ห้ามใช้กับการ์ด
- **ไม่มี card-in-card**

## 8. Icon system

- **ไลบรารี:** FontAwesome 6 (solid + brands) ครอบคลุมทั้งโปรเจกต์ — ห้ามปนกับชุดอื่น
- **ขนาด:** 13px (ในบริบท), 10–11px (ประกอบข้อความ)
- **สี:** ตามบริบท text หรือ tone ของ Badge
- **ปุ่ม icon-only ต้องมี `aria-label`** (เช่น เปิดเมนู/ปิดเมนู/ออกจากระบบ)

## 9. Image & asset rules

- **โลโก้:** ไฟล์ผู้ใช้ `public/logo.png` (500×500 RGBA โปร่งใส) เรียกผ่าน `Logo.tsx` ด้วย next/image (กว้าง/สูงชัด — ไม่ shift) + favicon ผ่าน metadata
- **ภาพประกอบ:** ไม่ใช้รูปถ่าย — ใช้ div/SVG mock ที่สะท้อน UI จริง (`DashboardMock`) และกำกับว่าเป็นภาพจำลอง
- **ปุ่ม mock ที่กดไม่ได้:** ติด `disabled` + title อธิบาย (เช่น "เร็ว ๆ นี้")

## 10. Animation & interaction system

- **ไลบรารี:** CSS-only (keyframes ใน tailwind.config.ts) — ไม่มี GSAP/Framer
- **อนุญาตเฉพาะ:** `fade-up`/`fade-in` จบในตัว (400–500ms, ease-out) แห่งเดียวต่อการ์ด
- **ห้าม:** อนิเมชันวิ่งตลอดเวลา (ping/spin/aurora) และ animate ค่านอก transform/opacity — ข้อยกเว้นเดียว: `LiveUsagePanel` เปลี่ยน height ทุก 1.8s และ **ปิดเองเมื่อ `prefers-reduced-motion`**
- **Hover:** เปลี่ยนสีพื้นเท่านั้น (duration-fast) ไม่มี glow/ยกการ์ด
- **Async:** ปุ่มโชว์ spinner ตอนทำงาน, ผลลัพธ์ success/error เป็นแบนเนอร์ในการ์ด (จับคู่ไอคอน ไม่ใช่สีเดี่ยว)
- **Performance:** ไม่มี blur ก้อนใหญ่ (ใช้ radial-gradient นิ่ง), backdrop-blur เฉพาะแถบ sticky, `overflow-x-clip` รักษา sticky, วัดจริงได้ 60fps ไม่มีเฟรมหล่นและไม่มี long task ทุกหน้า; โลโก้ priority เฉพาะขนาดใหญ่

## 11. Accessibility rules

- คอนทราสต์คำนวณแล้วทุกคู่ (ดู §3) — ตรวจซ้ำด้วยสคริปต์เมื่อแก้สี
- `:focus-visible` ring ทุกองค์ประกอบอินเทอร์แอกทีฟ (ไม่โผล่ตอนคลิกเมาส์)
- `prefers-reduced-motion` ปิดอนิเมชันทั้งหมดแบบ global
- ตาราง/กราฟ: `aria-sort` เมื่อ sort, กราฟมี `role="img"` + aria-label สรุปค่า, ตัวเลขจัดชิดขวา
- สถานะไม่สื่อด้วยสีเดี่ยว — มีไอคอน/ข้อความประกอบเสมอ (StatusBadge)

## 12. Anti-AI-slop rules (เฉพาะโปรเจกต์นี้)

- **สีที่อนุญาต:** เฉพาะค่าใน §3 — อื่น ๆ ห้าม
- **ข้อยกเว้นที่ผู้ใช้อนุมัติ:** โทน indigo/purple ของแบรนด์อนุญาตเพราะเป็นแบรนด์บอร์ดของผู้ใช้เอง แต่ใช้แบบ "สัญญาณ ≤10%" ห้ามกลับไปเป็น gradient ราดเต็มหน้าหรือ gradient text
- **สิ่งที่ถอดออกแล้ว (ห้ามคืน):** gradient text (`background-clip:text`), aurora/conic border หมุน, sheen กวาดแสง, blur ก้อน 400–980px, backdrop-blur หลายชั้น, อนิเมชัน infinite, emoji เป็นไอคอนโครงสร้าง
- **ผล concept-test:** ผ่าน — จำเจอได้จาก hairline + tnum + indigo ยับยั้ง

## 13. Future page instructions

หน้าใหม่ทุกหน้าใช้สี/ฟอนต์/spacing/คอมโพเนนต์/ไอคอน/กฎอนิเมชันจากไฟล์นี้เท่านั้น ห้ามตั้งชุดภาพใหม่เอง เว้นแต่ผู้ใช้สั่งและอัปเดตไฟล์นี้ก่อน

## 14. Update policy

ถ้าแก้สี ฟอนต์ คอมโพเนนต์ อนิเมชัน หรือสไตล์การ์ด — อัปเดตไฟล์นี้ทันที (และ tailwind.config.ts ต้องเป็นค่าเดียวกันเสมอ)
