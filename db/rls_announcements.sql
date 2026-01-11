-- 啟用 RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.announcements TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.announcements_id_seq TO anon, authenticated;

-- 重跑安全：先移除舊政策
DROP POLICY IF EXISTS "Allow public read access on announcements" ON public.announcements;
DROP POLICY IF EXISTS "Allow public update on announcements" ON public.announcements;

-- 允許所有人讀取
CREATE POLICY "Allow public read access on announcements"
  ON public.announcements FOR SELECT
  TO public
  USING (true);

-- 允許所有人更新（可根據需求改為只允許管理員）
CREATE POLICY "Allow public update on announcements"
  ON public.announcements FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- 如果需要限制只有管理員能更新，可以修改為：
-- USING (auth.role() = 'authenticated')
-- 或整合使用者認證系統後，用特定條件判斷
