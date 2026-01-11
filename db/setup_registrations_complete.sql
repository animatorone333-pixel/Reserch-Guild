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

-- 4.1 權限（很常是「可以讀但不能寫」或「permission denied for sequence」的根因）
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.registrations TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.registrations_id_seq TO anon, authenticated;

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

-- 8. 建立活動日期表
CREATE TABLE IF NOT EXISTS event_dates (
  id BIGSERIAL PRIMARY KEY,
  event_date TEXT NOT NULL UNIQUE,
  image_url TEXT DEFAULT '/game_16.png',
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 建立 event_dates 索引
CREATE INDEX IF NOT EXISTS idx_event_dates_display_order ON event_dates(display_order);

-- 10. 建立 event_dates 更新觸發器
DROP TRIGGER IF EXISTS update_event_dates_updated_at ON event_dates;
CREATE TRIGGER update_event_dates_updated_at
  BEFORE UPDATE ON event_dates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 11. 啟用 event_dates RLS
ALTER TABLE event_dates ENABLE ROW LEVEL SECURITY;

-- 11.1 權限
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.event_dates TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.event_dates_id_seq TO anon, authenticated;

-- 12. 刪除舊的 event_dates 政策
DROP POLICY IF EXISTS "Allow public read access on event_dates" ON event_dates;
DROP POLICY IF EXISTS "Allow public insert on event_dates" ON event_dates;
DROP POLICY IF EXISTS "Allow public update on event_dates" ON event_dates;
DROP POLICY IF EXISTS "Allow public delete on event_dates" ON event_dates;

-- 13. 建立 event_dates RLS 政策
CREATE POLICY "Allow public read access on event_dates"
  ON event_dates FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert on event_dates"
  ON event_dates FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update on event_dates"
  ON event_dates FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete on event_dates"
  ON event_dates FOR DELETE
  TO public
  USING (true);

-- 14. 插入預設日期（每月前三個星期一，以 2026/01 為例）
INSERT INTO event_dates (event_date, image_url, display_order) VALUES
  ('1/5', '/game_16.png', 1),
  ('1/12', '/game_17.png', 2),
  ('1/19', '/game_18.png', 3)
ON CONFLICT (event_date) DO NOTHING;

-- 15. 啟用 event_dates Realtime
DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE event_dates;
EXCEPTION 
  WHEN duplicate_object THEN 
    NULL;
END $$;

-- 16. 驗證設定
SELECT 
  'registrations 和 event_dates 資料表已設定完成' as message,
  (SELECT count(*) FROM registrations) as total_registrations,
  (SELECT count(*) FROM event_dates) as total_event_dates;
