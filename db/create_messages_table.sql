-- SQL migration: create messages table for Supabase realtime chat

CREATE TABLE public.messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  text TEXT NOT NULL,
  nickname TEXT,
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Optional: enable realtime publications (Supabase UI also provides this)
-- You can enable publications for the table in the Supabase dashboard under Realtime.

-- Example RLS policy for open anonymous insert (ONLY use for public chat):
-- ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY allow_insert ON public.messages FOR INSERT USING (true) WITH CHECK (true);
