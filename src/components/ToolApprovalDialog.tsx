"use client";

import { Dialog } from "@/components/Dialog";
import Icon from "@/components/Icon";
import { useT } from "@/lib/i18n/client";
import type { PendingAction } from "@/lib/agent/tools";

const PREVIEW_CHARS = 1400;

/**
 * กล่องขออนุญาตก่อนแตะไฟล์ในเครื่องผู้ใช้
 *
 * เอเจนต์ไม่ควรเขียนทับหรือลบไฟล์เงียบ ๆ จึงแสดง path + เนื้อหาที่จะเขียน
 * ให้ดูก่อน และปุ่ม "ปฏิเสธ" ทำให้รอบนั้นจบด้วยข้อความว่าผู้ใช้ไม่อนุญาต
 */
export default function ToolApprovalDialog({
  action,
  onDecision,
}: {
  action: PendingAction | null;
  onDecision: (approved: boolean) => void;
}) {
  const t = useT();
  const kind = action?.kind ?? "write";
  const title =
    kind === "delete"
      ? t("ลบไฟล์หรือโฟลเดอร์นี้?")
      : kind === "mkdir"
        ? t("สร้างโฟลเดอร์นี้?")
        : action?.append
          ? t("เขียนต่อท้ายไฟล์นี้?")
          : action?.overwrite
            ? t("เขียนทับไฟล์นี้?")
            : t("สร้างไฟล์ใหม่?");

  return (
    <Dialog
      open={Boolean(action)}
      onClose={() => onDecision(false)}
      title={title}
      icon={kind === "delete" ? "fa-triangle-exclamation" : "fa-folder-open"}
      iconTone={kind === "delete" ? "danger" : "brand"}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onDecision(false)}
            className="rounded-md px-3 py-1.5 text-caption text-fg-muted transition hover:bg-white/[0.07] hover:text-fg"
          >
            {t("ปฏิเสธ")}
          </button>
          <button
            type="button"
            onClick={() => onDecision(true)}
            className={`rounded-md px-3.5 py-1.5 text-caption font-medium text-white transition ${
              kind === "delete" ? "bg-rose-500 hover:bg-rose-600" : "bg-brand-500 hover:bg-brand-600"
            }`}
          >
            {kind === "delete" ? t("ลบเลย") : t("อนุญาต")}
          </button>
        </div>
      }
    >
      {action && (
        <div>
          <p className="flex items-center gap-2 break-all rounded-md bg-ink-950/60 px-3 py-2 font-mono text-caption text-fg">
            <Icon name={action.kind === "mkdir" ? "fa-folder-open" : "fa-file"} className="text-fg-subtle" />
            {action.path}
          </p>
          {action.kind === "delete" && (
            <p className="mt-3 text-caption leading-relaxed text-rose-300">
              {t("การลบย้อนกลับไม่ได้ — ถ้าเป็นโฟลเดอร์จะถูกลบทั้งโฟลเดอร์")}
            </p>
          )}
          {typeof action.content === "string" && action.content.length > 0 && (
            <>
              <p className="label mt-4">
                {t("เนื้อหาที่จะเขียน ({n} ตัวอักษร)", { n: action.content.length })}
              </p>
              <pre className="max-h-64 overflow-auto rounded-md bg-ink-950/60 p-3 text-micro leading-relaxed text-fg-muted">
                {action.content.slice(0, PREVIEW_CHARS)}
                {action.content.length > PREVIEW_CHARS ? "\n…" : ""}
              </pre>
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}
