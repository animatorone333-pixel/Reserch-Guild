-- Enable RLS and create permissive public insert policy
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY allow_public_insert
  ON public.messages
  FOR INSERT
  USING ( true )
  WITH CHECK ( true );

-- Allow public SELECT as well
CREATE POLICY allow_select_public
  ON public.messages
  FOR SELECT
  USING ( true );
