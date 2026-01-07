import { NextResponse } from "next/server";

// ✅ 這是你的 Google Apps Script 網址（請確認結尾是 /exec）
const APP_SCRIPT_URL =
"https://script.google.com/macros/s/AKfycbzHpm50lTaUwFgL0KIbV22ynk4cWjdhu7EuMV-U8GEspjt_MkMzfw1tlphPbAlI0iwf/exec"
// === ✅ GET：讀取 Google Sheet 資料 ===
export async function GET() {
  try {
    const res = await fetch(APP_SCRIPT_URL, { cache: "no-store" });
    const text = await res.text();

    // 有時 Apps Script 回傳不是 JSON，因此要安全轉換
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.warn("⚠️ Apps Script 回傳非 JSON，原始內容：", text);
      data = [];
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("❌ 無法讀取 Google Sheet：", error);
    return NextResponse.json(
      { error: "讀取失敗", detail: error.message },
      { status: 500 }
    );
  }
}

// === ✅ POST：上傳資料到 Google Sheet ===
export async function POST(req) {
  try {
    const formData = await req.formData();
    const rows = [];

    for (let i = 0; i < 12; i++) {
      const name = formData.get(`item${i}_name`);
      const file = formData.get(`item${i}_image`);

      if (!name && !file) continue;

      let imageUrl = "";
      if (file && typeof file === "object" && file.name) {
        const buffer = Buffer.from(await file.arrayBuffer());
        imageUrl = `data:image/png;base64,${buffer.toString("base64")}`;
      }

      rows.push({ name, image: imageUrl });
    }

    // ✅ 傳送到 Google Apps Script（寫入 Sheet）
    const result = await fetch(APP_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rows),
    });

    const text = await result.text();
    console.log("📩 Google Script Response:", text);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ 上傳失敗：", error);
    return NextResponse.json(
      { error: "上傳失敗", detail: error.message },
      { status: 500 }
    );
  }
}
