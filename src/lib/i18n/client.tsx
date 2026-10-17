"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "./config";
import { translate, type TVars } from "./translate";

/**
 * ฝั่ง client รับ locale มาจาก server ทาง prop ตัวเดียว (ไม่ต้องมี state)
 * เพราะการเปลี่ยนภาษาทําผ่าน cookie + refresh หน้าทั้งหน้า จึงไม่มีสองแหล่งความจริง
 * ให้เพี้ยนกันระหว่าง server-render กับ client-render
 */
const LocaleContext = createContext<Locale | null>(null);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** อ่าน locale ปัจจุบัน (ไม่แปล) — ใช้เมื่อต้องส่งต่อหรือเทียบค่า */
export function useLocale(): Locale {
  const ctx = useContext(LocaleContext);
  // ถ้าไม่มี provider (เช่น component ถูกใช้ลอย ๆ) ให้ถือว่าไทย ซึ่งเป็นค่าเริ่มต้นของเว็บ
  return ctx ?? "th";
}

/** คืนฟังก์ชันแปล — ใช้แบบเดียวกับ t() ฝั่ง server */
export function useT() {
  const locale = useLocale();
  return useMemo(
    () => (text: string, vars?: TVars) => translate(locale, text, vars),
    [locale],
  );
}