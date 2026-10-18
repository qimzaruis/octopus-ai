import { updateChatSettingsAction } from "@/app/(app)/admin/actions";
import { DEFAULT_CHAT_SETTINGS, getChatSettings } from "@/lib/chat/db";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import { getT } from "@/lib/i18n/server";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

/**
 * หน้า "ตั้งค่า Web Agent" — แอดมินกำหนดจำนวนไฟล์แนบสูงสุดต่อข้อความ
 * ค่าเก็บบน Turso (ตาราง chat_settings) ใช้ร่วมกับ API /api/agent/chat
 */
export default async function AdminChatPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const t = await getT();
  const [{ error, ok }, settings] = await Promise.all([
    searchParams,
    getChatSettings().catch(() => DEFAULT_CHAT_SETTINGS),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ตั้งค่า Web Agent")}
        description={t("กำหนดจำนวนไฟล์แนบสูงสุดต่อหนึ่งข้อความในโหมดแชท")}
        actions={
          <Badge tone="brand" icon="fa-solid fa-robot">
            {t("สูงสุด {n} ไฟล์", { n: settings.maxAttachments })}
          </Badge>
        }
      />

      {error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-body-sm text-rose-300">
          <Icon name="fa-circle-exclamation" className="mr-2" />
          {error}
        </p>
      )}
      {ok && (
        <p className="rounded-xl border border-leaf/30 bg-leaf/10 px-4 py-3 text-body-sm text-leaf">
          <Icon name="fa-circle-check" className="mr-2" />
          {t("บันทึกการตั้งค่าแล้ว")}
        </p>
      )}

      <div className="card p-5">
        <form action={updateChatSettingsAction} className="max-w-md space-y-4">
          <div>
            <label className="label">{t("จำนวนไฟล์แนบสูงสุดต่อข้อความ")}</label>
            <input
              name="maxAttachments"
              type="number"
              min="1"
              max="50"
              defaultValue={settings.maxAttachments}
              className="input tnum"
              required
            />
            <p className="mt-1.5 text-label text-fg-subtle">
              {t("ค่าที่ตั้งไว้ใช้ทั้งฝั่งหน้าจอและฝั่งเซิร์ฟเวอร์ (1–50)")}
            </p>
          </div>
          <div className="flex justify-end border-t border-white/[0.07] pt-4">
            <button type="submit" className="btn-primary">
              <Icon name="fa-floppy-disk" /> {t("บันทึก")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}