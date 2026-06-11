import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const hasSupabase = SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";

const supabase = hasSupabase
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const DATA_FILE = path.join(process.cwd(), "data", "vote-room-date-options.json");

const formatError = (error: any, fallback: string) => {
  const message = String(error?.message || "");
  if (message.includes("vote_room_date_options") || error?.code === "PGRST205") {
    return "尚未建立 vote_room_date_options 資料表，請到 Supabase SQL Editor 執行 db/create_vote_room_date_options_table.sql 與 db/rls_vote_room_date_options.sql。";
  }
  return message || fallback;
};

const shouldFallbackToLocal = (error: any) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    !supabase ||
    message.includes("vote_room_date_options") ||
    error?.code === "PGRST205" ||
    error?.code === "42P01"
  );
};

const loadLocalVoteDateOptions = async (): Promise<Array<{ id: number; vote_date: string }>> => {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.id === "number" && typeof item.vote_date === "string")
      .map((item) => ({ id: item.id, vote_date: item.vote_date.trim() }))
      .filter((item) => item.vote_date.length > 0);
  } catch (error: any) {
    if (error?.code === "ENOENT") return [];
    console.error("讀取本地投票日期選項失敗", error);
    return [];
  }
};

const saveLocalVoteDateOptions = async (entries: Array<{ id: number; vote_date: string }>) => {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(entries, null, 2), "utf8");
};

const parseDatePayload = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  const uniqueDates = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const normalized = item.trim();
    if (!normalized) continue;
    uniqueDates.add(normalized);
  }
  return Array.from(uniqueDates);
};

const isValidDateString = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export async function GET() {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("vote_room_date_options")
        .select("id, vote_date")
        .order("vote_date", { ascending: true });

      if (error) throw error;
      return NextResponse.json({ success: true, data: data ?? [] });
    } catch (error: any) {
      if (shouldFallbackToLocal(error)) {
        const localData = await loadLocalVoteDateOptions();
        return NextResponse.json({ success: true, data: localData });
      }
      return NextResponse.json(
        { success: false, error: formatError(error, "讀取投票日期選項失敗") },
        { status: 500 }
      );
    }
  }

  const localData = await loadLocalVoteDateOptions();
  return NextResponse.json({ success: true, data: localData });
}

const buildLocalEntries = async (voteDates: string[]) => {
  const existing = await loadLocalVoteDateOptions();
  const existingDateSet = new Set(existing.map((item) => item.vote_date));
  const nextId = existing.reduce((max, item) => Math.max(max, item.id), 0) + 1;
  const itemsToAdd: Array<{ id: number; vote_date: string }> = [];

  voteDates.forEach((voteDate) => {
    if (!existingDateSet.has(voteDate)) {
      itemsToAdd.push({ id: nextId + itemsToAdd.length, vote_date: voteDate });
    }
  });

  const merged = [...existing, ...itemsToAdd];
  await saveLocalVoteDateOptions(merged);
  return itemsToAdd.length ? itemsToAdd : [];
};

