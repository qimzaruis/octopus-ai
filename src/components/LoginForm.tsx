"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/config";
import { useT } from "@/lib/i18n/client";
import Icon from "@/components/Icon";

/**
 * demoMode รับเป็น prop จาก server (ไม่ประเมิน isDemoMode ฝั่ง client
 * เพราะค่านั้นอ้าง process.env.DATABASE_URL ซึ่งมีแค่ฝั่ง server)
 */
export default function LoginForm({
  nextPath,
  demoMode,
}: {
  nextPath: string;
  demoMode: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const [loading, setLoading] = useState<"google" | "demo-user" | "demo-admin" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  async function signInWithGoogle() {
    if (!accepted) return;
    setLoading("google");
    setError(null);
    try {
      const supabase = createClient();
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (err) {
        setError(t("เชื่อมต่อ Google ไม่สําเร็จ กรุณาลองใหม่"));
        setLoading(null);
      }
    } catch {
      setError(t("เกิดข้อผิดพลาดในการเข้าสู่ระบบ"));
      setLoading(null);
    }
  }

  function demoLogin(role: "user" | "admin") {
    if (!accepted) return;
    const key = role === "admin" ? "demo-admin" : "demo-user";
    setLoading(key);
    router.push(`/auth/demo?role=${role}`);
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
          <Icon name="fa-circle-exclamation" className="mr-2" />
          {error}
        </p>
      )}

      {supabaseConfigured ? (
        <button
          onClick={signInWithGoogle}
          disabled={loading !== null || !accepted}
          className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-ink-950 shadow-lg transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading === "google" ? (
            <Icon name="fa-circle-notch" className="animate-spin" />
          ) : (
            <Icon name="fa-google" className="text-base" />
          )}
          {t("ดําเนินการต่อด้วย Google")}
        </button>
      ) : (
        <button disabled className="btn-primary w-full !py-3.5 opacity-40">
          <Icon name="fa-google" />
          {t("ดําเนินการต่อด้วย Google")}
        </button>
      )}

      {!accepted && (
        <p className="text-center text-micro text-fg-subtle">
          <Icon name="fa-lock" className="mr-1.5" />
          {t("ติ๊กยอมรับข้อกําหนดเพื่อปลดล็อกการเข้าสู่ระบบ")}
        </p>
      )}

      {!supabaseConfigured && (
        <p className="rounded-xl border border-amber-glow/20 bg-amber-glow/5 px-3.5 py-3 text-label leading-relaxed text-amber-glow/80">
          <Icon name="fa-circle-info" className="mr-1.5" />
          {t("ตั้งค่า")}{" "}
          <code className="rounded bg-black/30 px-1.5 py-0.5 text-amber-glow">
            NEXT_PUBLIC_SUPABASE_URL
          </code>{" "}
          {t("ใน .env.local เพื่อเปิด Google Sign-in")}
        </p>
      )}

      {/* ปุ่ม Demo แสดงเฉพาะตอนรันในโหมด Demo — ในโหมดจริงไม่มีทางลัดเข้าระบบ */}
      {demoMode && (
        <>
          <div className="flex items-center gap-3 py-2">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-fg-subtle">{t("หรือทดลองใช้โหมด Demo")}</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <button
            onClick={() => demoLogin("user")}
            disabled={loading !== null || !accepted}
            className="btn-ghost w-full !py-3"
          >
            {loading === "demo-user" ? (
              <Icon name="fa-circle-notch" className="animate-spin" />
            ) : (
              <Icon name="fa-user" />
            )}
            {t("เข้าสู่ระบบเป็นผู้ใช้ทั่วไป")}
          </button>
          <button
            onClick={() => demoLogin("admin")}
            disabled={loading !== null || !accepted}
            className="btn-ghost w-full !py-3"
          >
            {loading === "demo-admin" ? (
              <Icon name="fa-circle-notch" className="animate-spin" />
            ) : (
              <Icon name="fa-user-shield" />
            )}
            {t("เข้าสู่ระบบเป็นแอดมิน")}
          </button>
        </>
      )}

      {/* checkbox ยอมรับข้อกําหนด — อยู่ใต้ปุ่มเข้าสู่ระบบ บังคับก่อนกดได้จริง */}
      <label className="mt-4 flex cursor-pointer items-start gap-2.5 border-t border-white/[0.07] px-1 pt-4 text-fg-muted">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-500"
        />
        <span className="text-caption leading-relaxed">
          {t("ฉันยอมรับ")}{" "}
          <Link
            href="/terms"
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-pulse-300 underline decoration-pulse-300/40 underline-offset-2 transition hover:text-pulse hover:decoration-pulse"
          >
            {t("ข้อกําหนดการใช้งาน")}
          </Link>{" "}
          {t("และ")}{" "}
          <Link
            href="/privacy"
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-pulse-300 underline decoration-pulse-300/40 underline-offset-2 transition hover:text-pulse hover:decoration-pulse"
          >
            {t("นโยบายความเป็นส่วนตัว")}
          </Link>
        </span>
      </label>
    </div>
  );
}