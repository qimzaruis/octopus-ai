"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reveal — เผยเนื้อหาด้วย fade-up เมื่อเลื่อนถึง (IntersectionObserver)
 *
 * ทําไมใช้ IntersectionObserver ไม่ใช่ scroll listener: observer ถูกเรียกโดยเบราว์เซอร์
 * เฉพาะตอนที่สถานะตัดกันเปลี่ยน (เข้า/ออกจอ) ไม่ต้องคํานวณตําแหน่งทุกเฟรมที่ผู้ใช้เลื่อน
 *
 * หลักการทํางาน:
 * - เริ่มที่ opacity 0 + translateY(16px) แล้วเติมคลาส animate-fade-up เมื่อเข้า viewport
 * - เผยครั้งเดียวแล้วหยุด observe (ไม่เล่นซ้ําตอนเลื่อนขึ้นลง — กันกวนสายตา)
 * - prefers-reduced-motion: แสดงเนื้อหาทันทีโดยไม่ observe เลย (ไม่ใช่แค่เร่งอนิเมชันให้เร็ว)
 * - รันเฉพาะฝั่ง client หลัง mount; ค่าเริ่มต้นคือ "มองเห็น" ถ้ายังไม่ mount
 *   เพื่อไม่ให้เนื้อหาหายไปถ้า JS ถูกบล็อก (เนื้อหายังอ่านได้ในทุกกรณี)
 *
 * delay: หน่วงเริ่มอนิเมชันเป็น ms ใช้เหลื่อมกันเป็นลําดับ (stagger) ในกลุ่มการ์ด
 */
export default function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // มองเห็นอยูแล้วตั้งแต่โหลด (top ยังไม่พ้นขอบล่างจอ) — แสดงทันที ไม่ต้องรอ observer
    // ใช้ innerHeight เต็ม ไม่ใช่ 0.9 เท่า: ถ้าเผื่อน้อยกว่านี้ บล็อกที่โผล่บางส่วน
    // จะโดนซ่อนแล้วเล่นอนิเมชัน ซึ่งตาเห็นเป็น "กระพริบ"
    if (reduced || el.getBoundingClientRect().top < window.innerHeight) {
      setShown(true);
      return;
    }

    setArmed(true);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          setShown(true);
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${armed && !shown ? "opacity-0" : "animate-fade-up"} ${className}`}
      style={shown && delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}