import type { Metadata } from "next";
import Badge from "@/components/Badge";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "นโยบายความเป็นส่วนตัว — Octopus AI",
};

export default async function PrivacyPage() {
  const t = await getT();

  const SECTIONS: Array<{ title: string; paragraphs: string[] }> = [
    {
      title: "ข้อมูลที่เราเก็บ",
      paragraphs: [
        "ข้อมูลบัญชี: ชื่อ อีเมล และรูปโปรไฟล์ที่ได้จากการเข้าสู่ระบบด้วย Google",
        "บันทึกการใช้งาน: โมเดลที่เรียกใช้ จํานวน token latency สถานะ และเวลาของแต่ละ request เพื่อแสดงสถิติและค่าใช้จ่ายในแดชบอร์ด",
      ],
    },
    {
      title: "เนื้อหาที่ส่งผ่านระบบ",
      paragraphs: [
        "ข้อความและไฟล์ที่คุณส่งจะถูกส่งต่อไปยังผู้ให้บริการโมเดล AI เพื่อประมวลผลตามคําขอของคุณ เนื้อหาดังกล่าวอาจถูกเก็บเป็นบันทึกชั่วคราวเพื่อการแก้ปัญหาเท่านั้น",
      ],
    },
    {
      title: "วิธีที่เราใช้ข้อมูล",
      paragraphs: [
        "ใช้เพื่อให้บริการ routing คิดค่าใช้จ่าย แสดงสถิติการใช้งาน และป้องกันการใช้งานในทางทุจริต เราไม่ขายข้อมูลส่วนบุคคลของคุณให้บุคคลที่สาม",
      ],
    },
    {
      title: "การแบ่งปันข้อมูล",
      paragraphs: [
        "ข้อมูลถูกส่งต่อเฉพาะผู้ให้บริการโมเดลที่จําเป็นต่อการประมวลผลคําขอของคุณ และหน่วยงานที่กฎหมายกําหนดเท่านั้น",
      ],
    },
    {
      title: "การเก็บรักษาและความปลอดภัย",
      paragraphs: [
        "เราเก็บข้อมูลเท่าที่จําเป็นต่อการให้บริการ คีย์และข้อมูลที่อ่อนไหวเก็บฝั่ง server แบบเข้ารหัส และจํากัดการเข้าถึงเฉพาะผู้ที่จําเป็น",
      ],
    },
    {
      title: "คุกกี้",
      paragraphs: [
        "เว็บไซต์ใช้คุกกี้ที่จําเป็นเท่านั้น ได้แก่ session การเข้าสู่ระบบและการตั้งค่าภาษา ไม่มีคุกกี้โฆษณาหรือติดตามข้ามเว็บไซต์",
      ],
    },
    {
      title: "สิทธิ์ของคุณ",
      paragraphs: [
        "คุณสามารถขอเข้าถึง ส่งออก หรือลบข้อมูลและบัญชีของคุณได้ โดยติดต่อทีมสนับสนุนผ่านช่องทางในหน้าเว็บไซต์",
      ],
    },
    {
      title: "การแจ้งเปลี่ยนแปลง",
      paragraphs: [
        "นโยบายนี้อาจได้รับการปรับปรุงเป็นระยะ ฉบับล่าสุดจะเผยแพร่บนหน้านี้เสมอ",
      ],
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-ink-950">
      <SiteNav />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-6 py-14">
          <Badge tone="brand">Legal</Badge>
          <h1 className="mt-5 font-display text-h1 font-semibold text-fg">
            {t("นโยบายความเป็นส่วนตัว")}
          </h1>
          <p className="mt-3 text-caption text-fg-subtle">
            {t("ปรับปรุงล่าสุด: 17 ตุลาคม 2026")}
          </p>

          <div className="mt-10 space-y-8">
            {SECTIONS.map((s, i) => (
              <section key={s.title}>
                <h2 className="flex items-baseline gap-3 text-h3 font-semibold text-fg">
                  <span className="tnum text-caption text-pulse-300">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {t(s.title)}
                </h2>
                {s.paragraphs.map((p) => (
                  <p key={p} className="mt-2.5 text-body text-fg-muted">
                    {t(p)}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}