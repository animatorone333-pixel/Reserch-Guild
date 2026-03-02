-- 啟用 RLS
ALTER TABLE public.vote_game_options ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.vote_game_options TO anon, authenticated;

-- 重跑安全：先移除舊政策
DROP POLICY IF EXISTS "Allow public read access on vote_game_options" ON public.vote_game_options;
DROP POLICY IF EXISTS "Allow public insert on vote_game_options" ON public.vote_game_options;
DROP POLICY IF EXISTS "Allow public delete on vote_game_options" ON public.vote_game_options;

-- 允許所有人讀取
CREATE POLICY "Allow public read access on vote_game_options"
  ON public.vote_game_options FOR SELECT
  TO public
  USING (true);

-- 允許所有人新增
CREATE POLICY "Allow public insert on vote_game_options"
  ON public.vote_game_options FOR INSERT
  TO public
  WITH CHECK (true);

-- 允許所有人刪除
CREATE POLICY "Allow public delete on vote_game_options"
  ON public.vote_game_options FOR DELETE
  TO public
  USING (true);
