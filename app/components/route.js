import { NextResponse } from "next/server";

const SHEET_ID = "你的 Google Sheet ID";
const SHEET_NAME = "Shop"; // 工作表名稱
const API_KEY = process.env.GOOGLE_API_KEY;
const IMGUR_CLIENT_ID = process.env.IMGUR_CLIENT_ID;

// ✅ 把圖片轉為可用的 URL
async function uploadImage(file) {
  if (!file || typeof file !== "object" || !file.name) return "";
  const buffer = Buffer.from(await file.arrayBuffer());

  // 上傳到 Imgur
  if (IMGUR_CLIENT_ID) {
    const imgurRes = await fetch("https://api.imgur.com/3/image", {
      method: "POST",
      headers: { Authorization: `Client-ID ${IMGUR_CLIENT_ID}` },
      body: buffer,
    });
    const data = await imgurRes.json();
    return data?.data?.link || "";
  }

  // 若沒有 IMGUR_CLIENT_ID，就回傳 base64
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

// ✅ 讀取現有表單資料
async function getSheetData() {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}?key=${API_KEY}`
  );
  const json = await res.json();
  return json.values || [];
}

// ✅ 寫入 Google Sheet（更新或新增）
export async function POST(req) {
  try {
    const formData = await req.formData();
    const rows = [];
    for (let i = 0; i < 12; i++) {
      const name = formData.get(`item${i}_name`);
      const file = formData.get(`item${i}_image`);
      if (!name && !file) continue;
      const imageUrl = await uploadImage(file);
      rows.push([name || "", imageUrl]);
    }
    if (rows.length === 0)
      return NextResponse.json({ message: "無資料" }, { status: 400 });

    // 取得目前資料
    const currentData = await getSheetData();
    const headers = currentData[0] || ["名稱", "圖片"];
    const bodyRows = currentData.slice(1);

    const updateRequests = [];
    const newRows = [];

    // 檢查是否已有同名項目
    rows.forEach(([name, imageUrl]) => {
      const existingIndex = bodyRows.findIndex((r) => r[0] === name);
      if (existingIndex !== -1) {
        // 更新該行
        const rowNumber = existingIndex + 2; // +1 header, +1 index 起始
        updateRequests.push({
          range: `${SHEET_NAME}!A${rowNumber}:B${rowNumber}`,
          values: [[name, imageUrl]],
        });
      } else {
        // 新增
        newRows.push([name, imageUrl]);
      }
    });

    // 批次更新
    if (updateRequests.length > 0) {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchUpdate?key=${API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            valueInputOption: "RAW",
            data: updateRequests,
          }),
        }
      );
    }

    // 新增新資料
    if (newRows.length > 0) {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}!A:B:append?valueInputOption=RAW&key=${API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ values: newRows }),
        }
      );
    }

    // 重新讀取更新後資料回傳給前端
    const updatedData = await getSheetData();
    const dataObjects = updatedData.slice(1).map((r) => ({
      name: r[0],
      image: r[1],
    }));

    return NextResponse.json({
      success: true,
      updated: dataObjects,
    });
  } catch (error) {
    console.error("❌ CL4 API 錯誤：", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
