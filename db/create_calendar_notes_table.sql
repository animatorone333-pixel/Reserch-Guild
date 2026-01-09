-- 建立行事曆備註表
CREATE TABLE IF NOT EXISTS calendar_notes (
  id BIGSERIAL PRIMARY KEY,
  date_key TEXT NOT NULL UNIQUE,  -- 格式：YYYY-MM-DD
  note_text TEXT DEFAULT '',
  user_id TEXT DEFAULT 'guest',   -- 預留給未來多使用者功能
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 建立索引以加速查詢
CREATE INDEX IF NOT EXISTS idx_calendar_notes_date_key ON calendar_notes(date_key);
CREATE INDEX IF NOT EXISTS idx_calendar_notes_user_id ON calendar_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_notes_updated_at ON calendar_notes(updated_at DESC);

-- 建立更新時間的觸發器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_calendar_notes_updated_at
  BEFORE UPDATE ON calendar_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 啟用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE calendar_notes;

-- 新增註解
COMMENT ON TABLE calendar_notes IS '行事曆備註資料表';
COMMENT ON COLUMN calendar_notes.date_key IS '日期鍵值 (YYYY-MM-DD)';
COMMENT ON COLUMN calendar_notes.note_text IS '備註內容';
COMMENT ON COLUMN calendar_notes.user_id IS '使用者 ID（預留多使用者功能）';
