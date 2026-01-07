import { NextResponse } from "next/server";

const SHEET_API_URL =
  "https://script.google.com/macros/s/AKfycby9PkqDMYO9Wfivz7B-2GRXoEPoZGvMaOYxnAGQV7B9b4TQ1RjTV7E2BeUyuUDJn9fK/exec";

/** 把 JSONP 包裝的字串轉成 JSON（也支援純 JSON 或 {data:[...]}） */
function parseMaybeJSONP(text: string) {
  // 嘗試純 JSON
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.data)) return parsed.data;
    return parsed;
  } catch (_) {}

  // 嘗試 callback([...]) 格式
  const match = text.match(/\[(.|\s)*\]/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (_) {}
  }

  // 若仍無法解析，回傳空陣列（避免前端報錯）
  return [];
}

/** 取得報名資料 */
export async function GET() {
  try {
    const res = await fetch(SHEET_API_URL, { cache: "no-store" });
    const text = await res.text();
    const data = parseMaybeJSONP(text);

    console.log("✅ [Proxy] 取得資料筆數:", Array.isArray(data) ? data.length : "非陣列");

    return NextResponse.json(data);
  } catch (err) {
    console.error("❌ Proxy GET error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

/** 寫入報名資料 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const res = await fetch(SHEET_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    const data = parseMaybeJSONP(text);

    console.log("✅ [Proxy] 已送出報名資料:", body);

    return NextResponse.json(data);
  } catch (err) {
    console.error("❌ Proxy POST error:", err);
    return NextResponse.json({ error: err?.message ?? "POST failed" }, { status: 500 });
  }
}
