import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const hasSupabase = SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";

const supabase = hasSupabase
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

interface ExistingVoteRecord {
  id: number;
  vote_day?: string | null;
  vote_days?: string[] | null;
}

const isValidDateString = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const isAllowed2026SpringSaturday = (value: string) => {
  const [year, month, dayOfMonth] = value.split("-").map(Number);
  if (year !== 2026 || ![3, 4].includes(month) || !dayOfMonth) return false;
  const date = new Date(Date.UTC(year, month - 1, dayOfMonth));
  return date.getUTCDay() === 6;
};

const parseVoteDatesPayload = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  const uniqueDates = new Set<string>();
  value.forEach((item) => {
    if (typeof item !== "string") return;
    const normalized = item.trim();
    if (!normalized) return;
    uniqueDates.add(normalized);
  });

  return Array.from(uniqueDates);
};

const normalizeExistingVoteDates = (row: ExistingVoteRecord): string[] => {
  if (Array.isArray(row.vote_days) && row.vote_days.length > 0) {
    return row.vote_days
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (typeof row.vote_day === "string" && row.vote_day.trim()) {
    return [row.vote_day.trim()];
  }

  return [];
};

const parseGamePriceText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed;
  }

  return "__INVALID__";
};

const formatVoteRoomError = (error: any, fallback: string) => {
  const message = String(error?.message || "");
  if (message.includes("vote_room_votes") || error?.code === "PGRST205") {
    return "尚未建立 vote_room_votes 資料表，請到 Supabase SQL Editor 依序執行 db/create_vote_room_votes_table.sql 與 db/rls_vote_room_votes.sql。";
  }
  if (message.includes("invalid input syntax for type numeric") && message.includes("game_price")) {
    return "目前資料庫的 vote_room_votes.game_price 仍是 numeric，請到 Supabase SQL Editor 執行 db/migrate_vote_room_votes_multi_dates.sql，將 game_price 轉為 TEXT。";
  }
  if (message.includes("invalid input syntax for type numeric")) {
    return "目前資料庫欄位型別仍為 numeric，請到 Supabase SQL Editor 執行 db/migrate_vote_room_votes_multi_dates.sql。";
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
      .select("id, game_name, game_url, game_price, voter_name, agree_vote, vote_day, vote_days, created_at")
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
    const gameUrl = typeof body?.gameUrl === "string" ? body.gameUrl.trim() : "";
    const gamePrice = parseGamePriceText(body?.gamePrice);
    const voterName = typeof body?.voterName === "string" ? body.voterName.trim() : "";
    const agreeVote = body?.agreeVote === true;
    const voteDates = parseVoteDatesPayload(body?.voteDates);

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

    if (gamePrice === "__INVALID__") {
      return NextResponse.json(
        { success: false, error: "gamePrice 格式不正確" },
        { status: 400 }
      );
    }

    if (gameUrl) {
      try {
        new URL(gameUrl);
      } catch {
        return NextResponse.json(
          { success: false, error: "gameUrl 格式不正確" },
          { status: 400 }
        );
      }
    }

    if (!voteDates.length) {
      return NextResponse.json(
        { success: false, error: "voteDates 至少要選擇一個日期" },
        { status: 400 }
      );
    }

    if (voteDates.some((date) => !isValidDateString(date))) {
      return NextResponse.json(
        { success: false, error: "voteDates 的日期格式需為 YYYY-MM-DD" },
        { status: 400 }
      );
    }

    if (voteDates.some((date) => !isAllowed2026SpringSaturday(date))) {
      return NextResponse.json(
        { success: false, error: "voteDates 僅允許 2026 年 3 月與 4 月的星期六" },
        { status: 400 }
      );
    }

    const { data: existingVotes, error: existingVotesError } = await supabase
      .from("vote_room_votes")
      .select("id, vote_day, vote_days")
      .ilike("game_name", gameName)
      .ilike("voter_name", voterName)
      .limit(200);

    if (existingVotesError) throw existingVotesError;

    const requestedDates = new Set(voteDates);
    const hasDateConflict = (existingVotes ?? []).some((row: ExistingVoteRecord) => {
      const existingDates = normalizeExistingVoteDates(row);
      return existingDates.some((date) => requestedDates.has(date));
    });

    if (hasDateConflict) {
      return NextResponse.json(
        { success: false, error: "你在所選日期中，已有同姓名與同遊戲的投票紀錄。" },
        { status: 409 }
      );
    }

    const primaryVoteDay = voteDates[0];

    const { data, error } = await supabase
      .from("vote_room_votes")
      .insert({
        game_name: gameName,
        game_url: gameUrl || null,
        game_price: gamePrice,
        voter_name: voterName,
        agree_vote: true,
        vote_day: primaryVoteDay,
        vote_days: voteDates,
      })
      .select("id, game_name, game_url, game_price, voter_name, agree_vote, vote_day, vote_days, created_at")
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
    const gameUrl = typeof body?.gameUrl === "string" ? body.gameUrl.trim() : "";
    const gamePrice = parseGamePriceText(body?.gamePrice);
    const voteDates = parseVoteDatesPayload(body?.voteDates);

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

    if (gamePrice === "__INVALID__") {
      return NextResponse.json(
        { success: false, error: "gamePrice 格式不正確" },
        { status: 400 }
      );
    }

    if (gameUrl) {
      try {
        new URL(gameUrl);
      } catch {
        return NextResponse.json(
          { success: false, error: "gameUrl 格式不正確" },
          { status: 400 }
        );
      }
    }

    if (!voteDates.length) {
      return NextResponse.json(
        { success: false, error: "voteDates 至少要選擇一個日期" },
        { status: 400 }
      );
    }

    if (voteDates.some((date) => !isValidDateString(date))) {
      return NextResponse.json(
        { success: false, error: "voteDates 的日期格式需為 YYYY-MM-DD" },
        { status: 400 }
      );
    }

    if (voteDates.some((date) => !isAllowed2026SpringSaturday(date))) {
      return NextResponse.json(
        { success: false, error: "投票日期僅允許 2026 年 3 月與 4 月的星期六" },
        { status: 400 }
      );
    }

    const { data: targetVote, error: targetVoteError } = await supabase
      .from("vote_room_votes")
      .select("id, voter_name")
      .eq("id", voteId)
      .single();

    if (targetVoteError) throw targetVoteError;

    const { data: existingVotes, error: existingVotesError } = await supabase
      .from("vote_room_votes")
      .select("id, vote_day, vote_days")
      .ilike("game_name", gameName)
      .ilike("voter_name", String((targetVote as any)?.voter_name || ""))
      .neq("id", voteId)
      .limit(200);

    if (existingVotesError) throw existingVotesError;

    const requestedDates = new Set(voteDates);
    const hasDateConflict = (existingVotes ?? []).some((row: ExistingVoteRecord) => {
      const existingDates = normalizeExistingVoteDates(row);
      return existingDates.some((date) => requestedDates.has(date));
    });

    if (hasDateConflict) {
      return NextResponse.json(
        { success: false, error: "該投票者在所選日期中已投過此遊戲，請調整後再試。" },
        { status: 409 }
      );
    }

    const primaryVoteDay = voteDates[0];

    const { data, error } = await supabase
      .from("vote_room_votes")
      .update({
        game_name: gameName,
        game_url: gameUrl || null,
        game_price: gamePrice,
        vote_day: primaryVoteDay,
        vote_days: voteDates,
      })
      .eq("id", voteId)
      .select("id, game_name, game_url, game_price, voter_name, agree_vote, vote_day, vote_days, created_at")
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
