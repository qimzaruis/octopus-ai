import { getT } from "@/lib/i18n/server";

/**
 * สวิตช์เปิด/ปิด — กดแล้วส่ง form ไปที่ server action ทันที (ไม่ต้องใช้ JS ฝั่ง client)
 */
export default async function ToggleSwitch({
  action,
  id,
  enabled,
  extra = {},
  size = "md",
  titleOn,
  titleOff,
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: number;
  enabled: boolean;
  extra?: Record<string, string>;
  size?: "sm" | "md";
  titleOn?: string;
  titleOff?: string;
}) {
  const t = await getT();
  const onTitle = titleOn ?? t("คลิกเพื่อปิด");
  const offTitle = titleOff ?? t("คลิกเพื่อเปิด");

  const track = size === "sm" ? { height: 18, width: 34 } : { height: 22, width: 42 };
  const knobSize = size === "sm" ? 12 : 16;
  const knobShift = size === "sm" ? 18 : 22;

  return (
    <form action={action} className="inline-block">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="enabled" value={(!enabled).toString()} />
      {Object.entries(extra).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button
        type="submit"
        title={enabled ? onTitle : offTitle}
        aria-label={enabled ? onTitle : offTitle}
        role="switch"
        aria-checked={enabled}
        className={`relative inline-flex items-center rounded-full px-[3px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 ${
          enabled ? "bg-leaf/80" : "bg-white/10"
        }`}
        style={track}
      >
        <span
          className="inline-block rounded-full bg-white shadow transition-transform"
          style={{
            height: knobSize,
            width: knobSize,
            transform: enabled ? `translateX(${knobShift}px)` : "translateX(0)",
          }}
        />
      </button>
    </form>
  );
}
