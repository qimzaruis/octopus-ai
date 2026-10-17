"use client";

import { useEffect, useRef, useState } from "react";

/**
 * CountUp — ตัวเลขวิ่งขึ้นเมื่อเลื่อนถึง (ใช้กับแถบสถิติ)
 *
 * แยกการ "อ่านค่า" ออกจาก "รูปแบบที่แสดง" โดยสิ้นเชิง:
 * - value ที่รับมาเป็น string ต้นทาง (เช่น "99.9%", "<12ms", "1,284", "50+")
 * - ตอน parse จะแยกเป็น prefix / ตัวเลข / suffix แล้วคงเครื่องหมายและหน่วยเดิมไว้
 *   ถ้า parse ไม่ได้ (หน่วยแปลก ๆ) จะแสดงค่าเดิมนิ่ง ๆ ไม่พัง
 *
 * ทําไมไม่ animate ผ่าน React state ทุกเฟรม: จะ re-render 60 ครั้ง/วินาที
 * งานนี้เขียนตัวเลขลง textContent ตรง ๆ ใน rAF ซึ่งเบากว่ามาก เพราะค่านี้ไม่ผูกกับ DOM อื่น
 *
 * ยิงครั้งเดียวต่อการ์ด และปิดทันทีเมื่อ prefers-reduced-motion (โชว์ค่าสุดท้ายเลย)
 * digits = จํานวนตําแหน่งทศนิยมที่คงไว้ระหว่างวิ่ง ให้ความกว้างไม่กระตุก
 */
export default function CountUp({
  value,
  duration = 1100,
  className = "",
}: {
  value: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  /** รูปแบบตัวเลขที่แยกชิ้นแล้ว: "<12ms" → { pre: "<", num: 12, post: "ms", dec: 0 } */
  const [parts, setParts] = useState<{ pre: string; num: number; post: string; dec: number } | null>(
    null,
  );

  useEffect(() => {
    const m = value.match(/^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/);
    if (!m) return;
    const raw = m[2].replace(/,/g, "");
    const dec = raw.includes(".") ? raw.split(".")[1].length : 0;
    setParts({ pre: m[1], num: parseFloat(raw), post: m[3], dec });
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !parts) return;

    const format = (n: number) =>
      `${parts.pre}${n.toLocaleString("en-US", {
        minimumFractionDigits: parts.dec,
        maximumFractionDigits: parts.dec,
      })}${parts.post}`;

    // ค่าเริ่มต้น (และค่าที่ผู้ใช้ reduced-motion เห็น) คือค่าจริงเสมอ
    el.textContent = format(parts.num);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          io.unobserve(e.target);

          const t0 = performance.now();
          const tick = (now: number) => {
            const p = Math.min(1, (now - t0) / duration);
            // ease-out cubic — เร็วตอนต้น ค่อย ๆ ผ่อนเข้าค่าสุดท้าย
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = format(parts.num * eased);
            if (p < 1) raf = requestAnimationFrame(tick);
            else el.textContent = format(parts.num);
          };
          el.textContent = format(0);
          raf = requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [parts, duration]);

  // ก่อน hydrate แสดงค่าเดิมเป็นข้อความ (SEO/no-JS ได้ตัวเลขจริง ไม่ใช่ 0)
  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}