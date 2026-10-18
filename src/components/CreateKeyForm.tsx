"use client";

import { useState } from "react";
import { createKeyAction, type CreateKeyState } from "@/app/(app)/keys/actions";
import { useT } from "@/lib/i18n/client";
import Icon from "@/components/Icon";

export default function CreateKeyForm({
  remaining,
  maxKeys,
}: {
  remaining: number;
  maxKeys: number;
}) {
  const t = useT();
  const [state, setState] = useState<CreateKeyState>({});
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setState({});
    const result = await createKeyAction(name);
    setState(result);
    if (result.ok) setName("");
    setPending(false);
  }

  async function copySecret() {
    if (!state.secret) return;
    await navigator.clipboard.writeText(state.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      {state.secret && (
        <div className="rounded-xl border border-leaf/30 bg-leaf/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-leaf">
            <Icon name="fa-circle-check" /> {t("สร้างคีย์สําเร็จ — คัดลอกไปเก็บไว้เลย")}
          </p>
          <p className="mt-1 text-xs text-leaf/70">
            {t("คีย์เต็มจะแสดงเพียงครั้งเดียวเท่านั้น หากลืมจะต้องสร้างใหม่")}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-ink-950 px-3 py-2.5 font-mono text-xs text-fg">
              {state.secret}
            </code>
            <button onClick={copySecret} className="btn-ghost !py-2.5">
              {copied ? (
                <>
                  <Icon name="fa-check" className="text-leaf" /> {t("คัดลอกแล้ว")}
                </>
              ) : (
                <>
                  <Icon name="fa-copy" /> {t("คัดลอก")}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {state.error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          <Icon name="fa-circle-exclamation" className="mr-2" />
          {state.error}
        </p>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("ชื่อคีย์ เช่น Development, Production")}
          className="input flex-1"
          maxLength={40}
          disabled={remaining === 0 || pending}
        />
        <button
          type="submit"
          className="btn-primary whitespace-nowrap"
          disabled={remaining === 0 || pending}
        >
          {pending ? (
            <Icon name="fa-circle-notch" className="animate-spin" />
          ) : (
            <Icon name="fa-plus" />
          )}
          {t("สร้างคีย์ใหม่")}
        </button>
      </form>

      {remaining === 0 && (
        <p className="text-xs text-amber-glow">
          <Icon name="fa-circle-info" className="mr-1.5" />
          {t("คุณมีคีย์ครบ {max} คีย์แล้ว — ยกเลิกคีย์เดิมก่อนจึงจะสร้างใหม่ได้", { max: maxKeys })}
        </p>
      )}
    </div>
  );
}
