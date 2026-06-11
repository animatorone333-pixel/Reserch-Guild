import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import * as os from "os";
import * as path from "path";

const LOCAL_DATA_FILE = path.join(process.cwd(), "data", "chat-messages.json");
const TMP_DATA_FILE = path.join(os.tmpdir(), "chat-messages.json");
let activeChatDataFile = LOCAL_DATA_FILE;

const isReadOnlyFsError = (error: any) =>
  ["EROFS", "EPERM", "EACCES"].includes(error?.code);

const getChatDataFileCandidates = () =>
  activeChatDataFile === LOCAL_DATA_FILE
    ? [LOCAL_DATA_FILE, TMP_DATA_FILE]
    : [TMP_DATA_FILE, LOCAL_DATA_FILE];

interface ChatMessage {
  text: string;
  nickname?: string;
  avatar?: string;
  createdAt: string;
}

async function loadMessages(): Promise<ChatMessage[]> {
  for (const filePath of getChatDataFileCandidates()) {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch (e: any) {
      if (e && e.code === "ENOENT") continue;
      if (isReadOnlyFsError(e)) continue;
      console.error("讀取聊天室訊息檔案失敗", e);
      return [];
    }
  }
  return [];
}

async function saveMessages(messages: ChatMessage[]) {
  const writeToFile = async (filePath: string) => {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    const limited = messages.slice(-200); // 最多保留最近 200 則
    await fs.writeFile(filePath, JSON.stringify(limited, null, 2), "utf8");
  };

  try {
    await writeToFile(activeChatDataFile);
    return;
  } catch (e: any) {
    if (!isReadOnlyFsError(e) || activeChatDataFile === TMP_DATA_FILE) {
      throw e;
    }
  }

  activeChatDataFile = TMP_DATA_FILE;
  await writeToFile(activeChatDataFile);
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
