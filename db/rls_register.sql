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

-- register table policies
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
ALTER PUBLICATION supabase_realtime ADD TABLE public.register;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_dates;
