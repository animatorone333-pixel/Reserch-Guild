import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const hasSupabase = SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";

const supabase = hasSupabase
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

interface VoteRoomGameInput {
  gameName?: unknown;
  gameUrl?: unknown;
  gamePrice?: unknown;
}

const formatError = (error: any, fallback: string) => {
  const message = String(error?.message || "");
  if (message.includes("vote_room_games") || error?.code === "PGRST205") {
    return "尚未建立 vote_room_games 資料表，請先執行 db/create_vote_room_games_table.sql 與 db/rls_vote_room_games.sql。";
  }
  return message || fallback;
};

export async function GET() {
  if (!supabase) {
    return NextResponse.json({ success: false, error: "Supabase 未設定" }, { status: 500 });
  }

  try {
    const { data, error } = await supabase
      .from("vote_room_games")
      .select("id, game_name, game_url, game_price, created_at")
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: formatError(error, "讀取遊戲清單失敗") },
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
    const gamesRaw = Array.isArray(body?.games) ? body.games : [];

    const games: Array<{ gameName: string; gameUrl: string; gamePrice: string }> = gamesRaw
      .map((item: VoteRoomGameInput) => {
        const gameName = typeof item?.gameName === "string" ? item.gameName.trim() : "";
        const gameUrl = typeof item?.gameUrl === "string" ? item.gameUrl.trim() : "";
        const gamePrice = typeof item?.gamePrice === "string" ? item.gamePrice.trim() : "";
        return { gameName, gameUrl, gamePrice };
      })
      .filter((item: { gameName: string; gameUrl: string; gamePrice: string }) => item.gameName || item.gameUrl || item.gamePrice);

    if (!games.length) {
      return NextResponse.json(
        { success: false, error: "games 至少要有一筆資料" },
        { status: 400 }
      );
    }

    if (games.some((item) => !item.gameName)) {
      return NextResponse.json(
        { success: false, error: "每筆遊戲都必須填寫 gameName" },
        { status: 400 }
      );
    }

    for (const game of games) {
      if (game.gameUrl) {
        try {
          new URL(game.gameUrl);
        } catch {
          return NextResponse.json(
            { success: false, error: `遊戲「${game.gameName}」的網址格式不正確` },
            { status: 400 }
          );
        }
      }

    }

    const { error: deleteError } = await supabase
      .from("vote_room_games")
      .delete()
      .gte("id", 0);

    if (deleteError) throw deleteError;

    const payload = games.map((item) => ({
      game_name: item.gameName,
      game_url: item.gameUrl || null,
      game_price: item.gamePrice || null,
    }));

    const { data, error } = await supabase
      .from("vote_room_games")
      .insert(payload)
      .select("id, game_name, game_url, game_price, created_at")
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [], message: "已儲存本次遊戲清單" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: formatError(error, "儲存遊戲清單失敗") },
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

    if (!idValue) {
      return NextResponse.json(
        { success: false, error: "請提供 id" },
        { status: 400 }
      );
    }

    const gameId = Number(idValue);
    if (!Number.isInteger(gameId) || gameId <= 0) {
      return NextResponse.json(
        { success: false, error: "id 需為正整數" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("vote_room_games")
      .delete()
      .eq("id", gameId);

    if (error) throw error;

    return NextResponse.json({ success: true, message: "已刪除遊戲" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: formatError(error, "刪除遊戲失敗") },
      { status: 500 }
    );
  }
}
