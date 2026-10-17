import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Msg = {
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: { name: string; type: string; dataUrl: string }[];
};

export async function POST(req: NextRequest) {
  const { messages, model } = (await req.json()) as {
    messages: Msg[];
    model?: string;
  };

  const apiKey = process.env.OPENAI_API_KEY;

  // สร้าง messages ให้เข้ากับ OpenAI chat completions (รองรับ vision สำหรับรูป)
  const openaiMessages = messages.map((m) => {
    if (m.role === "user" && m.attachments && m.attachments.length > 0) {
      const parts: any[] = [{ type: "text", text: m.content || "" }];
      for (const a of m.attachments) {
        if (a.type.startsWith("image/")) {
          parts.push({ type: "image_url", image_url: { url: a.dataUrl } });
        } else {
          parts.push({ type: "text", text: `\n[แนบไฟล์: ${a.name}]` });
        }
      }
      return { role: m.role, content: parts };
    }
    return { role: m.role, content: m.content };
  });

  if (!apiKey) {
    // โหมดไม่มี key: ส่งข้อความเดโมแบบ stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const text =
          "นี่คือโหมด Playground เดโม — ยังไม่ได้ตั้งค่า OPENAI_API_KEY ฝั่งเซิร์ฟเวอร์\n\n" +
          "เพื่อใช้งานจริง ให้ตั้งค่า OPENAI_API_KEY (หรือเชื่อม gateway ของคุณ) ใน .env.local แล้วรีสตาร์ท\n\n" +
          "ข้อความล่าสุดของคุณ: " +
          (messages[messages.length - 1]?.content || "(ไม่มีข้อความ)");
        for (const ch of text) {
          controller.enqueue(encoder.encode(ch));
          await new Promise((r) => setTimeout(r, 8));
        }
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || "gpt-4o-mini",
      messages: openaiMessages,
      stream: true,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const err = await upstream.text();
    return new Response(`Upstream error: ${err}`, { status: 502 });
  }

  // ส่งต่อ SSE → ดึงเฉพาะ delta.content
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) controller.enqueue(encoder.encode(delta));
          } catch {
            // ignore
          }
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}