"use client";

import { useEffect, useRef } from "react";

/**
 * AsciiArt — เรนเดอร์งาน ASCII art จากไฟล์ .txt เป็น canvas พร้อมอนิเมชัน
 * สไตล์ ASCII plasma (อ้างอิง asciiart.eu/animations/ascii-plasma):
 *
 * 1. พลาสมา: ตัวอักษรทุกช่องของกริดไล่ความสว่างตามคลื่น sin ซ้อนหลายชั้น
 *    (ตำแหน่ง + ระยะจากจุดกึ่งกลาง) เปลี่ยนอักขระตามระดับ " .:-=+*#%@"
 *    และสีม่วงเข้ม→สว่าง — วาดลง offscreen และรีเฟรชทุก ~90ms
 * 2. มาสคอต: งาน ASCII ต้นฉบับ (ข้ามอักขระ '@' พื้นหลัง ให้พลาสมาโผล่มาแทน)
 *    ท่อนหัว-ลำตัววาดเป็นก้อนคงที่ ส่วนโซนหนวดวาดใหม่ทุก ~130ms แบบ "ดึงจาก
 *    แถวต้นทาง" ให้แต่ละแถวเลื่อนทีละ "ช่องตัวอักษรเต็ม ๆ" ทั้งซ้าย-ขวาและ
 *    บีบ-ยืดตามความลึก = ปลายหนวดตวัดเหมือนมีชีวิต โคนนิ่ง ไม่เบลอ ไม่ขาดเป็นช่วง
 * 3. เอฟเฟกต์เสริม: คลื่นแสงวิ่ง + แถบ scan (ไม่มีอนิเมชันเปิด — วาดเต็มทันที)
 * 4. โหมด cover ใช้เป็นพื้นหลังเต็มจอ (คำนวณขนาดจากความสูง, focusX จัด
 *    ตำแหน่งมาสคอต) — ภาพอยู่กับที่ ไม่ลอย ไม่ตามเมาส์
 *
 * เทคนิคประสิทธิภาพ: พลาสมา + งานต้นฉบับวาดลง offscreen canvas แยกกัน
 * ทุกเฟรมแค่ drawImage ไม่กี่ครั้ง + รีวาดพลาสมาเป็นระยะ — ไม่ redraw
 * ตัวอักษรหลายพันตัวทุกเฟรม
 */

/* ความ "หนาแน่น" ของอักขระงานต้นฉบับ (0–1) — '@' คือพื้นหลัง (จะถูกข้าม) */
const INK_LEVEL: Record<string, number> = {
  "%": 0.88,
  "#": 0.78,
  "*": 0.66,
  "+": 0.55,
  "=": 0.5,
  "-": 0.38,
  ":": 0.3,
  ".": 0.24,
  "~": 0.4,
  "/": 0.45,
  "\\": 0.45,
  O: 0.7,
};
const DEFAULT_INK = 0.45;

/* ไล่สีตัวมาสคอต: ตัวอักษรยิ่งเบายิ่งสว่าง (ม่วงเข้ม → ลาเวนเดอร์) */
const STOPS: Array<[number, number, number]> = [
  [176, 142, 252],
  [218, 206, 255],
  [250, 247, 255],
];

