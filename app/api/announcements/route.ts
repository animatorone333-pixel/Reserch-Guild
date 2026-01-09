import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const hasSupabase = SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";

const supabase = hasSupabase
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

/**
 * GET /api/announcements
 * 取得當前公告內容
 */
export async function GET() {
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase 未設定" },
      { status: 500 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .eq("id", 1)
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data,
    });
  } catch (error: any) {
    console.error("❌ 讀取公告失敗:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || "讀取公告失敗" 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/announcements
 * 更新公告內容
 * Body: { content: string, updatedBy?: string }
 */
export async function POST(request: Request) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase 未設定" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { content, updatedBy = "admin" } = body;

    if (typeof content !== "string") {
      return NextResponse.json(
        { error: "content 必須是字串" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("announcements")
      .update({ 
        content,
        updated_by: updatedBy,
      })
      .eq("id", 1)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data,
      message: "公告更新成功",
    });
  } catch (error: any) {
    console.error("❌ 更新公告失敗:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || "更新公告失敗" 
      },
      { status: 500 }
    );
  }
}