const saveLocalVoteDates = async (voteDates: string[]) => {
  const entries = voteDates.map((voteDate, index) => ({ id: index + 1, vote_date: voteDate }));
  await saveLocalVoteDateOptions(entries);
  return entries;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const voteDates = parseDatePayload(body?.voteDates);

    if (!voteDates.length) {
      return NextResponse.json(
        { success: false, error: "voteDates 至少要有一筆日期" },
        { status: 400 }
      );
    }

    if (voteDates.some((date) => !isValidDateString(date))) {
      return NextResponse.json(
        { success: false, error: "voteDates 的格式需為 YYYY-MM-DD" },
        { status: 400 }
      );
    }

    if (supabase) {
      try {
        const payload = voteDates.map((voteDate) => ({ vote_date: voteDate }));
        const { data, error } = await supabase
          .from("vote_room_date_options")
          .insert(payload)
          .select("id, vote_date");

        if (error) throw error;
        return NextResponse.json({ success: true, data: data ?? [], message: "已新增投票日期選項" });
      } catch (error: any) {
        if (!shouldFallbackToLocal(error)) {
          throw error;
        }
      }
    }

    const items = await buildLocalEntries(voteDates);
    return NextResponse.json({ success: true, data: items, message: "已於本地儲存投票日期選項" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: formatError(error, "新增投票日期選項失敗") },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const voteDates = parseDatePayload(body?.voteDates);

    if (!voteDates.length) {
      return NextResponse.json(
        { success: false, error: "voteDates 至少要有一筆日期" },
        { status: 400 }
      );
    }

    if (voteDates.some((date) => !isValidDateString(date))) {
      return NextResponse.json(
        { success: false, error: "voteDates 的格式需為 YYYY-MM-DD" },
        { status: 400 }
      );
    }

    if (supabase) {
      try {
        const { error: deleteError } = await supabase
          .from("vote_room_date_options")
          .delete()
          .gte("id", 0);

        if (deleteError) throw deleteError;

        const payload = voteDates.map((voteDate) => ({ vote_date: voteDate }));
        const { data, error } = await supabase
          .from("vote_room_date_options")
          .insert(payload)
          .select("id, vote_date");

        if (error) throw error;
        return NextResponse.json({ success: true, data: data ?? [], message: "已更新投票日期選項" });
      } catch (error: any) {
        if (!shouldFallbackToLocal(error)) {
          throw error;
        }
      }
    }

    const entries = await saveLocalVoteDates(voteDates);
    return NextResponse.json({ success: true, data: entries, message: "已於本地更新投票日期選項" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: formatError(error, "更新投票日期選項失敗") },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const requestUrl = new URL(request.url);
  const idParam = requestUrl.searchParams.get("id");
  const dateParam = requestUrl.searchParams.get("date");

  if (supabase) {
    try {
      if (idParam) {
        const id = Number(idParam);
        if (!Number.isInteger(id) || id <= 0) {
          return NextResponse.json({ success: false, error: "id 需為正整數" }, { status: 400 });
        }
        const { error } = await supabase.from("vote_room_date_options").delete().eq("id", id);
        if (error) throw error;
        return NextResponse.json({ success: true, message: "已刪除投票日期" });
      }

      if (dateParam) {
        if (!isValidDateString(dateParam)) {
          return NextResponse.json({ success: false, error: "date 格式需為 YYYY-MM-DD" }, { status: 400 });
        }
        const { error } = await supabase.from("vote_room_date_options").delete().eq("vote_date", dateParam);
        if (error) throw error;
        return NextResponse.json({ success: true, message: "已刪除投票日期" });
      }

      const { error } = await supabase.from("vote_room_date_options").delete().gte("id", 0);
      if (error) throw error;
      return NextResponse.json({ success: true, message: "已清空投票日期選項" });
    } catch (error: any) {
      if (!shouldFallbackToLocal(error)) {
        return NextResponse.json(
          { success: false, error: formatError(error, "刪除投票日期失敗") },
          { status: 500 }
        );
      }
    }
  }

  try {
    const entries = await loadLocalVoteDateOptions();
    let nextEntries = entries;
    if (idParam) {
      const id = Number(idParam);
      if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ success: false, error: "id 需為正整數" }, { status: 400 });
      }
      nextEntries = entries.filter((item) => item.id !== id);
    } else if (dateParam) {
      if (!isValidDateString(dateParam)) {
        return NextResponse.json({ success: false, error: "date 格式需為 YYYY-MM-DD" }, { status: 400 });
      }
      nextEntries = entries.filter((item) => item.vote_date !== dateParam);
    } else {
      nextEntries = [];
    }

    await saveLocalVoteDateOptions(nextEntries);
    return NextResponse.json({ success: true, message: "已刪除投票日期" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: formatError(error, "刪除投票日期失敗") },
      { status: 500 }
    );
  }
}
