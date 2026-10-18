import Link from "next/link";
import Logo from "@/components/Logo";
import Badge from "@/components/Badge";
import DashboardMock from "@/components/DashboardMock";
import HeroVideo from "@/components/HeroVideo";
import ApiUsageTabs from "@/components/ApiUsageTabs";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import AgentLogoBar from "@/components/AgentLogoBar";
import Reveal from "@/components/Reveal";
import CountUp from "@/components/CountUp";
import { isDemoMode } from "@/lib/config";
import { getT } from "@/lib/i18n/server";
import Icon from "@/components/Icon";

const STATS = [
  { value: "50+", label: "โมเดลจากทุกค่าย" },
  { value: "99.9%", label: "Uptime ของ gateway" },
  { value: "<12ms", label: "Overhead ต่อ request" },
  { value: "3", label: "API keys ต่อบัญชี" },
];

const FEATURES = [
  {
    icon: "fa-solid fa-layer-group",
    title: "Unified API",
    desc: "เรียกทุกโมเดลผ่าน endpoint เดียวที่เข้ากันได้กับ OpenAI SDK — เปลี่ยนโมเดลโดยไม่ต้องแก้ code",
  },
  {
    icon: "fa-solid fa-route",
    title: "Smart Routing",
    desc: "ตั้งลำดับ fallback ได้เอง ระบบสลับโมเดลให้อัตโนมัติเมื่อเจอ rate limit หรือปลายทางล่ม",
  },
  {
    icon: "fa-solid fa-chart-column",
    title: "Observability",
    desc: "เห็นทุก request ละเอียดถึง token, latency, agent และสถานะ พร้อมกราฟรายชั่วโมงและรายวัน",
  },
  {
    icon: "fa-solid fa-shield-halved",
    title: "Secure by Design",
    desc: "คีย์ของ provider เก็บฝั่ง server เท่านั้น คุณสร้างคีย์ของตัวเองได้สูงสุด 3 คีย์ และยกเลิกได้ทันที",
  },
];

const MODELS = [
  { model: "gpt-4o-mini", provider: "OpenAI", context: "128K", best: "งานทั่วไป คุ้มที่สุด" },
  { model: "claude-3.5-sonnet", provider: "Anthropic", context: "200K", best: "งานเขียนและวิเคราะห์" },
  { model: "gemini-1.5-pro", provider: "Google", context: "1M", best: "เอกสารยาว มัลติโมดัล" },
  { model: "llama-3.1-70b", provider: "Groq", context: "131K", best: "ตอบเร็วมาก" },
  { model: "mistral-large", provider: "Mistral", context: "128K", best: "งานหลายภาษา" },
];

const DEV_POINTS = [
  "OpenAI-compatible chat completions",
  "รองรับ Anthropic Messages และ OpenAI Responses API",
  "รองรับ streaming แบบเรียลไทม์",
  "Usage analytics และ metering ราย request",
  "Fallback อัตโนมัติเมื่อโมเดลใช้งานไม่ได้",
];

