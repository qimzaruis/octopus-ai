"use server";

import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "@/lib/i18n/config";

/**
 * เปลี่ยนภาษาแล้วบันทึกลง cookie
 *
 * ทําเป็น server action แทนการเขียน cookie จาก client เพราะ cookie ที่ตั้งจาก JS
 * ต้อง httpOnly=false และไม่ถูกส่งไปกับ RSC payload รอบถัดไปเสมอ — การตั้งฝั่ง server
 * ทําให้หน้าถัดไปที่ render รู้ locale ใหม่ทันทีโดยไม่ต้องมี flash ภาษาผิด
 *
 * เขียน cookie ไม่ได้บน Edge runtime บางกรณี จึงห่อ try/catch เพื่อไม่ให้ทั้งหน้า error
 */
export async function setLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  try {
    const store = await cookies();
    store.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: "lax",
    });
  } catch {
    // เงียบไว้ — ผู้ใช้ยังคงได้ภาษาที่เลือกในรอบถัดไปถ้า cookie ถูกเขียนได้
  }
}