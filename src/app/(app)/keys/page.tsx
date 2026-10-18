import { getSessionUser } from "@/lib/auth";
import { listApiKeys, MAX_KEYS_PER_USER } from "@/lib/data/keys";
import { getKeyUsage } from "@/lib/data/usage";
import CreateKeyForm from "@/components/CreateKeyForm";
import RevokeKeyButton from "@/components/RevokeKeyButton";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import { formatDateTime, formatNumber, formatUsd } from "@/lib/format";
import { getT, getLocale } from "@/lib/i18n/server";
import Icon from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function KeysPage() {
  const user = (await getSessionUser())!;
  const t = await getT();
  const locale = await getLocale();
  const [keys, usage] = await Promise.all([listApiKeys(user.id), getKeyUsage(user.id)]);
  const remaining = MAX_KEYS_PER_USER - keys.length;

  const totalSpend = [...usage.values()].reduce((s, u) => s + u.costUsd, 0);
  const totalTokens = [...usage.values()].reduce((s, u) => s + u.tokens, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="API Keys"
        description={t("คีย์สําหรับเรียก Octopus API — สร้างได้สูงสุด {n} คีย์ต่อบัญชี", { n: MAX_KEYS_PER_USER })}
        actions={
          <Badge tone={remaining === 0 ? "amber" : "brand"} icon="fa-solid fa-key">
            {t("{a}/{b} คีย์", { a: keys.length, b: MAX_KEYS_PER_USER })}
          </Badge>
        }
      />

      {/* สร้างคีย์ */}
      <section className="card p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <Icon name="fa-plus" className="text-white-400" />
          <h2 className="text-body-sm font-semibold text-fg">{t("สร้างคีย์ใหม่")}</h2>
        </div>
        <CreateKeyForm remaining={remaining} maxKeys={MAX_KEYS_PER_USER} />
      </section>

      {/* สรุปการใช้จ่ายรวมจากทุกคีย์ */}
      {keys.length > 0 && (
        <section className="card p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Icon name="fa-chart-simple" className="text-brand-400" />
            <h2 className="text-body-sm font-semibold text-fg">{t("สรุปการใช้งานจากทุกคีย์")}</h2>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-white/[0.04] p-4">
              <p className="text-caption text-fg-muted">{t("ค่าใช้จ่ายรวม")}</p>
              <p className="tnum mt-1 text-stat font-semibold text-fg">{formatUsd(totalSpend)}</p>
            </div>
            <div className="rounded-lg bg-white/[0.04] p-4">
              <p className="text-caption text-fg-muted">{t("Tokens รวม")}</p>
              <p className="tnum mt-1 text-stat font-semibold text-fg">
                {formatNumber(totalTokens)}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* รายการคีย์ */}
      <section className="space-y-3">
        <h2 className="text-caption font-semibold uppercase tracking-wider text-fg-subtle">
          {t("คีย์ที่ใช้งานอยู่")}
        </h2>

        {keys.length === 0 ? (
          <div className="card">
            <EmptyState
              icon="fa-solid fa-key"
              title={t("ยังไม่มีคีย์")}
              description={t("สร้างคีย์แรกของคุณจากช่องด้านบน แล้วนําไปใช้เรียก Octopus API ได้ทันที")}
            />
          </div>
        ) : (
          keys.map((k) => {
            const u = usage.get(k.id) ?? { requests: 0, tokens: 0, costUsd: 0 };
            return (
              <div key={k.id} className="card p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-center gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-300">
                      <Icon name="fa-key" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-fg">{k.name}</p>
                      <p className="mt-1 font-mono text-label text-fg-subtle">
                        {k.keyPrefix}••••••••••••
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <dl className="space-y-0.5 text-right text-label text-fg-subtle">
                      <div>
                        <dt className="inline">{t("สร้าง:")} </dt>
                        <dd className="inline text-fg-muted">{formatDateTime(k.createdAt, locale)}</dd>
                      </div>
                      <div>
                        <dt className="inline">{t("ใช้ล่าสุด:")} </dt>
                        <dd className="inline text-fg-muted">
                          {k.lastUsedAt ? formatDateTime(k.lastUsedAt, locale) : t("ยังไม่เคยใช้")}
                        </dd>
                      </div>
                    </dl>
                    <RevokeKeyButton keyId={k.id} keyName={k.name} />
                  </div>
                </div>

                {/* การใช้งานของคีย์นี้ */}
                <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/[0.07] pt-4">
                  <div>
                    <p className="text-label text-fg-subtle">Requests</p>
                    <p className="tnum mt-0.5 text-body-sm font-semibold text-fg">
                      {formatNumber(u.requests)}
                    </p>
                  </div>
                  <div>
                    <p className="text-label text-fg-subtle">Tokens</p>
                    <p className="tnum mt-0.5 text-body-sm font-semibold text-fg">
                      {formatNumber(u.tokens)}
                    </p>
                  </div>
                  <div>
                    <p className="text-label text-fg-subtle">{t("ค่าใช้จ่าย")}</p>
                    <p className="tnum mt-0.5 text-body-sm font-semibold text-amber-glow">
                      {formatUsd(u.costUsd)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}