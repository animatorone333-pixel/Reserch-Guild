-- 啟用 RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- 允許所有人讀取
CREATE POLICY "Allow public read access on announcements"
  ON announcements FOR SELECT
  TO public
  USING (true);

-- 允許所有人更新（可根據需求改為只允許管理員）
CREATE POLICY "Allow public update on announcements"
  ON announcements FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- 如果需要限制只有管理員能更新，可以修改為：
-- USING (auth.role() = 'authenticated')
-- 或整合使用者認證系統後，用特定條件判斷
