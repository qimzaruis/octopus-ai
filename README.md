# 🐙 Octopus AI — One Gateway to Every AI

AI Gateway ที่รวมทุกโมเดล (OpenAI, Claude, Gemini, ...) ไว้ใน API เดียว พร้อม Dashboard
สรุปการใช้งาน, จัดการ API key, ระบบ Routing + Fallback และหน้า Admin สำหรับจัดการ
Providers / Models / Routes — จัดการแบบเดียวกับ FreeLLMAPI แต่เป็นเว็บแอปเต็มรูปแบบ

![Stack](https://img.shields.io/badge/Next.js-14-black) ![Tailwind](https://img.shields.io/badge/Tailwind-3-38bdf8) ![Drizzle](https://img.shields.io/badge/Drizzle_ORM-Postgres-green) ![Supabase](https://img.shields.io/badge/Auth-Supabase_Google-3ecf8e)

## 🎨 ดีไซน์และ UX

- **ธีม**: สีแบรนด์ Octopus — Deep Ocean `#0B0F1A` + Indigo `#6366F1` / Purple `#A855F7` / Aqua `#22D3EE`
- **ฟอนต์**: Inter (UI) + JetBrains Mono (โค้ดและตัวเลขโมเดล)
- **Landing page**: hero กลางจอ + mockup แดชบอร์ด, stat band, ตารางโมเดล, ส่วนนักพัฒนาพร้อมการ์ดโค้ดสลับ Python/cURL, CTA ในกรอบ gradient และ footer แบบ 3 คอลัมน์
- **หน้า `/signin`**: split screen (แบรนด์ซ้าย / ฟอร์มขวา) — เส้นขอบเรืองแสงหมุนได้ (`aurora-border`), แสงกวาดผ่านการ์ด (`sheen`), แผง Live throughput ที่แท่งกราฟขยับทุก 1.6 วินาที (ปิดอัตโนมัติเมื่อผู้ใช้ตั้ง reduced-motion)
- **Nav/Footer ร่วม**: `SiteNav` โปร่งแสงแล้วทึบขึ้นเมื่อ scroll พร้อมเมนูมือถือ และลิงก์ section แบบ hash ที่พากลับหน้าแรกอัตโนมัติถ้าอยู่หน้าอื่น
- **ในแอป**: sidebar แบบ sticky (มือถือเป็น drawer + ปุ่มลอย), topbar โปร่งแสง, การ์ดสถิติมี delta เทียบเมื่อวาน, กราฟแท่งโต้ตอบได้ (hover ดูค่า / สลับ requests–tokens), empty state ที่บอกขั้นตอนถัดไป
- **คุณภาพที่ใส่ไว้**: โฟกัสรองรับคีย์บอร์ด (`:focus-visible`), `aria-*` ในกราฟและเมนู, รองรับ `prefers-reduced-motion`, layout responsive ตั้งแต่ 390px ถึงจอใหญ่
- **UI primitives ที่ใช้ซ้ำ**: `Badge`, `StatCard`, `PageHeader`, `SectionHeading`, `Eyebrow`, `EmptyState`, `ToggleSwitch`, `ConfirmButton`

## ✨ ฟีเจอร์

### หน้าบ้าน (Landing)
- Hero ธีมแบรนด์ + ปุ่ม **เริ่มใช้งานด้วย Google** (Supabase OAuth)
- Mockup แดชบอร์ด, ตารางโมเดลยอดนิยม, การ์ดโค้ด API, ส่วนความสามารถ และ CTA ท้ายหน้า

### User Dashboard (`/dashboard`)
- กราฟแท่งการใช้งาน สลับได้ 3 ช่วงเวลา: **รายชั่วโมง (วันนี้)** / **รายวัน 7 วัน** / **รายวัน 1 เดือน**
  และสลับ metric ได้ระหว่าง Requests / Tokens
- การ์ดสรุป: requests วันนี้, tokens วันนี้, latency เฉลี่ย, อัตราสำเร็จ
- **อันดับโมเดล** — ใช้ไปกี่ token / กี่ request เรียงตาม tokens รวม
- **Requests ล่าสุด** — เวลา, โมเดล, agent, status, latency, tokens

### Landing + เข้าสู่ระบบ (`/`, `/signin`)
- Landing page ธีมแบรนด์: hero + mockup แดชบอร์ด, stat band, ตารางโมเดล, การ์ดโค้ด และ CTA
- หน้า **`/signin`** แบบ split screen — ฝั่งซ้ายเล่าแบรนด์พร้อมแผงการใช้งานจำลองที่ขยับได้จริง
  ฝั่งขวาฟอร์มในการ์ดเส้นขอบเรืองแสง (aurora)
- **Nav และ Footer เป็นคอมโพเนนต์ร่วม** (`SiteNav`, `SiteFooter`) ใช้ชุดเดียวกันทุกหน้าสาธารณะ
- เข้าสู่ระบบด้วย **Google ผ่าน Supabase** (`/auth/callback`)

### ประวัติการเรียกใช้ (`/requests`)
- ค้นหา + กรองตามสถานะ + แบ่งหน้า
- คลิกแถวเพื่อดู **รายละเอียดเต็ม** — agent, route, provider, latency, input/output tokens, error

### API Keys (`/keys`)
- สร้าง/ยกเลิก key ของตัวเอง **สูงสุด 3 คีย์ต่อบัญชี** (บังคับทั้งฝั่ง UI และ server action)
- โชว์คีย์เต็มครั้งเดียวตอนสร้าง พร้อมปุ่มคัดลอก

### เครดิต (`/credits`)
- หน้าเติมเครดิต (UI อย่างเดียว — ระบบชำระเงินยังไม่เปิดใช้ตามที่กำหนด)

### Admin (`/admin`) — เมนูขึ้นเฉพาะผู้ใช้ role `admin`
- **สรุปการใช้งานรวม** — ทุกโมเดลใช้ไปกี่ token/กี่ req + ตารางอันดับ + กราฟภาพรวมทุก user
- **Providers & Models** — เพิ่ม/แก้ไข provider (base url, key), เพิ่ม/ลบ/เปิด-ปิดโมเดล
- **Routing** — สร้าง route (เช่น `octopus-pro`) + เพิ่มโมเดลปลายทาง + **จัดลำดับ fallback**
  (เลื่อนขึ้น/ลง, เปิด-ปิด, ลบ) เหมือนระบบของ FreeLLMAPI

## 🧰 Tech Stack

| ส่วน | ใช้อะไร |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Actions, React 19, Turbopack) |
| Styling | Tailwind CSS 3 + FontAwesome 6 |
| DB / ORM | Drizzle ORM + Postgres (Supabase) |
| Auth | Supabase Auth — **Google Sign-in** (`@supabase/ssr`) |
| Deploy target | Vercel / Node 20+ |

