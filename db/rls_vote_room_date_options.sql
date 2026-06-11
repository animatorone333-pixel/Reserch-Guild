-- RLS 政策：允許匿名/公開讀取投票日期選項
CREATE POLICY IF NOT EXISTS "public can read vote_room_date_options"
  ON public.vote_room_date_options
  FOR SELECT
  USING (true);

-- RLS 政策：允許公開寫入日期選項，以便後端 API 在 Supabase anon key 下可正常運作
CREATE POLICY IF NOT EXISTS "public can modify vote_room_date_options"
  ON public.vote_room_date_options
  FOR INSERT, UPDATE, DELETE
  USING (true);

ALTER TABLE public.vote_room_date_options ENABLE ROW LEVEL SECURITY;
