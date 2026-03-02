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
  const [year, month, dayOfMonth] = value.split("-").map(Number);
  if (!year || !month || !dayOfMonth) return false;
  const date = new Date(Date.UTC(year, month - 1, dayOfMonth));
  const day = date.getUTCDay();
  return day === 0 || day === 6;
};

const isMarch2026Saturday = (value: string) => {
  const [year, month, dayOfMonth] = value.split("-").map(Number);
  if (year !== 2026 || month !== 3 || !dayOfMonth) return false;
  const date = new Date(Date.UTC(year, month - 1, dayOfMonth));
  return date.getUTCDay() === 6;
};

const formatVoteRoomError = (error: any, fallback: string) => {
  const message = String(error?.message || "");
  if (message.includes("vote_room_votes") || error?.code === "PGRST205") {
    return "尚未建立 vote_room_votes 資料表，請到 Supabase SQL Editor 依序執行 db/create_vote_room_votes_table.sql 與 db/rls_vote_room_votes.sql。";
  }
  return message || fallback;
};

export async function GET() {
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Supabase 未設定" }, { status: 500 });
  }

  try {
    const { data, error } = await supabase
      .from("vote_room_votes")
      .select("id, game_name, voter_name, agree_vote, vote_day, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: formatVoteRoomError(error, "讀取投票失敗") },
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

    if (!isMarch2026Saturday(voteDay)) {
      return NextResponse.json(
        { success: false, error: "投票日期僅允許 2026 年 3 月的星期六" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("vote_room_votes")
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
      { success: false, error: formatVoteRoomError(error, "新增投票失敗") },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Supabase 未設定" }, { status: 500 });
  }

  try {
    const requestUrl = new URL(request.url);
    const idValue = requestUrl.searchParams.get("id");
    const voteIdToDelete = idValue ? Number(idValue) : null;

    if (Number.isNaN(voteIdToDelete)) {
      return NextResponse.json(
        { success: false, error: "id 需為正整數" },
        { status: 400 }
      );
    }

    if (typeof voteIdToDelete === "number" && voteIdToDelete > 0) {
      const { error } = await supabase
        .from("vote_room_votes")
        .delete()
        .eq("id", voteIdToDelete);

      if (error) throw error;

      return NextResponse.json({ success: true, message: "已刪除投票紀錄" });
    }

    const { error } = await supabase
      .from("vote_room_votes")
      .delete()
      .gte("id", 0);

    if (error) throw error;

    return NextResponse.json({ success: true, message: "已清空投票紀錄" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: formatVoteRoomError(error, "清空投票失敗") },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Supabase 未設定" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const voteId = Number(body?.id);
    const gameName = typeof body?.gameName === "string" ? body.gameName.trim() : "";
    const voteDate = typeof body?.voteDate === "string" ? body.voteDate.trim() : "";

    if (!Number.isInteger(voteId) || voteId <= 0) {
      return NextResponse.json(
        { success: false, error: "id 需為正整數" },
        { status: 400 }
      );
    }

    if (!gameName) {
      return NextResponse.json(
        { success: false, error: "gameName 必填" },
        { status: 400 }
      );
    }

    if (!isValidDateString(voteDate)) {
      return NextResponse.json(
        { success: false, error: "voteDate 格式需為 YYYY-MM-DD" },
        { status: 400 }
      );
    }

    if (!isMarch2026Saturday(voteDate)) {
      return NextResponse.json(
        { success: false, error: "投票日期僅允許 2026 年 3 月的星期六" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("vote_room_votes")
      .update({ game_name: gameName, vote_day: voteDate })
      .eq("id", voteId)
      .select("id, game_name, voter_name, agree_vote, vote_day, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { success: false, error: "該投票者在同日期已投過此遊戲，請調整後再試。" },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, data, message: "已更新投票" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: formatVoteRoomError(error, "修改投票失敗") },
      { status: 500 }
    );
  }
}
