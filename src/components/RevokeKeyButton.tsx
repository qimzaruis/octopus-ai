"use client";

import { useRef, useState } from "react";
import { revokeKeyAction } from "@/app/(app)/keys/actions";
import { ConfirmDialog } from "@/components/Dialog";
import { useT } from "@/lib/i18n/client";
import Icon from "@/components/Icon";

export default function RevokeKeyButton({
  keyId,
  keyName,
}: {
  keyId: number;
  keyName: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <form action={revokeKeyAction}>
        <input type="hidden" name="keyId" value={keyId} />
        <button
          ref={btnRef}
          type="button"
          className="btn-danger !py-2"
          onClick={() => setOpen(true)}
        >
          <Icon name="fa-ban" /> {t("ยกเลิก")}
        </button>
      </form>
      <ConfirmDialog
        open={open}
        title={t("ยกเลิก API Key")}
        message={t('ยกเลิกคีย์ "{name}" ? การกระทำนี้ไม่สามารถย้อนกลับได้', { name: keyName })}
        confirmLabel={t("ยกเลิกคีย์")}
        cancelLabel={t("กลับ")}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          btnRef.current?.closest("form")?.requestSubmit();
        }}
      />
    </>
  );
}
