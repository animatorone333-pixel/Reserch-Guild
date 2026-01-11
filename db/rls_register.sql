-- Option B: use table name `register`
-- Enables RLS and allows public (anon) read/write.
-- WARNING: This allows anyone with the anon key to insert/update/delete.

-- Enable RLS
ALTER TABLE public.register ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_dates ENABLE ROW LEVEL SECURITY;

-- Grants (helps avoid "permission denied" in some setups)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.register TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.event_dates TO anon, authenticated;
DO $$
BEGIN
  IF to_regclass('public.event_dates_id_seq') IS NOT NULL THEN
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE public.event_dates_id_seq TO anon, authenticated';
  END IF;

  -- 若 register 使用 BIGSERIAL/SERIAL，通常會是 register_id_seq。
  -- 若你使用不同的 sequence 名稱，請依實際情況調整。
  IF to_regclass('public.register_id_seq') IS NOT NULL THEN
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE public.register_id_seq TO anon, authenticated';
  END IF;
END $$;

-- register table policies
DROP POLICY IF EXISTS "Allow public read access on register" ON public.register;
DROP POLICY IF EXISTS "Allow public insert on register" ON public.register;
DROP POLICY IF EXISTS "Allow public update on register" ON public.register;
DROP POLICY IF EXISTS "Allow public delete on register" ON public.register;

CREATE POLICY "Allow public read access on register"
  ON public.register FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert on register"
  ON public.register FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update on register"
  ON public.register FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete on register"
  ON public.register FOR DELETE
  TO public
  USING (true);

-- event_dates policies
DROP POLICY IF EXISTS "Allow public read access on event_dates" ON public.event_dates;
DROP POLICY IF EXISTS "Allow public insert on event_dates" ON public.event_dates;
DROP POLICY IF EXISTS "Allow public update on event_dates" ON public.event_dates;
DROP POLICY IF EXISTS "Allow public delete on event_dates" ON public.event_dates;

CREATE POLICY "Allow public read access on event_dates"
  ON public.event_dates FOR SELECT
  TO public
  USING (true);

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

-- Realtime
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.register';
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
    WHEN undefined_object THEN
      NULL;
  END;

  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.event_dates';
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
    WHEN undefined_object THEN
      NULL;
  END;
END $$;
