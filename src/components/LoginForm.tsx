"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/config";
import { useT } from "@/lib/i18n/client";

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

  async function signInWithGoogle() {
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

  async function demoLogin(role: "user" | "admin") {
    const key = role === "admin" ? "demo-admin" : "demo-user";
    setLoading(key);
    router.push(`/auth/demo?role=${role}`);
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
          <i className="fa-solid fa-circle-exclamation mr-2" />
          {error}
        </p>
      )}

{supabaseConfigured ? (
        <button
          onClick={signInWithGoogle}
          disabled={loading !== null}
          className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-ink-950 shadow-lg transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading === "google" ? (
            <i className="fa-solid fa-circle-notch animate-spin" />
          ) : (
            <i className="fa-brands fa-google text-base" />
          )}
          {t("ดําเนินการต่อด้วย Google")}
        </button>
      ) : (
        <button disabled className="btn-primary w-full !py-3.5 opacity-40">
          <i className="fa-brands fa-google" />
          {t("ดําเนินการต่อด้วย Google")}
        </button>
      )}

      {!supabaseConfigured && (
        <p className="rounded-xl border border-amber-glow/20 bg-amber-glow/5 px-3.5 py-3 text-label leading-relaxed text-amber-glow/80">
          <i className="fa-solid fa-circle-info mr-1.5" />
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
            disabled={loading !== null}
            className="btn-ghost w-full !py-3"
          >
            {loading === "demo-user" ? (
              <i className="fa-solid fa-circle-notch animate-spin" />
            ) : (
              <i className="fa-solid fa-user" />
            )}
            {t("เข้าสู่ระบบเป็นผู้ใช้ทั่วไป")}
          </button>
          <button
            onClick={() => demoLogin("admin")}
            disabled={loading !== null}
            className="btn-ghost w-full !py-3"
          >
            {loading === "demo-admin" ? (
              <i className="fa-solid fa-circle-notch animate-spin" />
            ) : (
              <i className="fa-solid fa-user-shield" />
            )}
            {t("เข้าสู่ระบบเป็นแอดมิน")}
          </button>
        </>
      )}
    </div>
  );
}