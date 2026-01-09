-- 啟用 RLS
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_dates ENABLE ROW LEVEL SECURITY;

-- registrations 表的 RLS 政策
-- 允許所有人讀取
CREATE POLICY "Allow public read access on registrations"
  ON registrations FOR SELECT
  TO public
  USING (true);

-- 允許所有人新增
CREATE POLICY "Allow public insert on registrations"
  ON registrations FOR INSERT
  TO public
  WITH CHECK (true);

-- 允許所有人更新
CREATE POLICY "Allow public update on registrations"
  ON registrations FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- 允許所有人刪除
CREATE POLICY "Allow public delete on registrations"
  ON registrations FOR DELETE
  TO public
  USING (true);

-- event_dates 表的 RLS 政策
-- 允許所有人讀取
CREATE POLICY "Allow public read access on event_dates"
  ON event_dates FOR SELECT
  TO public
  USING (true);

-- 允許所有人新增/更新/刪除（用於管理日期）
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
