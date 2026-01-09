-- =============================================
-- 報名系統完整設定 SQL
-- 在 Supabase SQL Editor 執行此檔案
-- =============================================

-- 1. 確保資料表存在
CREATE TABLE IF NOT EXISTS registrations (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  event_date TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 建立索引以加速查詢
CREATE INDEX IF NOT EXISTS idx_registrations_event_date ON registrations(event_date);
CREATE INDEX IF NOT EXISTS idx_registrations_created_at ON registrations(created_at DESC);

-- 3. 建立更新時間的觸發器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_registrations_updated_at ON registrations;
CREATE TRIGGER update_registrations_updated_at
  BEFORE UPDATE ON registrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. 啟用 Row Level Security
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

-- 5. 刪除舊政策（如果存在）
DROP POLICY IF EXISTS "Allow public read access on registrations" ON registrations;
DROP POLICY IF EXISTS "Allow public insert on registrations" ON registrations;
DROP POLICY IF EXISTS "Allow public update on registrations" ON registrations;
DROP POLICY IF EXISTS "Allow public delete on registrations" ON registrations;

-- 6. 建立新的 RLS 政策（允許所有人讀寫）
CREATE POLICY "Allow public read access on registrations"
  ON registrations FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert on registrations"
  ON registrations FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update on registrations"
  ON registrations FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete on registrations"
  ON registrations FOR DELETE
  TO public
  USING (true);

-- 7. 啟用 Realtime（如果已啟用會自動略過）
DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE registrations;
EXCEPTION 
  WHEN duplicate_object THEN 
    NULL;
END $$;

-- 8. 驗證設定
SELECT 
  'registrations 資料表已設定完成' as message,
  (SELECT count(*) FROM registrations) as total_registrations;
