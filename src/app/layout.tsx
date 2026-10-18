import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Thai, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/client";
import { HTML_LANG } from "@/lib/i18n/config";
import { siteUrl } from "@/lib/config";

/**
 * ตัวอักษร: IBM Plex Sans (Latin) → IBM Plex Sans Thai (ไทย) → system → JetBrains Mono
 *
 * ใช้ IBM Plex ทั้งชุด (Sans + Sans Thai) เพราะเป็น superfamily เดียวกัน — น้ําหนัก
 * ความกว้าง และสัดส่วนLatin/ไทยตรงกัน ข้อความไทย-อังกฤษปนกันจึงไม่กระโดด
 * และเข้ากับคอนเซปต์ "instrumentation" แบบ technical
 */
const latin = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-latin",
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

/**
 * viewport-fit=cover จำเป็นต่อให้ env(safe-area-inset-*) มีค่าจริงบนมือถือมีรอยบาก
 * ถ้าไม่ตั้ง ค่า inset จะเป็น 0 ตลอด → แถบปinned/composer ทับ home indicator
 * interactiveWidgets=resizes-content ให้หน้าแชทยก composer ขึ้นตอนคีย์บอร์ดมือถือเปิด
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0B0F1A",
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: "Octopus AI — One Gateway to Every AI",
  description:
    "ศูนย์กลางเรียกใช้ AI ทุกโมเดลผ่าน API เดียว พร้อมแดชบอร์ดวิเคราะห์การใช้งาน จัดการ API key และ routing อัตโนมัติ",
  icons: { icon: "/logo.png", apple: "/logo.png" },
  openGraph: {
    title: "Octopus AI — One Gateway to Every AI",
    description: "เรียกใช้ทุกโมเดล AI ผ่าน API เดียว พร้อมแดชบอร์ดและ routing อัตโนมัติ",
    url: siteUrl || undefined,
    siteName: "Octopus AI",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();

  return (
    <html
      lang={HTML_LANG[locale]}
      data-scroll-behavior="smooth"
      className={`${latin.variable} ${thai.variable} ${mono.variable}`}
    >
      <body>
        {/* ส่ง locale จาก server ลงไปให้ client component ทั้งหมดผ่าน context เดียว
            ทําให้ useT() ฝั่ง client ได้ภาษาเดียวกับที่ render มา ไม่มี mismatch */}
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}