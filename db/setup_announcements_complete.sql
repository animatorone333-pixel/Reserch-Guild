-- ==========================================
-- 公告功能完整設定 SQL
-- 請在 Supabase SQL Editor 依序執行
-- ==========================================

-- 步驟 1: 建立資料表（如果不存在）
-- ==========================================
CREATE TABLE IF NOT EXISTS announcements (
  id BIGINT PRIMARY KEY,
  content TEXT DEFAULT '',
  updated_by TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 步驟 2: 插入預設公告（如果不存在）
-- ==========================================
INSERT INTO announcements (id, content, updated_by) VALUES
  (1, '💌最新公告
🔸下次桌遊將在10/13舉行!
🔸歡迎推薦遊戲品項，請至桌遊投票區開盲盒!
🔸本月主題日_夜市人生，將舉行射擊遊戲!歡迎來練習!', 'system')
ON CONFLICT (id) DO UPDATE 
  SET content = EXCLUDED.content
  WHERE announcements.content = '';

-- 步驟 3: 建立更新時間觸發器
-- ==========================================
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_announcements_updated_at ON announcements;

CREATE TRIGGER trigger_update_announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_announcements_updated_at();

-- 步驟 4: 啟用 RLS（重要！）
-- ==========================================
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- 刪除舊的政策（如果存在）
DROP POLICY IF EXISTS "Allow public read access on announcements" ON announcements;
DROP POLICY IF EXISTS "Allow public update on announcements" ON announcements;

-- 建立新的政策：允許所有人讀取
CREATE POLICY "Allow public read access on announcements"
  ON announcements FOR SELECT
  TO public
  USING (true);

-- 建立新的政策：允許所有人更新
CREATE POLICY "Allow public update on announcements"
  ON announcements FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- 建立新的政策：允許所有人插入（以防萬一）
CREATE POLICY "Allow public insert on announcements"
  ON announcements FOR INSERT
  TO public
  WITH CHECK (true);

-- 步驟 5: 啟用 Realtime（即時同步）
-- ==========================================
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;

-- 步驟 6: 驗證設定
-- ==========================================
-- 檢查資料是否存在
SELECT 'Data Check' as step, 
       COUNT(*) as total_records,
       (SELECT COUNT(*) FROM announcements WHERE id = 1) as has_id_1
FROM announcements;

-- 檢查 RLS 是否啟用
SELECT 'RLS Check' as step,
       tablename, 
       rowsecurity as rls_enabled 
FROM pg_tables 
WHERE tablename = 'announcements';

-- 檢查政策
SELECT 'Policies Check' as step,
       policyname, 
       cmd as command,
       permissive,
       roles
FROM pg_policies 
WHERE tablename = 'announcements';

-- 完成提示
SELECT '✅ 設定完成！' as message,
       '請重新整理網頁測試' as next_step;