function lerpColor(glow: number): string {
  const p = Math.min(1, Math.max(0, glow)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(p));
  const f = p - i;
  const a = STOPS[i];
  const b = STOPS[i + 1];
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/* ---- พลาสมา ---- */
const PLASMA_RAMP = ".:-=+*#%@";
const PLASMA_STEPS: Array<[number, number, number]> = [
  [26, 9, 52], // เกือบดำ
  [74, 24, 130], // ม่วงเข้ม
  [139, 92, 246], // violet สว่าง
];
const PLASMA_REFRESH_MS = 90;

function plasmaColor(v: number): string {
  const p = Math.min(1, Math.max(0, v)) * (PLASMA_STEPS.length - 1);
  const i = Math.min(PLASMA_STEPS.length - 2, Math.floor(p));
  const f = p - i;
  const a = PLASMA_STEPS[i];
  const b = PLASMA_STEPS[i + 1];
  const c = a.map((x, k) => Math.round(x + (b[k] - x) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/* หนวดขยับแบบ ASCII: เลื่อนเป็น "ช่องตัวอักษรเต็ม ๆ" ก้าวต่อกันทุกจังหวะ */
type Glyph = { ch: string; x: number; fill: string };
const EMPTY_GLYPHS: Glyph[] = [];

/* แถวที่เริ่มเป็น "หนวด" ของงานต้นฉบับ (0-indexed) — เลื่อนเป็นช่องเต็มจากแถวนี้ลงไป */
const TENTACLE_START = 23;

/* หนึ่ง "เฟรม" ของการขยับหนวด — ช้าพอที่จะเห็นเป็นการก้าวของตัวอักษร ไม่ใช่การไหล */
const TENTACLE_TICK_MS = 130;

/* จุดกึ่งกลางแนวตั้งของงาน (เศษส่วนความกว้าง) — ใช้จัดตำแหน่งมาสคอต */
const ART_CX = 0.5;

/* ความกว้างจอสูงสุดที่ยังวางมาสคอตกลางจอ (มือถือ + แท็บเล็ต)
   ต้องตรงกับจุดที่หน้า/signin เลิกดันการ์ดไปฝั่งขวา (breakpoint xl) */
const CENTER_BELOW = 1280;

export default function AsciiArt({
  text,
  className = "",
  cover = false,
  focusX = 0.5,
}: {
  text: string;
  className?: string;
  /** ขยายเต็ม container จากความสูง (ใช้เป็นพื้นหลังเต็มจอ) */
  cover?: boolean;
  /** ตำแหน่งกึ่งกลางงานบนแกน x ของ container (0–1) — จังหวะที่มาสคอตอยู่ซ้าย */
  focusX?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    /* closure ภายในอ้างสำเนา non-null เพื่อให้ TS narrow ได้ */
    const el = canvas;
    const cx = ctx;

    const lines = text
      .replace(/\r/g, "")
      .split("\n")
      .filter((l) => l.trim().length > 0);
    if (lines.length === 0) return;
    const rows = lines.length;
    const cols = Math.max(...lines.map((l) => l.length));

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    /* base = งานมาสคอตทั้งชิ้น (ข้าม @ พื้นหลัง) ใช้สำหรับท่อนหัว-ลำตัว,
       arms = เลเยอร์เฉพาะแถวหนวดที่วาดใหม่ทุกจังหวะ, plasma = พื้นหลังทั้งกริด */
    const base = document.createElement("canvas");
    const plasma = document.createElement("canvas");
    const arms = document.createElement("canvas");
    const pctx = plasma.getContext("2d");
    const actx = arms.getContext("2d");
    if (!pctx || !actx) return;
    const pb = pctx; /* สำเนา non-null สำหรับ closure */
    const ab = actx;
    let ro: ResizeObserver | null = null;

    let cellW = 0;
    let cellH = 0;
    let fontSize = 0;
    let totalCols = cols;
    let dpr = 1;
    let raf = 0;
    let lastW = 0;
    let lastH = 0;
    let lastPlasma = -1e9;
    let step = 0;
    let lastStep = 0;
    let lastInkRow = TENTACLE_START;
    let armRows = new Map<number, Glyph[]>();

    /** วาดมาสคอตลง offscreen (เฉพาะอักขระที่ไม่ใช่พื้นหลัง @) */
    function build() {
      const rect = el.parentElement?.getBoundingClientRect();
      const availW = rect?.width || el.clientWidth;
      if (!availW) return;
      const availH = rect?.height || 0;

      const family = getComputedStyle(el).fontFamily || "monospace";
      fontSize =
        cover && availH
          ? Math.max(6, Math.min(22, availH / (rows * 1.02)))
          : Math.max(5, Math.min(13, availW / (cols * 0.62)));
      cx.font = `${fontSize}px ${family}`;
      cellW = cx.measureText("M").width || fontSize * 0.6;
      cellH = fontSize * 1.02;

            dpr = Math.min(window.devicePixelRatio || 1, 2);
      // โหมด cover: ต่อคอลัมน์พลาสมาจนครอบขอบขวาของจอเสมอ —
      // คำนวณจากตำแหน่ง left จริงของ canvas (ค่าติดลบ) + ปัดเศษขอบอีก 2 ช่อง
      // (งานมาสคอตกว้างเท่าเดิม)
      const artW = Math.ceil(cols * cellW);
      const fx = cover && availW < CENTER_BELOW ? 0.5 : focusX;
      const left = cover && availH ? Math.round(fx * availW - ART_CX * artW) : 0;
      totalCols =
        cover && availH
          ? Math.max(cols, Math.ceil((availW - left) / cellW) + 2)
          : cols;
      const w = Math.ceil(totalCols * cellW);
      const h = Math.ceil(rows * cellH);

      el.width = Math.ceil(w * dpr);
      el.height = Math.ceil(h * dpr);

      if (cover && availH) {
        // กึ่งกลางงาน (ตำแหน่งมาสคอต) อยู่ที่ focusX × ความกว้าง container
        // จอมือถือ/แท็บเล็ตใช้กึ่งกลางจอ — ฝั่งการ์ดก็อยู่กลางจอเช่นกัน
        el.style.position = "absolute";
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;
        el.style.left = `${left}px`;
        el.style.top = `${Math.round((availH - h) / 2)}px`;
      } else {
        el.style.position = "";
        el.style.width = "";
        el.style.height = `${h}px`;
        el.style.left = "";
        el.style.top = "";
      }

      plasma.width = el.width;
      plasma.height = el.height;
      arms.width = el.width;
      arms.height = el.height;
      lastPlasma = -1e9; // บังคับรีวาดพลาสมาหลัง resize

      base.width = el.width;
      base.height = el.height;
      const b = base.getContext("2d");
      if (!b) return;
      b.clearRect(0, 0, base.width, base.height);
      b.scale(dpr, dpr);
      b.font = cx.font;
      b.textBaseline = "alphabetic";
      b.lineJoin = "round";
      // ขอบเข้มรอบตัวอักษรมาสคอต — แยกมาสคอตออกจากพลาสมาโดยไม่ต้องกินพื้นที่
      b.lineWidth = Math.max(2.5, fontSize * 0.24);
      b.strokeStyle = "rgba(11,15,26,0.95)";
      armRows = new Map();
      for (let y = 0; y < rows; y++) {
        const line = lines[y];
        for (let x = 0; x < line.length; x++) {
          const ch = line[x];
          // ข้ามพื้นหลัง @ และช่องว่าง — ให้พลาสมาโผล่มาแทน
          if (ch === " " || ch === "@") continue;
          const glow = 1 - (INK_LEVEL[ch] ?? DEFAULT_INK);
          const fill = lerpColor(glow);
          b.strokeText(ch, x * cellW, (y + 0.82) * cellH);
          b.globalAlpha = 1;
          b.fillStyle = fill;
          b.fillText(ch, x * cellW, (y + 0.82) * cellH);
          if (y >= TENTACLE_START) {
            const row = armRows.get(y);
            if (row) row.push({ ch, x, fill });
            else armRows.set(y, [{ ch, x, fill }]);
            lastInkRow = y;
          }
        }
      }
      b.globalAlpha = 1;
      drawArms();
    }

    /** หรี่พลาสมาลงนุ่ม ๆ เฉพาะโซนมาสคอต (ยังเห็นเท็กซ์เจอร์ ไม่โล่ง)
     *  คืนค่า 0–1 คูณกับ alpha ปกติ */
    function plasmaDim(x: number, y: number): number {
      const ddx = (x - cols * 0.5) / (cols * 0.34);
      const ddy = (y - rows * 0.56) / (rows * 0.8);
      return 1 - 0.5 * Math.exp(-(ddx * ddx + ddy * ddy));
    }

    /** รีวาดพื้นหลังพลาสมาทั้งกริด (เรียกเป็นระยะ ไม่ใช่ทุกเฟรม) */
    function drawPlasma(tp: number) {
      pb.setTransform(1, 0, 0, 1, 0, 0);
      pb.clearRect(0, 0, plasma.width, plasma.height);
      pb.scale(dpr, dpr);
      pb.font = cx.font;
      pb.textBaseline = "alphabetic";
            for (let y = 0; y < rows; y++) {
        for (let x = 0; x < totalCols; x++) {
          const v = plasmaValue(x, y, tp);
          // ยกพื้นความสว่างต่ำสุด: ข้ามอักขระ 2 ตัวมืดสุดของราง
          // เพื่อให้ทุกช่องมีเท็กซ์เจอร์เสมอ ไม่มีโซนมองไม่เห็น
          const idx =
            2 +
            Math.min(
              PLASMA_RAMP.length - 3,
              Math.floor(v * (PLASMA_RAMP.length - 2)),
            );
          const ch = PLASMA_RAMP[idx];
          pb.globalAlpha = (0.34 + v * 0.38) * plasmaDim(x, y);
          pb.fillStyle = plasmaColor(v);
          pb.fillText(ch, x * cellW, (y + 0.82) * cellH);
        }
      }
      pb.globalAlpha = 1;
    }

    /** ค่าพลาสมา 0–1 ที่ช่อง (x,y) เวลา tp — คลื่น sin ซ้อน 4 ชั้น */
    function plasmaValue(x: number, y: number, tp: number): number {
      const v =
        Math.sin(x * 0.085 + tp * 0.9) +
        Math.sin(y * 0.16 - tp * 0.6) +
        Math.sin(x * 0.045 + y * 0.075 + tp * 0.45) +
        Math.sin(Math.hypot(x - cols / 2, y - rows / 2) * 0.2 - tp * 1.1);
      return 0.5 + 0.5 * (v / 4);
    }

    /** วาดเลเยอร์หนวดใหม่ทั้งชั้น — เรียกเฉพาะตอนก้าวจังหวะ ไม่ใช่ทุกเฟรม
     *  ใช้แบบ "ดึงจากแถวต้นทาง" (pull): ทุกแถวปลายทางมีตัวอักษรวางอยู่เสมอ
     *  การเลื่อนทั้งแถวไปวางในช่องใหม่ (push) ทำให้บางแถวว่างและแถวเดียวกัน
     *  แตกเป็นสองแถว เห็นเป็นรอยขาด/ช่องว่าง โดยเฉพาะฟอนต์ใหญ่บนจอคอม
     *  ผลข้างเคียงคือบางแถวต้นฉบับถูกใช้ซ้ำหรือถูกข้าม = หนวดดูบีบ-ยืด */
    function drawArms() {
      ab.setTransform(1, 0, 0, 1, 0, 0);
      ab.clearRect(0, 0, arms.width, arms.height);
      ab.scale(dpr, dpr);
      ab.font = cx.font;
      ab.textBaseline = "alphabetic";
      ab.lineJoin = "round";
      ab.lineWidth = Math.max(2.5, fontSize * 0.24);
      ab.strokeStyle = "rgba(11,15,26,0.95)";
      const span = Math.max(1, lastInkRow - TENTACLE_START);
      for (let yd = TENTACLE_START; yd <= lastInkRow; yd++) {
        const depth = yd - TENTACLE_START;
        const k = depth / span;
        // โคน (k≈0) อยู่กับที่ ปลาย (k≈1) สะบัดได้ ±3 ช่องและบีบ-ยืดได้ ±1 แถว
        const src = Math.min(
          lastInkRow,
          Math.max(
            TENTACLE_START,
            yd + Math.round(Math.sin(step * 0.42 - depth * 0.55 + 1.1) * 1.5 * k),
          ),
        );
        const sway = Math.sin(step * 0.5 - depth * 0.6) * 2.6 * (0.12 + k * 0.88);
        for (const g of armRows.get(src) ?? EMPTY_GLYPHS) {
          const gx = (g.x + Math.round(sway)) * cellW;
          const gy = (yd + 0.82) * cellH;
          ab.strokeText(g.ch, gx, gy);
          ab.fillStyle = g.fill;
          ab.fillText(g.ch, gx, gy);
        }
      }
    }

    function drawStatic() {
      cx.clearRect(0, 0, el.width, el.height);
      cx.drawImage(plasma, 0, 0, el.width, el.height);
      cx.drawImage(base, 0, 0);
    }

    function frame(now: number) {
      const t = now / 1000;
      cx.clearRect(0, 0, el.width, el.height);

      /* หนวดก้าวเป็น "เฟรม" ช้า ๆ: ขยับเฉพาะเลเยอร์หนวด ไม่ไหลตามเวลาต่อเนื่อง */
      if (now - lastStep >= TENTACLE_TICK_MS) {
        lastStep = now;
        step++;
        drawArms();
      }

      /* พลาสมา: รีวาดเป็นระยะ (ไม่ใช่ทุกเฟรม) */
      if (now - lastPlasma > PLASMA_REFRESH_MS) {
        drawPlasma(t * 0.55);
        lastPlasma = now;
      }
      cx.drawImage(plasma, 0, 0);

      /* เอฟเฟกต์คลื่นแสง/แถบ scan เกิดกับ "พลาสมาเท่านั้น" (ก่อนวาดมาสคอต)
         เพื่อไม่ให้คลื่นไปบัง/จางตัวมาสคอต */
      // คลื่นแสงม่วงวิ่งทแกงผ่านพื้นหลัง
      const wavePeriod = 7;
      const wavePos = ((t % wavePeriod) / wavePeriod) * 2 - 0.5;
      const g1 = cx.createLinearGradient(
        wavePos * el.width - el.width * 0.35,
        -el.height * 0.2,
        wavePos * el.width + el.width * 0.35,
        el.height * 1.2,
      );
      g1.addColorStop(0, "rgba(139,92,246,0)");
      g1.addColorStop(0.5, "rgba(139,92,246,0.22)");
      g1.addColorStop(1, "rgba(139,92,246,0)");
      cx.globalCompositeOperation = "source-atop";
      cx.fillStyle = g1;
      cx.fillRect(0, 0, el.width, el.height);

      // แถบ scan แคบ ๆ วิ่งวนลงล่าง
      const scanH = el.height * 0.06;
      const scanY = ((t * 0.11) % 1.2) * el.height - scanH;
      const g2 = cx.createLinearGradient(0, scanY, 0, scanY + scanH);
      g2.addColorStop(0, "rgba(224,216,254,0)");
      g2.addColorStop(0.5, "rgba(224,216,254,0.26)");
      g2.addColorStop(1, "rgba(224,216,254,0)");
      cx.fillStyle = g2;
      cx.fillRect(0, Math.max(0, scanY), el.width, scanH);
      cx.globalCompositeOperation = "source-over";

      /* มาสคอต: หัว-ลำตัวจากก้อนคงที่ + เลเยอร์หนวดที่วาดใหม่ทุกจังหวะ */
      const bodyH = (el.height / rows) * TENTACLE_START;
      cx.drawImage(base, 0, 0, base.width, bodyH, 0, 0, base.width, bodyH);
      cx.drawImage(arms, 0, 0);

      raf = requestAnimationFrame(frame);
    }

    /** เริ่มระบบวาด (rebuild จาก resize ไม่รีเซ็ตอะไร — ไม่มีอนิเมชันเปิด) */
    function begin() {
      cancelAnimationFrame(raf);
      build();
      drawPlasma(0);
      if (reduceMotion) {
        drawStatic();
        return;
      }
      raf = requestAnimationFrame(frame);
    }

    // วาดครั้งแรกเมื่อฟอนต์โหลดแล้ว (ไม่งั้นวัดความกว้างผิด)
    const font = (document as unknown as { fonts?: FontFaceSet }).fonts;
    if (font?.status === "loaded" || !font) {
      begin();
    } else {
      font.ready.then(begin);
    }

    // ขนาด container เปลี่ยนจริง ๆ เท่านั้น → สร้าง base ใหม่ (ไม่รีเซ็ตอนิเมชัน)
    ro = new ResizeObserver(() => {
      const rect = el.parentElement?.getBoundingClientRect();
      const w = rect?.width ?? 0;
      const h = rect?.height ?? 0;
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      build();
      drawPlasma(0);
      if (reduceMotion) drawStatic();
    });
    if (el.parentElement) {
      const rect = el.parentElement.getBoundingClientRect();
      lastW = rect.width;
      lastH = rect.height;
      ro.observe(el.parentElement);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [text, cover, focusX]);

  return (
    <canvas
      ref={canvasRef}
      className={`block w-full font-mono ${className}`}
      aria-label="ASCII octopus artwork with plasma background"
      role="img"
    />
  );
}