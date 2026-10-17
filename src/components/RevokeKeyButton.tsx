"use client";

import { revokeKeyAction } from "@/app/(app)/keys/actions";
import { useT } from "@/lib/i18n/client";

export default function RevokeKeyButton({
  keyId,
  keyName,
}: {
  keyId: number;
  keyName: string;
}) {
  const t = useT();
  return (
    <form
      action={revokeKeyAction}
      onSubmit={(e) => {
        if (!confirm(`ยกเลิกคีย์ "${keyName}" ? การกระทำนี้ไม่สามารถย้อนกลับได้`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="keyId" value={keyId} />
      <button type="submit" className="btn-danger !py-2">
        <i className="fa-solid fa-ban" /> {t("ยกเลิก")}
      </button>
    </form>
  );
}
