import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Layout ของโหมดแชท (Web Agent) — เต็มหน้าจอ ไม่มี sidebar หลักของแอป
 * sidebar ในโหมดนี้เป็นของ Agent เอง (ประวัติแชท/เมนูแชท)
 */
export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  if (user.banned) redirect("/banned");
  return <>{children}</>;
}