## 🚀 เริ่มใช้งานแบบเร็ว

```bash
npm install
cp .env.example .env.local     # แล้วเติมค่า Supabase + DATABASE_URL ให้ครบ
npm run dev
```

เปิด http://localhost:3000 → กด "เริ่มใช้งาน" → เข้าสู่ระบบด้วย Google
(Dashboard/ประวัติ/Keys/Admin อ่านจาก Supabase + Postgres เสมอ — ดูหัวข้อถัดไป)

ตั้งค่า env ไม่ครบ → หน้าที่ต้องล็อกอินจะฟ้องว่าต่อฐานข้อมูลไม่ได้ ไม่ได้แสดงตัวเลขปลอมให้ดู

## 🔧 ตั้งค่าของจริงด้วย Supabase

### 1) สร้างโปรเจกต์ Supabase
สร้างโปรเจกต์ที่ [supabase.com](https://supabase.com) แล้ว copy ค่าจาก
**Project Settings → API**: `Project URL`, `anon key`, `service_role key`

### 2) เปิด Google Sign-in ใน Supabase
1. ไปที่ **Authentication → Providers → Google** แล้วเปิด Enable
2. สร้าง OAuth Client ที่ [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
3. นำ Client ID / Client Secret มาใส่ในหน้า provider ของ Supabase
4. ที่ **Authentication → URL Configuration** ตั้ง **Site URL** และ **Redirect URLs**
   ให้ตรงกับโดเมนที่จะใช้งานจริง มิฉะนั้น login ด้วย Google เสร็จแล้ว Supabase จะ
   เด้งกลับไป Site URL (เช่นกลับไป `localhost:3000` ทั้งที่เปิดจากโดเมนจริง)

   | สภาพแวดล้อม | Site URL | Additional Redirect URLs |
   | --- | --- | --- |
   | dev ในเครื่อง | `http://localhost:3000` | `http://localhost:3000/**` |
   | production | `https://octopus-ai.isdev.dpdns.org` | `https://octopus-ai.isdev.dpdns.org/**` |

   ตั้งได้ทั้งสองค่าพร้อมกัน (ใส่ `http://localhost:3000/**` ไว้ในรายการ redirect ด้วย
   แอปส่ง `redirectTo` เป็น origin ของหน้าที่เปิดอยู่
   ดังนั้นโดเมนที่ไม่อยู่ในรายการนี้จะถูกดีดกลับไป Site URL

### 3) ต่อฐานข้อมูล
Copy **Connection string (URI)** จาก Project Settings → Database (แนะนำแบบ pooler port 6543)

### 4) สร้างไฟล์ `.env.local`

```env
# โหมดการทํางาน: development = เครื่อง dev | production = ของจริงบน host
APP_ENV=development

NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
DATABASE_URL=postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY   # ใช้ตอน seed
```

> มีไฟล์ตัวอย่างที่ `.env.example`
> - ทุกหน้าอ่านจาก Supabase + Postgres เสมอ — แอปไม่มีโหมดข้อมูลปลอม
> - ตั้ง env ไม่ครบ → หน้าที่ต้องล็อกอินจะฟ้องว่าต่อฐานข้อมูลไม่ได้ (ไม่ใช่เด้งไปตัวเลขปลอม)
> - บน host จริงให้ตั้ง `APP_ENV=production`
> **คนแรกที่ login ด้วย Google จะได้ role `admin` อัตโนมัติ** (คนถัด ๆ ไปเป็น `user`)
> จะเปลี่ยน role ก็แก้คอลัมน์ `users.role` ในตารางได้เลย

### 5) สร้างตาราง + seed ข้อมูลเริ่มต้น

```bash
# ทางเลือก A (ใช้ได้เสมอ): คัดลอก supabase/setup.sql ไปวางใน
#   Supabase Dashboard > SQL Editor > Run
#   (เป็นไฟล์เดียวรวมทุกตาราง + FK + index รันซ้ำได้ปลอดภัย)

# ทางเลือก B: ดัน schema จาก Drizzle ตรง ๆ (ต้องต่อ DB ได้)
npm run db:push

# seed providers/models/routes ตัวอย่าง
npm run db:seed
```

จากนั้น `npm run dev` แล้วล็อกอินด้วย Google ได้เลย

## 📁 โครงสร้างโปรเจกต์

```
src/
├── app/
│   ├── page.tsx                  # Landing page (ใช้ SiteNav/SiteFooter ร่วม)
│   ├── signin/                   # หน้าเข้าสู่ระบบ (Google) — split screen
│   ├── auth/callback|signout
│   └── (app)/                    # โซนที่ต้องล็อกอิน (มี sidebar/topbar)
│       ├── dashboard/            # กราฟ + สรุป + อันดับ + ล่าสุด
│       ├── requests/             # ประวัติ + modal รายละเอียด
│       ├── keys/                 # API keys (max 3) + server actions
│       ├── credits/              # เติมเครดิต (UI)
│       └── admin/                # overview / providers / routes
├── components/                   # UI primitives + BarChart/RankingList/Sidebar/...
│   ├── Badge, StatCard, PageHeader, SectionHeading, Eyebrow, EmptyState
│   ├── SiteNav, SiteFooter, LiveUsagePanel      (หน้าสาธารณะ)
│   ├── BarChart, RankingList, UsageChartCard, DashboardMock, CodeCard
│   └── Sidebar, ToggleSwitch, ConfirmButton, StatusBadge, Logo
├── db/                           # schema.ts (Drizzle), index.ts, seed.ts
├── lib/
│   ├── auth.ts                   # session user (Supabase + DB profile)
│   ├── config.ts                 # ตรวจ env ว่าครบหรือยัง + โหมดการทํางาน
│   ├── data/usage.ts             # aggregate usage (SQL จริง)
│   ├── data/keys.ts              # จัดการ API keys
│   ├── data/admin.ts             # CRUD provider/model/route
│   └── supabase/                 # client + server helpers
└── proxy.ts                      # ป้องกัน route ที่ต้องล็อกอิน (redirect ไป /signin) — Next 16 เปลี่ยนชื่อจาก middleware.ts
supabase/migrations/              # SQL migration จาก drizzle-kit
```

### เส้นทาง (routes) หลัก

| Path | คำอธิบาย |
| --- | --- |
| `/` | Landing page สาธารณะ |
| `/signin` | เข้าสู่ระบบ / สมัคร (Google) |
| `/auth/callback` | รับ code จาก Supabase OAuth |
| `/auth/signout` | ออกจากระบบ |
| `/dashboard`, `/requests`, `/keys`, `/credits` | พื้นที่ผู้ใช้ (ต้องล็อกอิน) |
| `/admin`, `/admin/providers`, `/admin/routes` | พื้นที่แอดมิน (เฉพาะ role `admin`) |

## 🚀 Deploy ขึ้น Production

**1) ตัวแปรแวดล้อมบน host** — ต้องครบ ไม่งั้น `src/lib/config.ts` จะถือว่ายังไม่ได้ต่อ Supabase/DB

| ตัวแปร | ค่าบนเว็บจริง |
| --- | --- |
| `APP_ENV` | `production` |
| `NEXT_PUBLIC_APP_URL` | `https://octopus-ai.isdev.dpdns.org` (fallback — ค่าจริงอยู่ในตาราง `config`) |
| `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` | จาก Project Settings → API |
| `DATABASE_URL` | connection string แบบ pooler (port 6543) |
| `SUPABASE_SERVICE_ROLE_KEY` | ใช้ฝั่ง server เท่านั้น (seed / อ่าน quota) |
| `CHAT_DATABASE_URL` + `CHAT_DATABASE_TOKEN` | Turso (libSQL) สำหรับประวัติแชทและไฟล์ของ Web Agent |
| `CDN_API_KEY` | คีย์อัปโหลด HTML artifact ไป CDN (ใช้ฝั่ง server เท่านั้น) |
| `CDN_BASE_URL` | `https://cdn.octopus-ai.isdev.dpdns.org` (เว้นว่างได้) |

- HTML artifact ที่ผู้ใช้กดแชร์จะอัปโหลดไป CDN ด้วย `CDN_API_KEY`
  อายุ **7 วัน** (CDN ลบให้หลังหมดอายุ) ตั้งชื่อเองได้ หรือเว้นว่างให้ระบบสุ่ม
  ส่วนไฟล์ที่ไม่ใช่ HTML ยังใช้ลิงก์ `/s/<token>` บนโดเมนเรา (7 วัน)

- `NEXT_PUBLIC_*` ถูก bake ตอน build — แก้ค่าแล้วต้อง **build ใหม่** ไม่ใช่แค่ restart
- โดเมนจริงของเว็บเก็บในตาราง `config` (แถว `site_url`) — แก้ใน DB แล้วมีผลภายใน 60 วินาที
  โดยไม่ต้อง deploy ใหม่:
  ```sql
  UPDATE "config" SET value = 'https://octopus-ai.isdev.dpdns.org', updated_at = now()
  WHERE key = 'site_url';
  ```
  `NEXT_PUBLIC_APP_URL` เป็นเพียง fallback ตอนอ่าน DB ไม่ได้

**2) Supabase → Authentication → URL Configuration** (นี่คือต้นเหตุที่ login เสร็จแล้วเด้งกลับ localhost)
- **Site URL** = `https://octopus-ai.isdev.dpdns.org`
- **Additional Redirect URLs** = เพิ่ม `https://octopus-ai.isdev.dpdns.org/**`
  (ใส่ `http://localhost:3000/**` ไว้ด้วยถ้ายังพัฒนาในเครื่องต่อ)

แท็บที่เปิดจากโดเมนอื่น (เช่น แท็บเก่าหรือ preview) จะถูกพาไปหน้า sign-in ของ `site_url` ก่อน
แล้วแอปจึงสร้าง `redirectTo` จาก origin ปัจจุบัน ซึ่งเป็นโดเมนเดียวกับที่เก็บ PKCE verifier
([src/components/LoginForm.tsx](src/components/LoginForm.tsx))
โดเมนที่ไม่อยู่ในรายการนี้จะถูก Supabase ดีดกลับไป Site URL พร้อม `?code=`
— `src/proxy.ts` ดักกรณีนี้แล้วพาไปแลก session ที่ `/auth/callback` ให้อัตโนมัติ

**3) Schema** — วาง `supabase/setup.sql` ใน Supabase SQL Editor (idempotent) หรือรัน
migration ใน `supabase/migrations/` ตามลําดับ แล้วตรวจว่าตาราง `provider_key_limits` มีอยู่

**4) Build & run**

```bash
npm ci
npm run build
npm run start        # Node 20+ ; เปลี่ยนพอร์ตผ่าน env PORT
```

บน Vercel: Framework Preset = Next.js, ใส่ env ให้ครบแล้ว Deploy (แพลตฟอร์ม build ให้)

**5) ตรวจหลัง deploy**
- กด **เข้าสู่ระบบด้วย Google** จากโดเมนจริง → ต้องกลับมาที่ `https://<โดเมน>/dashboard`
- บัญชี role `admin` → เข้า `/admin` แล้วเปิดเมนู **จำกัดคีย์** ต้องเห็นทุก provider พร้อมกฎ 402
- `POST https://<โดเมน>/v1/chat/completions` ด้วย API key ผู้ใช้ → ต้องได้คำตอบและเห็นแถวใน `/requests`

## 📜 Scripts

| คำสั่ง | ความหมาย |
| --- | --- |
| `npm run dev` | รัน dev server |
| `npm run build` / `npm run start` | build / รัน production |
| `npm run db:generate` | generate migration จาก `src/db/schema.ts` |
| `npm run db:push` | ดัน schema ลง DB ตรง ๆ |
| `npm run db:seed` | seed providers/models/routes ตัวอย่าง |
