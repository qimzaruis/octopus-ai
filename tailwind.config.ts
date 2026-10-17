import type { Config } from "tailwindcss";

/**
 * Design tokens — ค่าทั้งหมดของระบบดีไซน์อยู่ที่นี่ที่เดียว
 * ทุกคอมโพเนนต์ต้องอ้างอิงจาก token ไม่ hardcode ค่า
 * รายละเอียดและเหตุผลของแต่ละค่าอยู่ใน DESIGN_SYSTEM.md
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // ---- สี: base 3 ระดับ + แบรนด์ 1 เฉด + สถานะ ----
      colors: {
        ink: {
          950: "#0B0F1A", // 60% — พื้นหน้า (page base)
          900: "#111726", // 30% — ส่วนยกขึ้น (section)
          850: "#161E31", //        การ์ด/แผง (floating)
          800: "#1D2740",
          700: "#2A3552",
        },
        // ข้อความ: ทุกค่าต้องผ่าน AA บนพื้นทั้งสามระดับ (คำนวณใน DESIGN_SYSTEM.md)
        fg: {
          DEFAULT: "#E8ECF5", // ตัวอักษรหลัก
          muted: "#A9B4C7", // รอง — ผ่าน AA ทุกพื้น
          subtle: "#8B97AD", // เมทาดาทา — ใช้ได้เฉพาะ >=14px (4.4–4.9:1)
        },
        brand: {
          200: "#CBD2FE",
          300: "#B4BEFC",
          400: "#8E97F5",
          500: "#6366F1",
          600: "#4F46E5",
        },
        pulse: {
          DEFAULT: "#A855F7",
          300: "#C4B5FD", // ข้อความบนพื้นเข้ม — ผ่าน AA (9.00:1 บน ink-850) ต่างจาก DEFAULT ที่ได้แค่ 4.20
        },
        aqua: "#22D3EE",
        leaf: "#34D399",
        "amber-glow": "#FBBF24",
      },

      // ---- ตัวอักษร: Latin = Space Grotesk, ไทย = IBM Plex Sans Thai, mono = JetBrains ----
      // ลําดับสําคัญ: เบราว์เซอร์จะไล่หาฟอนต์แรกที่มี glyph ของตัวอักษรนั้น
      // → ละตินได้ Space Grotesk, ไทยข้ามไป IBM Plex Sans Thai (Space Grotesk ไม่มีไทย)
      fontFamily: {
        sans: ["var(--font-grotesk)", "var(--font-thai)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-grotesk)", "var(--font-thai)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "var(--font-thai)", "ui-monospace", "SFMono-Regular", "monospace"],
      },

      // ---- สเกลตัวอักษร (fluid) — ใช้แทนขนาดที่เขียนเองในแต่ละที่ ----
      fontSize: {
        micro: ["0.625rem", { lineHeight: "1.4" }], // 10px — เมทาดาทาเล็กสุด (badge/ตัวห้อย)
        label: ["0.6875rem", { lineHeight: "1.45" }], // 11px — label ในปุ่ม/ตาราง
        caption: ["0.8125rem", { lineHeight: "1.5" }], // 13px
        "body-sm": ["0.875rem", { lineHeight: "1.55" }], // 14px
        body: ["1rem", { lineHeight: "1.6" }], // 16px — ขั้นต่ําของเนื้อหา
        "body-lg": ["1.0625rem", { lineHeight: "1.6" }],
        stat: ["1.625rem", { lineHeight: "1" }], // 26px — ตัวเลขหลักในการ์ดสถิติ
        h3: ["1.125rem", { lineHeight: "1.4", letterSpacing: "-0.01em" }],
        h2: ["clamp(1.5rem, 1.2rem + 1.4vw, 2rem)", { lineHeight: "1.25", letterSpacing: "-0.02em" }],
        h1: ["clamp(1.875rem, 1.4rem + 2.2vw, 2.75rem)", { lineHeight: "1.15", letterSpacing: "-0.025em" }],
        display: ["clamp(2.25rem, 1.5rem + 3.4vw, 4.25rem)", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
      },

      // ---- รัศมีมุม: 3 ขั้นเท่านั้น ----
      borderRadius: {
        md: "0.5rem", // 8 — ควบคุมขนาดเล็ก
        lg: "0.75rem", // 12 — การ์ด/ปุ่ม
        xl: "1rem", // 16 — แผง/hero
      },

      // ---- เงา: ไล่เฉดสีแบรนด์ (ไม่ใช้ดําล้วน) + ใช้ร่วมกับ background step ----
      boxShadow: {
        raised: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 12px 32px -18px rgba(8,11,20,0.9)",
        floating: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 60px -28px rgba(8,11,20,1)",
        "focus-ring": "0 0 0 2px rgba(11,15,26,1), 0 0 0 4px rgba(142,151,245,0.7)",
      },

      // ---- motion tokens: ใช้ชุดเดียวกันทุกที่ ----
      transitionDuration: {
        fast: "150ms",
        base: "220ms",
        slow: "320ms",
      },
      transitionTimingFunction: {
        enter: "cubic-bezier(0.22, 1, 0.36, 1)", // ease-out เข้า
        exit: "cubic-bezier(0.4, 0, 1, 1)", // ease-in ออก
      },

      // ---- อนิเมชัน: เฉพาะที่จบในตัว (ไม่วิ่งตลอดเวลา) ----
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        /* โลโก้เลื่อนวนซ้าย: เลื่อน -50% = 1 ชุด จาก 2 ชุดในราง (ดู REPEATS ใน AgentLogoBar)
           ต้องเป็น 100/REPEATS เสมอ ถ้าเปลี่ยนจํานวนชุดต้องแก้คู่นี้พร้อมกัน
           ก้าวพอดี 1 ชุด → ชุดที่ 2 เข้ามาที่ตําแหน่งเดิมของชุดที่ 1 = วนต่อไม่มีรอยต่อ */
        marquee: {
          from: { transform: "translate3d(0, 0, 0)" },
          to: { transform: "translate3d(-50%, 0, 0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 500ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 400ms cubic-bezier(0.22, 1, 0.36, 1) both",
        marquee: "marquee 45s linear infinite",
      },

      // ---- ตารางพื้นหลังแบบคงที่ (ไม่ขยับ) ----
      backgroundImage: {
        "grid-faint":
          "linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "72px 72px",
      },
    },
  },
  plugins: [],
};

export default config;