-- 啟用 RLS
ALTER TABLE calendar_notes ENABLE ROW LEVEL SECURITY;

-- 允許所有人讀取
CREATE POLICY "Allow public read access on calendar_notes"
  ON calendar_notes FOR SELECT
  TO public
  USING (true);

-- 允許所有人新增
CREATE POLICY "Allow public insert on calendar_notes"
  ON calendar_notes FOR INSERT
  TO public
  WITH CHECK (true);

-- 允許所有人更新
CREATE POLICY "Allow public update on calendar_notes"
  ON calendar_notes FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- 允許所有人刪除
CREATE POLICY "Allow public delete on calendar_notes"
  ON calendar_notes FOR DELETE
  TO public
  USING (true);

-- 如果未來需要多使用者隔離，可以修改政策為：
-- USING (user_id = current_setting('request.jwt.claims')::json->>'sub')
-- 目前設為 public 方便內部使用
