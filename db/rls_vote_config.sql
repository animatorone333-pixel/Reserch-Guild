-- 啟用 RLS
ALTER TABLE public.vote_config ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vote_config TO anon, authenticated;

-- 重跑安全：先移除舊政策
DROP POLICY IF EXISTS "Allow public read access on vote_config" ON public.vote_config;
DROP POLICY IF EXISTS "Allow public update on vote_config" ON public.vote_config;
DROP POLICY IF EXISTS "Allow public insert on vote_config" ON public.vote_config;

-- 允許所有人讀取
CREATE POLICY "Allow public read access on vote_config"
  ON public.vote_config FOR SELECT
  TO public
  USING (true);

-- 允許所有人更新（可依需求改成只允許管理員/登入者）
CREATE POLICY "Allow public update on vote_config"
  ON public.vote_config FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- 允許插入（主要給第一次初始化時使用；你也可以移除此 policy 並改由 SQL 預先插入）
CREATE POLICY "Allow public insert on vote_config"
  ON public.vote_config FOR INSERT
  TO public
  WITH CHECK (true);
