import Image from "next/image";
import { getT } from "@/lib/i18n/server";

/**
 * AgentLogoBar — แถบโลโก้ agent ที่เลื่อนวนซ้ายไม่หยุด
 *
 * กลไกการวนไม่มีรอยต่อ: เรนเดอร์รายการเดิมซ้อนกัน REPEATS ชุดใน "ราง" (track) แล้วเลื่อน
 * รางเป็นเปอร์เซ็นต์ของความกว้างตัวเอง โดย 1 ชุด = 100/REPEATS % พอชุดที่สองเลื่อนมาถึง
 * ตําแหน่งเริ่มของชุดแรกพอดี อนิเมชันจะวนกลับจุดเริ่ม → ตาไม่เห็นรอยต่อ
 *
 * ทําไม REPEATS = 2 พอ: แถบถูกจํากัดในกรอบ max-w-6xl (หน้าต่างที่มองเห็นกว้างสุด 1152px)
 * แต่ 1 ชุดกว้าง ~1752px อยู่แล้ว จึงมีเนื้อหาสํารองเกินหน้าต่างเสมอแม้เลื่อนไปสุดราง
 * → ไม่มีทางโผล่พื้นที่ว่างโหว่กลางแถบ (อาการ "เพี้ยนตอนขยายจอ" ที่เกิดกับสูตร 2 ชุด
 * แบบเต็มขอบจอ ซึ่งหน้าต่างกว้างได้ไม่จํากัด)
 * ถ้าวันหนึ่งถอด max-w-6xl ออกให้แถบเต็มขอบจอ ต้องเพิ่ม REPEATS ก่อน ไม่งั้นจะกลับมาเพี้ยน
 *
 * ทําไมใช้ CSS animation ไม่ใช่ JS: ทั้งแถบเลื่อนด้วย transform บน compositor thread
 * ไม่กิน main thread และไม่ต้อง re-render ตลอดการเลื่อน (ต้องมีคู่กับ will-change)
 *
 * สําเนาชุดที่ 2 เป็นต้นไปเป็น aria-hidden เพราะเป็นของซ้ําเพื่อการมองเห็นเท่านั้น
 * ผู้ใช้ screen reader อ่านรายชื่อแบรนด์ชุดเดียวพอ
 *
 * ไฟล์โลโก้: public/Agent-lg/trimmed/*.png — ตัดขอบโปร่งใสออกแล้วและปรับความสูง
 * ให้เท่ากัน (120px) เพราะต้นฉบับมีระยะเว้นขอบไม่เท่ากัน ถ้าใช้ตรง ๆ โลโก้จะใหญ่เล็กต่างกัน
 * ภาพเป็นสีขาวบนพื้นโปร่งใส จึงใช้ opacity ปรับนํ้าหนักให้กลมกลืนกับธีมมืด
 */

const AGENTS = [
  { src: "/Agent-lg/trimmed/codex.png", name: "Codex", w: 397 },
  { src: "/Agent-lg/trimmed/claude-code.png", name: "Claude Code", w: 897 },
  { src: "/Agent-lg/trimmed/opencode.png", name: "opencode", w: 753 },
  { src: "/Agent-lg/trimmed/zcode.png", name: "ZCode", w: 533 },
  { src: "/Agent-lg/trimmed/deepseek.png", name: "DeepSeek Harness", w: 1018 },
  { src: "/Agent-lg/trimmed/hermes.png", name: "Hermes Agent", w: 579 },
  { src: "/Agent-lg/trimmed/openclaw.png", name: "OpenClaw", w: 454 },
  { src: "/Agent-lg/trimmed/cursor.png", name: "Cursor", w: 501 },
];

/** จํานวนชุดที่ซ้อนในราง — ต้องสอดคล้องกับค่าใน keyframe `marquee` (100 / REPEATS %) */
const REPEATS = 2;

/** ความสูงที่แสดงจริง (px) — ต้นฉบับปรับมา 120px แล้ว ย่อตรงนี้เพื่อคุมสัดส่วน */
const LOGO_H = 26;

function Set({ ariaHidden = false }: { ariaHidden?: boolean }) {
  return (
    <ul
      aria-hidden={ariaHidden || undefined}
      className="flex shrink-0 items-center gap-14 pr-14 sm:gap-20 sm:pr-20"
    >
      {AGENTS.map((a) => (
        <li key={a.name} className="shrink-0">
          <Image
            src={a.src}
            alt={ariaHidden ? "" : a.name}
            width={a.w}
            height={120}
            style={{ height: LOGO_H, width: "auto" }}
            className="opacity-55 transition-opacity duration-base ease-enter hover:opacity-100"
          />
        </li>
      ))}
    </ul>
  );
}

export default async function AgentLogoBar() {
  const t = await getT();
  return (
    /* อยู่ในคอนเทนเนอร์เดียวกับเนื้อหาอื่น (max-w-6xl + px-6) ให้แถบโลโก้อยู่ในกรอบ
       ไม่เบล็ดออกเต็มขอบจอ — ขอบซ้าย/ขวาจึงตรงกับ DashboardMock และส่วนอื่น ๆ
       pb-20 เว้นระยะจากส่วนถัดไป ไม่ให้ดูติดกัน */
    <section aria-label={t("Agent ที่รองรับ")} className="px-6 pb-20 pt-4">
      <div className="relative mx-auto max-w-6xl overflow-hidden">
        {/* ขอบซ้าย-ขวาจางหาย เพื่อไม่ให้โลโก้ถูกตัดแข็ง ๆ ที่ขอบกรอบ */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 sm:w-24"
          style={{ background: "linear-gradient(to right, #0B0F1A, transparent)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 sm:w-24"
          style={{ background: "linear-gradient(to left, #0B0F1A, transparent)" }}
        />

        {/* motion-reduce:animation-none — ผู้ใช้ที่ปิดอนิเมชันจะเห็นแถวนิ่ง อ่านได้ครบ */}
        <div className="flex w-max animate-marquee will-change-transform motion-reduce:animate-none">
          {Array.from({ length: REPEATS }, (_, i) => (
            <Set key={i} ariaHidden={i > 0} />
          ))}
        </div>
      </div>
    </section>
  );
}