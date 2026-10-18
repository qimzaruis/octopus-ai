import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import Badge from "@/components/Badge";
import { getT } from "@/lib/i18n/server";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if (user.role !== "admin") redirect("/dashboard");

  const t = await getT();

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 rounded-xl bg-pulse/[0.08] px-5 py-4 ring-1 ring-inset ring-pulse/20 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pulse/15 text-pulse">
            <Icon name="fa-user-shield" />
          </span>
          <div>
            <p className="text-sm font-semibold text-fg">{t("โหมดผู้ดูแลระบบ")}</p>
            <p className="mt-0.5 text-xs text-fg-subtle">
              {t("คุณกําลังดูภาพรวมและตั้งค่าของทั้งระบบ")}
            </p>
          </div>
        </div>
        <Badge tone="pulse" icon="fa-solid fa-triangle-exclamation" className="self-start sm:self-auto">
          {t("การเปลี่ยนแปลงมีผลกับทุกผู้ใช้")}
        </Badge>
      </div>

      {children}
    </div>
  );
}