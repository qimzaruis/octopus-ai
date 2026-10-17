import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Sans_Thai, JetBrains_Mono } from "next/font/google";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./globals.css";
import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/client";
import { HTML_LANG } from "@/lib/i18n/config";

/**
 * ตัวอักษร: Space Grotesk (Latin) → IBM Plex Sans Thai (ไทย) → system
 *
 * ทําไมต้องมีสองตัว: Space Grotesk ไม่มี glyph ภาษาไทยเลย ถ้าไม่ประกาศฟอนต์ไทย
 * ตัวอักษรไทยจะตกไปใช้ฟอนต์ระบบ (Tahoma/Leelawadee) ซึ่งนํ้าหนัก/ความกว้างไม่ตรงกับ
 * ละติน ทําให้ข้อความไทย-อังกฤษปนกันดูกระโดด
 *
 * เลือก IBM Plex Sans Thai เพราะเป็น technical grotesque ชุดเดียวกับคอนเซปต์
 * "instrumentation" และเข้าคู่กับ Space Grotesk ได้แนบเนียน — จงใจไม่ใช้ Noto Sans Thai
 * ซึ่งเป็น "ค่าตั้งต้นโดยไม่คิด" ของงานไทย (เหมือน Inter ของงานละติน)
 */
const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
  display: "swap",
});

const thai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-thai",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Octopus AI — One Gateway to Every AI",
  description:
    "ศูนย์กลางเรียกใช้ AI ทุกโมเดลผ่าน API เดียว พร้อมแดชบอร์ดวิเคราะห์การใช้งาน จัดการ API key และ routing อัตโนมัติ",
  icons: { icon: "/logo.png", apple: "/logo.png" },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <html
      lang={HTML_LANG[locale]}
      data-scroll-behavior="smooth"
      className={`${grotesk.variable} ${thai.variable} ${mono.variable}`}
    >
      <body>
        {/* ส่ง locale จาก server ลงไปให้ client component ทั้งหมดผ่าน context เดียว
            ทําให้ useT() ฝั่ง client ได้ภาษาเดียวกับที่ render มา ไม่มี mismatch */}
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}