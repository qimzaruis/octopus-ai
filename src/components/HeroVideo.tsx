"use client";

import { useEffect, useRef, useState } from "react";

/**
 * HeroVideo — วิดีโอมาสคอตในฮีโร่ (พื้นหลังถูกลบจริง)
 *
 * สินทรัพย์ 2 แบบที่เตรียมไว้ล่วงหน้า (สคริปต์เตรียมไฟล์อยู่ใน HANDOFF):
 * - `/media/octopus_hero.webm` — VP9 + alpha channel (yuva420p) = พื้นหลังโปร่งใสจริง
 *   ใช้เป็นค่าเริ่มต้นในเบราว์เซอร์ที่รองรับ VP9 (Chrome/Edge/Firefox/Opera/Samsung)
 * - `/media/octopus_hero.mp4` — H.264 ที่ premultiply พื้นหลังทับดําสนิท
 *   ใช้คู่กับ `mix-blend-mode: screen` (ดํา = โปร่งใส) สําหรับเบราว์เซอร์ที่ไม่มี VP9 alpha
 *
 * การจัดวาง: ต้นฉบับ 16:9 มีมาสคอตอยู่ค่อนไปทางขวา/กลาง (จุดศูนย์กลางมวลที่ 59.4%, 53.7%)
 * เราจึงขยายวิดีโอ (SCALE) แล้วเลื่อนด้วย translate(-59.4%, -53.7%) เพื่อให้ *ตัวมาสคอต*
 * ไปอยู่กลางวงกลมพอดี — ไม่ใช่กลางเฟรมวิดีโอ (ถ้าใช้ object-contain เฉย ๆ มาสคอตจะเอียงขวา)
 *
 * เลือกซอร์สก่อนสร้าง <video> หนึ่งครั้งด้วย canPlayType (ไม่ดาวน์โหลดทั้งสองไฟล์)
 *
 * ประสิทธิภาพ/การเข้าถึง:
 * - muted + playsInline + loop (จําเป็นสําหรับ autoplay บนมือถือ), preload metadata
 * - เฟดเข้าด้วย opacity เท่านั้น (ไม่ animate property อื่น)
 * - prefers-reduced-motion: ไม่เล่นวิดีโอ โชว์โปสเตอร์นิ่งแทน
 */

/** จุดศูนย์กลางมวลของมาสคอตในเฟรมวิดีโอ (วัดจากทุกเฟรมของลูป) */
const CX = 0.594;
const CY = 0.537;

export default function HeroVideo({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [useAlpha, setUseAlpha] = useState(true);

  useEffect(() => {
    const probe = document.createElement("video");
    setUseAlpha(probe.canPlayType('video/webm; codecs="vp9"') !== "");

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // วิดีโออาจโหลดเสร็จก่อน React hydrate → onLoadedData หลุดไปแล้ว เช็ค readyState ตรง ๆ ด้วย
    if (v.readyState >= 2) setReady(true);
    if (reduced) {
      v.pause();
      return;
    }
    // บางเบราว์เซอร์ปฏิเสธ autoplay — กลืน error ไม่ให้ console รก
    v.play().catch(() => {});
  }, [reduced, useAlpha]);

  return (
    /* isolate = สร้าง stacking context ให้กล่องนี้
       ถ้าไม่มี วงสโคป/แสงเรืองที่เป็น -z จะหลุดออกไปนอกกล่องไปวาด "หลัง" พื้นหลังทึบ
       ของหน้า (bg-ink-950) → วงกลมหายไปทั้งที่ยังอยู่ใน DOM */
    <div className={`relative isolate select-none overflow-hidden ${className}`}>
      {/* วงสโคป concentric นิ่ง ๆ = ขอบเขตที่มาสคอตลอยอยู่กลาง */}
      <svg
        aria-hidden
        viewBox="0 0 400 400"
        className="pointer-events-none absolute inset-0 -z-20 h-full w-full"
      >
        <circle cx="200" cy="200" r="194" fill="none" stroke="white" strokeOpacity="0.05" />
        <circle cx="200" cy="200" r="156" fill="none" stroke="white" strokeOpacity="0.07" />
        <circle
          cx="200"
          cy="200"
          r="124"
          fill="none"
          stroke="#6366F1"
          strokeOpacity="0.22"
          strokeDasharray="2 7"
        />
      </svg>

      {/* แสงเรืองนุ่มด้านหลังมาสคอต — radial-gradient นิ่ง ไม่มี blur ก้อนใหญ่ */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 46% 46% at 50% 50%, rgba(99,102,241,0.24), transparent 70%)",
        }}
      />
      {/* เงาพื้นนุ่ม ๆ ใต้มัสคอต ช่วยให้ “ลอย” อยู่บนพื้นจริง */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[72%] -z-10 h-6 w-[46%] -translate-x-1/2 rounded-[999px]"
        style={{
          background: "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(0,0,0,0.5), transparent 72%)",
        }}
      />

      {/* เลเยอร์วิดีโอ: ขยาย 142% แล้วเลื่อนให้จุด centroid ของมาสคอต ไปอยู่กลางวง */}
      <div
        className="absolute left-1/2 top-1/2 aspect-[16/9] w-[142%]"
        style={{ transform: `translate(${-CX * 100}%, ${-CY * 100}%)` }}
      >
        <video
          key={useAlpha ? "alpha" : "screen"}
          ref={ref}
          autoPlay={!reduced}
          loop
          muted
          playsInline
          preload="metadata"
          poster="/media/octopus_hero_poster.webp"
          aria-hidden
          tabIndex={-1}
          onLoadedData={() => setReady(true)}
          className={`h-full w-full object-contain transition-opacity duration-700 ease-enter ${
            useAlpha ? "hero-video--alpha" : "hero-video--screen"
          }`}
          style={{ opacity: ready ? 1 : 0 }}
        >
          {useAlpha ? (
            <source src="/media/octopus_hero.webm" type="video/webm" />
          ) : (
            <source src="/media/octopus_hero.mp4" type="video/mp4" />
          )}
        </video>
      </div>
    </div>
  );
}