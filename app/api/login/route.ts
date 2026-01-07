import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();

  console.log("收到登入資料：", body);

  return NextResponse.json({
    success: true,
    message: "登入成功",
    user: body,
  });
}

