-- 建立活動日期表
CREATE TABLE IF NOT EXISTS event_dates (
  id BIGSERIAL PRIMARY KEY,
  event_date TEXT NOT NULL UNIQUE,
  image_url TEXT DEFAULT '/game_16.png',
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_event_dates_display_order ON event_dates(display_order);

-- 建立更新時間的觸發器
CREATE TRIGGER update_event_dates_updated_at
  BEFORE UPDATE ON event_dates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 插入預設日期
INSERT INTO event_dates (event_date, image_url, display_order) VALUES
  ('10/13', '/game_16.png', 1),
  ('11/26', '/game_17.png', 2),
  ('12/10', '/game_18.png', 3)
ON CONFLICT (event_date) DO NOTHING;

-- 啟用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE event_dates;
