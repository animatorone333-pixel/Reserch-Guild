import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const hasSupabase = SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";

const supabase = hasSupabase
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const isValidDateString = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const isWeekendDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  const day = date.getDay();
  return day === 0 || day === 6;
};

export async function GET() {
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Supabase 未設定" }, { status: 500 });
  }

  try {
    const { data, error } = await supabase
      .from("outdoor_votes")
      .select("id, game_name, voter_name, agree_vote, vote_day, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "讀取投票失敗" },
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
    const gameName = typeof body?.gameName === "string" ? body.gameName.trim() : "";
    const voterName = typeof body?.voterName === "string" ? body.voterName.trim() : "";
    const agreeVote = body?.agreeVote === true;
    const requestedVoteDay = typeof body?.voteDate === "string" ? body.voteDate.trim() : "";
    const voteDay = requestedVoteDay || new Date().toISOString().slice(0, 10);

    if (!gameName || !voterName) {
      return NextResponse.json(
        { success: false, error: "gameName 與 voterName 必填" },
        { status: 400 }
      );
    }

    if (!agreeVote) {
      return NextResponse.json(
        { success: false, error: "需勾選 agreeVote 才能投票" },
        { status: 400 }
      );
    }

    if (!isValidDateString(voteDay)) {
      return NextResponse.json(
        { success: false, error: "voteDate 格式需為 YYYY-MM-DD" },
        { status: 400 }
      );
    }

    if (!isWeekendDate(voteDay)) {
      return NextResponse.json(
        { success: false, error: "投票日期只允許週六或週日" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("outdoor_votes")
      .insert({
        game_name: gameName,
        voter_name: voterName,
        agree_vote: true,
        vote_day: voteDay,
      })
      .select("id, game_name, voter_name, agree_vote, vote_day, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { success: false, error: "你在該投票日期已投過這個遊戲，請改投其他遊戲或調整日期。" },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, data, message: "投票成功" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "新增投票失敗" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Supabase 未設定" }, { status: 500 });
  }

  try {
    const { error } = await supabase
      .from("outdoor_votes")
      .delete()
      .gte("id", 0);

    if (error) throw error;

    return NextResponse.json({ success: true, message: "已清空投票紀錄" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "清空投票失敗" },
      { status: 500 }
    );
  }
}
