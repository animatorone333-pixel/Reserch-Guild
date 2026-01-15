-- =============================================
-- 強制重設 event_dates 資料表 (修復日期格式錯誤)
-- =============================================

-- 1. 先刪除舊表 (如果欄位型別錯了，直接重建最快)
DROP TABLE IF EXISTS event_dates;

-- 2. 重新建立 event_dates 表 (注意：event_date 設為 TEXT 以支援 '1/5' 這種格式)
CREATE TABLE event_dates (
  id BIGSERIAL PRIMARY KEY,
  event_date TEXT NOT NULL UNIQUE,
  image_url TEXT DEFAULT '/game_16.png',
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 建立索引
CREATE INDEX idx_event_dates_display_order ON event_dates(display_order);

-- 4. 建立更新時間觸發器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_event_dates_updated_at
  BEFORE UPDATE ON event_dates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. 啟用 RLS 並開放權限
ALTER TABLE event_dates ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.event_dates TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.event_dates_id_seq TO anon, authenticated;

-- 6. 設定 RLS 政策 (允許所有人讀寫)
CREATE POLICY "Allow public all event_dates"
  ON event_dates FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- 7. 插入預設日期資料 (現在應該可以成功了)
INSERT INTO event_dates (event_date, image_url, display_order) VALUES
  ('1/5', '/game_16.png', 1),
  ('1/12', '/game_17.png', 2),
  ('1/19', '/game_18.png', 3);

-- 8. 確保 Realtime 啟用
DO $$ 
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE event_dates;
EXCEPTION 
  WHEN duplicate_object THEN NULL;
END $$;

-- 9. 顯示結果
SELECT * FROM event_dates;
