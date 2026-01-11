-- 啟用 RLS
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_dates ENABLE ROW LEVEL SECURITY;

-- Grants：RLS 只決定「允許/拒絕列」，仍需要 table/sequence 權限。
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.registrations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.event_dates TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.registrations_id_seq TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.event_dates_id_seq TO anon, authenticated;

-- registrations 表的 RLS 政策
-- 允許所有人讀取
DROP POLICY IF EXISTS "Allow public read access on registrations" ON public.registrations;
DROP POLICY IF EXISTS "Allow public insert on registrations" ON public.registrations;
DROP POLICY IF EXISTS "Allow public update on registrations" ON public.registrations;
DROP POLICY IF EXISTS "Allow public delete on registrations" ON public.registrations;

CREATE POLICY "Allow public read access on registrations"
  ON public.registrations FOR SELECT
  TO public
  USING (true);

-- 允許所有人新增
CREATE POLICY "Allow public insert on registrations"
  ON public.registrations FOR INSERT
  TO public
  WITH CHECK (true);

-- 允許所有人更新
CREATE POLICY "Allow public update on registrations"
  ON public.registrations FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- 允許所有人刪除
CREATE POLICY "Allow public delete on registrations"
  ON public.registrations FOR DELETE
  TO public
  USING (true);

-- event_dates 表的 RLS 政策
-- 允許所有人讀取
DROP POLICY IF EXISTS "Allow public read access on event_dates" ON public.event_dates;
DROP POLICY IF EXISTS "Allow public insert on event_dates" ON public.event_dates;
DROP POLICY IF EXISTS "Allow public update on event_dates" ON public.event_dates;
DROP POLICY IF EXISTS "Allow public delete on event_dates" ON public.event_dates;

CREATE POLICY "Allow public read access on event_dates"
  ON public.event_dates FOR SELECT
  TO public
  USING (true);

-- 允許所有人新增/更新/刪除（用於管理日期）
CREATE POLICY "Allow public insert on event_dates"
  ON public.event_dates FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update on event_dates"
  ON public.event_dates FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete on event_dates"
  ON public.event_dates FOR DELETE
  TO public
  USING (true);
