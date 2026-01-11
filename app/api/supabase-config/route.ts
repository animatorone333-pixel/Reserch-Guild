import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  const hasSupabase = url !== "" && anonKey !== "";

  return NextResponse.json(
    {
      hasSupabase,
      url: hasSupabase ? url : null,
      anonKey: hasSupabase ? anonKey : null,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
