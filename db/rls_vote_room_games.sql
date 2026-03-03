-- 啟用 RLS
ALTER TABLE public.vote_room_games ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.vote_room_games TO anon, authenticated;

-- 重跑安全：先移除舊政策
DROP POLICY IF EXISTS "Allow public read access on vote_room_games" ON public.vote_room_games;
DROP POLICY IF EXISTS "Allow public insert on vote_room_games" ON public.vote_room_games;
DROP POLICY IF EXISTS "Allow public delete on vote_room_games" ON public.vote_room_games;

-- 允許所有人讀取
CREATE POLICY "Allow public read access on vote_room_games"
  ON public.vote_room_games FOR SELECT
  TO public
  USING (true);

-- 允許所有人新增
CREATE POLICY "Allow public insert on vote_room_games"
  ON public.vote_room_games FOR INSERT
  TO public
  WITH CHECK (true);

-- 允許所有人刪除
CREATE POLICY "Allow public delete on vote_room_games"
  ON public.vote_room_games FOR DELETE
  TO public
  USING (true);
