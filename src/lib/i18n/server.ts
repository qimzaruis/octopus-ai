import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { translate } from "./translate";

/**
 * อ่าน locale ปัจจุบันจาก cookie (ใช้ใน server component / server action)
 * ถ้าไม่มี cookie หรือค่าไม่ถูกต้อง → ใช้ค่าเริ่มต้น (ไทย) แทนการ throw
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * คืนฟังก์ชันแปลที่ผูก locale ไว้แล้ว สําหรับใช้ใน server component
 *   const t = await getT();
 *   <h1>{t("ภาพรวม")}</h1>
 */
export async function getT(): Promise<TFunc> {
  const locale = await getLocale();
  return (text: string, vars?: Record<string, string | number>) =>
    translate(locale, text, vars);
}

export type TFunc = (text: string, vars?: Record<string, string | number>) => string;