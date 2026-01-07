import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "chat-messages.json");

interface ChatMessage {
  text: string;
  nickname?: string;
  avatar?: string;
  createdAt: string;
}

async function loadMessages(): Promise<ChatMessage[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch (e: any) {
    if (e && e.code === "ENOENT") return [];
    console.error("讀取聊天室訊息檔案失敗", e);
    return [];
  }
}

async function saveMessages(messages: ChatMessage[]) {
  const dir = path.dirname(DATA_FILE);
  await fs.mkdir(dir, { recursive: true });
  const limited = messages.slice(-200); // 最多保留最近 200 則
  await fs.writeFile(DATA_FILE, JSON.stringify(limited, null, 2), "utf8");
}

export async function GET(_req: NextRequest) {
  const messages = await loadMessages();
  return NextResponse.json(messages);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const nickname = typeof body.nickname === "string" ? body.nickname : undefined;
    const avatar = typeof body.avatar === "string" ? body.avatar : undefined;

    if (!text) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const newMessage: ChatMessage = {
      text,
      nickname,
      avatar,
      createdAt: new Date().toISOString(),
    };

    const messages = await loadMessages();
    messages.push(newMessage);
    await saveMessages(messages);

    return NextResponse.json(newMessage, { status: 201 });
  } catch (e: any) {
    console.error("儲存聊天室訊息失敗", e);
    return NextResponse.json({ error: e?.message ?? "Failed to save message" }, { status: 500 });
  }
}
