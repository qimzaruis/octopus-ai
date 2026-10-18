"use client";

import Badge from "@/components/Badge";
import CountUp from "@/components/CountUp";
import Icon from "@/components/Icon";
import { siteHost } from "@/lib/config";
import { useT } from "@/lib/i18n/client";

/**
 * DashboardMock — ภาพจําลองหน้าจอสําหรับ hero
 * สร้างจาก div/SVG ล้วน ไม่มี backdrop-blur ซ้อน (ลดภาระ GPU) และไม่ใช้ gradient text
 */
export default function DashboardMock() {
  const t = useT();
  const bars = [34, 45, 29, 52, 63, 48, 74, 88];
  const labels = ["08", "10", "12", "14", "16", "18", "20", "22"];
  const providers = ["OpenAI", "Anthropic", "Google", "Groq"];

  return (
    <div className="relative rounded-xl bg-ink-900 p-1.5 shadow-floating">
      <div className="overflow-hidden rounded-lg bg-ink-950">
        {/* แถบไทเทิลแบบหน้าต่างแอป */}
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500/50" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-glow/50" />
          <span className="h-2.5 w-2.5 rounded-full bg-leaf/50" />
          <span className="ml-3 hidden font-mono text-label text-fg-subtle sm:block">
            {siteHost("localhost:3000")}/dashboard
          </span>
          <Badge tone="leaf" dot className="ml-auto !py-0.5 !text-micro">
            live
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[176px_1fr]">
          {/* sidebar จำลอง */}
          <div className="hidden border-r border-white/[0.07] p-3 md:block">
            {[
              { icon: "fa-solid fa-chart-pie", label: "Dashboard", active: true },
              { icon: "fa-solid fa-clock-rotate-left", label: t("ประวัติการเรียกใช้") },
              { icon: "fa-solid fa-key", label: "API Keys" },
              { icon: "fa-solid fa-coins", label: t("เครดิต") },
            ].map((item) => (
              <div
                key={item.label}
                className={`mb-1 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-label ${
                  item.active ? "bg-white/[0.08] text-fg" : "text-fg-subtle"
                }`}
              >
                <Icon name={item.icon} className="h-3 w-3 shrink-0 text-micro" />
                {item.label}
              </div>
            ))}
          </div>

          {/* main จำลอง */}
          <div className="p-4">
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              {[
                { label: t("Requests วันนี้"), value: "1,284" },
                { label: t("Tokens วันนี้"), value: "52,480" },
                { label: t("Latency เฉลี่ย"), value: "1.2s" },
                { label: t("อัตราสําเร็จ"), value: "99.2%" },
              ].map((s) => (
                <div key={s.label} className="rounded-md bg-white/[0.04] p-3">
                  <p className="text-micro text-fg-subtle">{s.label}</p>
                  <p className="tnum mt-1 text-body-sm font-semibold text-fg">
                    <CountUp value={s.value} />
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 grid gap-2.5 lg:grid-cols-[1fr_190px]">
              {/* กราฟ */}
              {/* flex-col + min-h-0: การ์ดนี้ถูก grid ยืดให้สูงเท่าการ์ด provider ข้าง ๆ
                  จึงต้องให้พื้นที่กราฟยืดตามด้วย ไม่งั้นแท่งจะจบกลางการ์ดแล้วเหลือที่ว่าง
                  ก้อนใหญ่ด้านล่าง ดูเหมือนแท่งลอยไม่ติดพื้น */}
              <div className="flex flex-col rounded-md bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-label font-medium text-fg-muted">{t("ภาพรวมการใช้งาน")}</p>
                  <div className="segmented !p-0.5">
                    <span className="rounded px-1.5 py-0.5 text-micro text-fg-subtle">7d</span>
                    <span className="rounded bg-white/[0.1] px-1.5 py-0.5 text-micro text-fg">
                      24h
                    </span>
                  </div>
                </div>
                {/* ไม่ใส่ items-end ที่นี่ — ต้องให้คอลัมน์ยืดเต็มความสูง (ค่าเริ่มต้น stretch)
                    ถ้าใส่ items-end คอลัมน์จะสูงตามเนื้อหา (=0) แล้วแท่งที่ใช้ height %
                    จะหายทั้งแถบ; การดันแท่งให้ชิดล่างทําที่ตัวห่อด้านในแทน */}
                <div className="mt-4 flex min-h-28 flex-1 gap-2">
                  {bars.map((h, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                      {/* ตัวห่อ flex-1 items-end มีความสูงแน่นอนจากคอลัมน์
                          แท่งจึงใช้ height % ได้จริงและชิดเส้นฐานล่างเสมอ */}
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className={`w-full rounded-sm ${
                            i === bars.length - 1 ? "bg-brand-400" : "bg-brand-500/30"
                          }`}
                          style={{ height: `${h}%` }}
                        />
                      </div>
                      <span className="hidden font-mono text-micro text-fg-subtle lg:block">
                        {labels[i]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* แผง provider */}
              <div className="rounded-md bg-white/[0.03] p-4">
                <p className="text-micro font-medium uppercase tracking-[0.14em] text-fg-subtle">
                  One connection
                </p>
                <p className="mt-1.5 text-caption font-medium leading-snug text-fg">
                  {t("ยิง request เดียว ถึงทุกโมเดล")}
                </p>
                <div className="mt-4 space-y-1.5">
                  {providers.map((p, i) => (
                    <div
                      key={p}
                      className="flex items-center justify-between rounded bg-ink-950/70 px-2.5 py-1.5"
                    >
                      <span className="text-micro text-fg-muted">{p}</span>
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          i === 3 ? "bg-amber-glow" : "bg-leaf"
                        }`}
                      />
                    </div>
                  ))}
                  <p className="pt-1 text-center font-mono text-micro text-fg-subtle">
                    +46 providers
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}