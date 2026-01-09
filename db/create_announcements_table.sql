-- 建立首頁公告表
CREATE TABLE IF NOT EXISTS announcements (
  id BIGSERIAL PRIMARY KEY,
  content TEXT DEFAULT '',
  updated_by TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 插入預設公告（只會有一筆記錄）
INSERT INTO announcements (id, content, updated_by) VALUES
  (1, '💌最新公告
歡迎來到研究公會！
這裡是最新消息區域，
管理員可以即時編輯公告內容。

所有人都會立即看到更新！', 'system')
ON CONFLICT (id) DO NOTHING;

-- 建立更新時間的觸發器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 啟用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;

-- 新增註解
COMMENT ON TABLE announcements IS '首頁公告資料表（只有一筆記錄 id=1）';
COMMENT ON COLUMN announcements.content IS '公告內容';
COMMENT ON COLUMN announcements.updated_by IS '更新者';