export default async function LandingPage() {
  const t = await getT();
  return (
    /* overflow-x: clip ไม่ใช่ hidden — clip ไม่สร้าง scroll container จึงรักษา sticky ของ nav ไว้ */
    <div className="relative min-h-screen overflow-x-clip bg-ink-950">
      {/* พื้นหลังคงที่: ตารางจาง + แสงเรืองแบบ radial-gradient ธรรมดา (ไม่ใช้ blur หนักเพื่อประสิทธิภาพ) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-grid-faint bg-grid"
        style={{
          maskImage: "radial-gradient(ellipse 80% 55% at 50% 0%, #000, transparent 72%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 55% at 50% 0%, #000, transparent 72%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[560px]"
        style={{
          background:
            "radial-gradient(ellipse 60% 100% at 50% 0%, rgba(99,102,241,0.20), transparent 70%)",
        }}
      />

      <SiteNav />

      {/* ============ Hero — asymmetric editorial (ข้อความซ้าย / มาสคอตอยู่กลางวง)
          คอมโพสิชัน: บนจอใหญ่เป็น 2 คอลัมน์ (ข้อความซ้าย / มาสคอตขวา) โดยมาสคอตยึด
          จุด centroid ของตัวเองให้อยู่กลางวงสโคปพอดี (ดู HeroVideo)
          บนมือถือเรียงเป็น: หัวเรื่อง → มาสคอต → เนื้อหา+ปุ่ม (ใช้ display:contents
          ให้บล็อกข้อความแยกออกมาเป็น flex item เพื่อสลับลําดับด้วย order ได้)
          ทั้งหมดอยู่ในคอนเทนเนอร์ ไม่มี bleed ออกนอกขอบจอ ============ */}
      <section className="relative px-6">
        {/* เพดานความสูงฮีโร่: ปล่อยให้ min-h โตตาม svh เฉย ๆ บนจอสูงมาก (1440p)
            ช่องว่างบน-ล่างจะบานออกเป็นหลายร้อย px ทั้งที่เนื้อหายังเท่าเดิม
            จึงจํากัดด้วย min() ไว้ที่ 50rem (800px) — พ้นจากนั้นความสูงคงที่ */}
        <div className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-6xl flex-col justify-center gap-8 py-12 lg:grid lg:min-h-[min(calc(100svh_-_4rem),50rem)] lg:grid-cols-[minmax(0,46%)_minmax(0,54%)] lg:items-center lg:gap-0 lg:py-16">
          {/* คอลัมน์ซ้าย: หัวเรื่อง + เนื้อหา (บนมือถือแยกออกมาเป็น flex item) */}
          <div className="contents lg:block lg:pr-6">
            <div className="order-1 text-center lg:text-left">
              <Badge tone="leaf" dot className="mx-auto lg:mx-0">
                {t("เชื่อมต่อได้แล้ววันนี้")}
              </Badge>

              <h1 className="mt-6 font-display text-display font-semibold text-fg">
                {t("ทางเข้าหนึ่งเดียว")}
                <br />
                <span className="text-brand-300">{t("สู่ทุกโมเดล AI")}</span>
              </h1>
            </div>

            <div className="order-3 text-center lg:mt-6 lg:text-left">
              <p className="mx-auto max-w-xl text-body-lg text-fg-muted lg:mx-0">
                {t(
                  "เชื่อมต่อ OpenAI, Claude, Gemini และอีกหลายสิบโมเดลผ่านแพลตฟอร์ม OctopusAI พร้อมแดชบอร์ดวิเคราะห์การใช้งาน และ OctopusRouter Free",
                )}
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
                <Link href="/signin" className="btn-primary w-full !px-6 !py-3 sm:w-auto">
                  <Icon name="fa-google" /> {t("เริ่มใช้งานด้วย Google")}
                </Link>
                <a href="#developers" className="btn-secondary w-full !px-6 !py-3 sm:w-auto">
                  <Icon name="fa-terminal" className="text-label" /> {t("ดูตัวอย่าง API")}
                </a>
              </div>

              <p className="mt-5 text-caption text-fg-subtle">
                {isDemoMode
                  ? t("โหมด Demo — เข้าสู่ระบบเพื่อชมแดชบอร์ดพร้อมข้อมูลตัวอย่าง")
                  : t("เริ่มต้นฟรี ไม่ต้องใช้บัตรเครดิต")}
              </p>
            </div>
          </div>

          {/* มาสคอต — บนจอใหญ่เป็นคอลัมน์ขวา
              เพดานความกว้างผูกกับความสูงจอ ไม่ใช่ความกว้างคอลัมน์: เพราะเป็นการ์ดจตุรัส
              ถ้าปล่อยให้เต็มคอลัมน์ (54%) มาสคอตจะสูงจนดันฮีโร่ล้นใต้ nav แล้ว justify-center
              จะไปจัดกลางกล่องที่ล้นนั้น = ข้อความดูต่ำกว่าศูนย์กลางจริงของจอ */}
          <div className="order-2 mx-auto w-full max-w-[400px] lg:max-w-[min(100%,calc(100svh_-_13rem))]">
            <HeroVideo className="aspect-square w-full" />
          </div>
        </div>
      </section>

      {/* ============ Agent brand bar — ตอจากฮีโร่ทันที (โลโก้เลื่อนวนซ้าย) ============ */}
      <AgentLogoBar />

      {/* ============ Product showcase ============ */}
      <section className="px-6 pb-20">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <DashboardMock />
          </Reveal>
        </div>
      </section>

      {/* ============ Trust bar (สถิติ) — ตัวเลขวิ่งขึ้นเมื่อเลื่อนถึง ============ */}
      <section className="bg-ink-900/50 py-10">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-y-8 px-6 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 90}>
              <div className="text-center">
                <p className="tnum text-3xl font-semibold text-fg">
                  <CountUp value={s.value} />
                </p>
                <p className="mt-1.5 text-body-sm text-fg-muted">{t(s.label)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============ Features — asymmetric rows (ต่างจาก grid การ์ด) ============ */}
      <section id="platform" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <h2 className="max-w-xl font-display text-h2 font-semibold text-fg">
              {t("ทุกอย่างที่ทีมต้องการ อยู่ในที่เดียว")}
            </h2>
          </Reveal>

          <div className="mt-12 divide-y divide-white/[0.07]">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <div className="grid gap-4 py-8 sm:grid-cols-[auto_1fr_1.4fr] sm:items-start sm:gap-8">
                  <span className="tnum w-8 text-body-sm text-fg-subtle">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="flex items-center gap-3 text-h3 font-semibold text-fg">
                    <Icon name={f.icon} className="text-[15px] text-brand-300" />
                    {f.title}
                  </h3>
                  <p className="text-body-sm leading-relaxed text-fg-muted">{t(f.desc)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Models table ============ */}
      <section id="models" className="bg-ink-900/50 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-h2 font-semibold text-fg">{t("โมเดลยอดนิยม")}</h2>
                <p className="mt-3 max-w-md text-body-sm text-fg-muted">
                  {t("เลือกใช้ได้ทันที หรือเพิ่ม provider ของคุณเองในหน้าแอดมิน")}
                </p>
              </div>
              <Link href="/signin" className="btn-secondary shrink-0">
                {t("ดูทั้งหมด")} <Icon name="fa-arrow-right" className="text-label" />
              </Link>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="mt-10 overflow-hidden rounded-lg bg-ink-850">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.07]">
                    <th className="table-head">{t("โมเดล")}</th>
                    <th className="table-head">{t("ผู้ให้บริการ")}</th>
                    <th className="table-head">Context</th>
                    <th className="table-head hidden sm:table-cell">{t("เหมาะกับ")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {MODELS.map((m) => (
                    <tr key={m.model} className="transition-colors duration-fast hover:bg-white/[0.03]">
                      <td className="table-cell font-mono text-fg">{m.model}</td>
                      <td className="table-cell">{m.provider}</td>
                      <td className="table-cell tnum">{m.context}</td>
                      <td className="table-cell hidden sm:table-cell">{t(m.best)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-white/[0.07] px-4 py-3.5 text-caption text-fg-subtle">
                {t("และอีก 50+ โมเดล — เพิ่ม provider ใหม่ได้เองตลอดเวลา")}
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ Developer ============ */}
      <section id="developers" className="px-6 py-24">
        <div className="mx-auto grid max-w-6xl items-start gap-14 lg:grid-cols-[0.85fr_1.15fr]">
          <Reveal className="lg:sticky lg:top-24">
            <h2 className="font-display text-h2 font-semibold text-fg">
              {t("คุ้นเคยตั้งแต่บรรทัดแรก")}
            </h2>
            <p className="mt-4 text-body-sm leading-relaxed text-fg-muted">
              {t(
                "ไม่ต้องเรียน SDK ใหม่ ไม่ต้องรื้อ workflow — แค่เปลี่ยน base URL ใส่คีย์ แล้วยิง request แรกได้เลย",
              )}
            </p>

            <ul className="mt-8 space-y-3">
              {DEV_POINTS.map((item) => (
                <li key={item} className="flex items-start gap-3 text-body-sm text-fg-muted">
                  <Icon name="fa-check" className="mt-1 text-label text-leaf" />
                  {t(item)}
                </li>
              ))}
            </ul>

            <Link href="/signin" className="btn-primary mt-9">
              <Icon name="fa-key" className="text-label" /> {t("รับ API key ของคุณ")}
            </Link>
          </Reveal>

          <Reveal delay={120}>
            <div className="rounded-xl bg-ink-900 p-5 shadow-raised ring-1 ring-white/[0.06]">
              <ApiUsageTabs />
            </div>
          </Reveal>
        </div>
      </section>

{/* ============ Final CTA ============ */}
      <section className="px-6 pb-24">
        <Reveal>
          <div className="mx-auto max-w-6xl rounded-xl bg-ink-900 px-8 py-16 text-center sm:px-16">
            <h2 className="mx-auto max-w-2xl font-display text-h1 font-semibold text-fg">
              {t("พร้อมให้ทุกโมเดลทํางาน")}
              <br />
              <span className="text-brand-300">{t("ให้คุณแล้วหรือยัง?")}</span>
            </h2>
            <p className="mx-auto mt-5 max-w-md text-body-sm text-fg-muted">
              {t("สมัครด้วยบัญชี Google แล้วสร้าง API key แรกของคุณได้ทันที")}
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/signin" className="btn-primary !px-7 !py-3">
                <Icon name="fa-google" /> {t("เข้าสู่ระบบด้วย Google")}
              </Link>
              <a href="#developers" className="btn-secondary !px-7 !py-3">
                {t("ดูเอกสาร API")}
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      <SiteFooter />
    </div>
  );
}