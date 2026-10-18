import type { Metadata } from "next";
import Badge from "@/components/Badge";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "ข้อกําหนดการใช้งาน — Octopus AI",
};

export default async function TermsPage() {
  const t = await getT();

  const SECTIONS: Array<{ title: string; paragraphs: string[] }> = [
    {
      title: "การยอมรับข้อกําหนด",
      paragraphs: [
        "การเข้าถึงหรือใช้งาน Octopus AI ถือว่าคุณได้อ่าน เข้าใจ และตกลงผูกพันตามข้อกําหนดฉบับนี้ หากไม่เห็นด้วยกับข้อใด โปรดหยุดการใช้งาน",
      ],
    },
    {
      title: "บัญชีผู้ใช้",
      paragraphs: [
        "คุณเข้าสู่ระบบผ่านบัญชี Google ของตนเอง และรับผิดชอบในการรักษาความปลอดภัยของบัญชี รวมถึงกิจกรรมทั้งหมดที่เกิดขึ้นภายใต้บัญชี ห้ามมอบสิทธิ์การใช้งานให้ผู้อื่นในลักษณะที่อาจก่อความเสียหาย",
      ],
    },
    {
      title: "การใช้งานที่อนุญาต",
      paragraphs: [
        "บริการนี้มีไว้เพื่องานที่ชอบด้วยกฎหมาย ห้ามใช้เพื่อสร้างหรือเผยแพร่เนื้อหาที่ผิดกฎหมาย ละเมิดสิทธิ์ของผู้อื่น หรือโจมตีระบบคอมพิวเตอร์ ทางเราอาจกําหนดขีดจํากัดการใช้งาน (rate limit) เพื่อรักษาความเสถียรของบริการ",
      ],
    },
    {
      title: "API Key และการเชื่อมต่อ",
      paragraphs: [
        "คุณสามารถสร้าง API key ของตัวเองได้สูงสุด 3 คีย์ต่อบัญชี และยกเลิกได้ทุกเมื่อ คีย์ของผู้ให้บริการโมเดล (provider) จะถูกเก็บฝั่ง server เท่านั้น หากพบว่าคีย์ของคุณรั่วไหล กรุณายกเลิกและสร้างคีย์ใหม่ทันที",
      ],
    },
    {
      title: "ค่าใช้จ่ายและเครดิต",
      paragraphs: [
        "ปริมาณการใช้งานวัดเป็น token ตามที่แสดงในแดชบอร์ด ค่าใช้จ่ายคิดตามอัตราของโมเดลและ provider ที่ระบบ routing เลือกใช้ โดยมี fallback อัตโนมัติเมื่อปลายทางมีปัญหา",
      ],
    },
    {
      title: "ความพร้อมใช้งาน",
      paragraphs: [
        "บริการให้ใช้งานในสภาพปัจจุบัน (as is) ระบบ fallback ช่วยลดผลกระทบจากปลายทางที่ล่ม แต่เราไม่รับประกันว่าบริการจะพร้อมใช้ต่อเนื่องปราศจากข้อผิดพลาด",
      ],
    },
    {
      title: "การระงับและยกเลิกบัญชี",
      paragraphs: [
        "หากพบการใช้งานที่ละเมิดข้อกําหนดนี้ ทางเราอาจระงับหรือยกเลิกบัญชีโดยแจ้งให้ทราบ คุณสามารถหยุดใช้งานได้ทุกเมื่อโดยไม่ต้องแจ้งล่วงหน้า",
      ],
    },
    {
      title: "การเปลี่ยนแปลงข้อกําหนด",
      paragraphs: [
        "ข้อกําหนดนี้อาจได้รับการปรับปรุงเป็นระยะ ฉบับล่าสุดจะเผยแพร่บนหน้านี้เสมอ การใช้งานต่อเนื่องหลังมีการปรับปรุงถือว่าคุณยอมรับฉบับใหม่",
      ],
    },
    {
      title: "การติดต่อ",
      paragraphs: [
        "หากมีคําถามเกี่ยวกับข้อกําหนดการใช้งาน สามารถติดต่อทีมสนับสนุนได้ผ่านช่องทางในหน้าเว็บไซต์",
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
            {t("ข้อกําหนดการใช้งาน")}
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