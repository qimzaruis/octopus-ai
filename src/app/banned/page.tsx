import Link from "next/link";
import Logo from "@/components/Logo";
import { getSessionUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function BannedPage() {
  const user = await getSessionUser();
  const t = await getT();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-950 px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-rose-500/10 text-rose-300">
          <Icon name="fa-ban" className="text-lg" />
        </div>
        <h1 className="mt-6 font-display text-h2 font-semibold text-fg">{t("บัญชีถูกระงับ")}</h1>
        <p className="mt-3 text-body-sm leading-relaxed text-fg-muted">
          {t("บัญชีนี้ถูกระงับการใช้งานชั่วคราว หากคิดว่าเป็นความผิดพลาด กรุณาติดต่อทีมงานเพื่อตรวจสอบ")}
        </p>

        {user?.bannedReason && (
          <p className="mt-5 rounded-xl bg-rose-500/10 px-4 py-3 text-caption text-rose-300">
            <Icon name="fa-circle-info" className="mr-1.5" />
            {t("เหตุผล:")} {user.bannedReason}
          </p>
        )}

        <div className="mt-8 flex flex-col items-center gap-3">
          <a href="/auth/signout" className="btn-secondary w-full !py-3 text-body-sm sm:w-auto">
            <Icon name="fa-arrow-right-from-bracket" className="text-label" /> {t("ออกจากระบบ")}
          </a>
          <Link
            href="/"
            className="text-caption text-fg-subtle underline-offset-2 hover:text-fg hover:underline"
          >
            {t("หน้าแรก")}
          </Link>
        </div>

        <div className="mt-10 flex items-center justify-center gap-2 opacity-60">
          <Logo size={22} />
          <span className="text-caption font-semibold text-fg">Octopus AI</span>
        </div>
      </div>
    </div>
  );
}