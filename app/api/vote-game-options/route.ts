import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const hasSupabase = SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";

const supabase = hasSupabase
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export async function GET(request: Request) {
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Supabase 未設定" }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const scope = (searchParams.get("scope") || "").trim();

    if (!scope) {
      return NextResponse.json({ success: false, error: "scope 必填" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("vote_game_options")
      .select("id, option_name")
      .eq("scope", scope)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const options = (data ?? [])
      .map((row: any) => (typeof row.option_name === "string" ? row.option_name.trim() : ""))
      .filter((name: string) => name.length > 0);

    return NextResponse.json({ success: true, data: options });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "讀取遊戲清單失敗" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Supabase 未設定" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const scope = typeof body?.scope === "string" ? body.scope.trim() : "";
    const optionName = typeof body?.optionName === "string" ? body.optionName.trim() : "";

    if (!scope || !optionName) {
      return NextResponse.json(
        { success: false, error: "scope 與 optionName 必填" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("vote_game_options")
      .insert({ scope, option_name: optionName });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ success: true, message: "選項已存在" });
      }
      throw error;
    }

    return NextResponse.json({ success: true, message: "新增成功" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "新增遊戲選項失敗" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Supabase 未設定" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const scope = typeof body?.scope === "string" ? body.scope.trim() : "";
    const optionName = typeof body?.optionName === "string" ? body.optionName.trim() : "";

    if (!scope || !optionName) {
      return NextResponse.json(
        { success: false, error: "scope 與 optionName 必填" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("vote_game_options")
      .delete()
      .eq("scope", scope)
      .ilike("option_name", optionName);

    if (error) throw error;

    return NextResponse.json({ success: true, message: "刪除成功" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "刪除遊戲選項失敗" },
      { status: 500 }
    );
  }
}
