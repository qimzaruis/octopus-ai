import PlaygroundChat from "@/components/PlaygroundChat";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function PlaygroundPage() {
  const t = await getT();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-h1 font-semibold text-fg">Playground</h1>
        <p className="mt-1.5 text-body-sm text-fg-muted">
          {t("แชทกับ AI ได้ทันที รองรับการแนบไฟล์และรูปภาพ")}
        </p>
      </div>
      <PlaygroundChat />
    </div>
  );
}