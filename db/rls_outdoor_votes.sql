-- 啟用 RLS
ALTER TABLE public.outdoor_votes ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.outdoor_votes TO anon, authenticated;

-- 重跑安全：先移除舊政策
DROP POLICY IF EXISTS "Allow public read access on outdoor_votes" ON public.outdoor_votes;
DROP POLICY IF EXISTS "Allow public insert on outdoor_votes" ON public.outdoor_votes;
DROP POLICY IF EXISTS "Allow public delete on outdoor_votes" ON public.outdoor_votes;

-- 允許所有人讀取
CREATE POLICY "Allow public read access on outdoor_votes"
  ON public.outdoor_votes FOR SELECT
  TO public
  USING (true);

-- 允許所有人新增
CREATE POLICY "Allow public insert on outdoor_votes"
  ON public.outdoor_votes FOR INSERT
  TO public
  WITH CHECK (true);

-- 允許所有人刪除（供「重新投票」清空紀錄）
CREATE POLICY "Allow public delete on outdoor_votes"
  ON public.outdoor_votes FOR DELETE
  TO public
  USING (true);
