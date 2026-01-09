-- Enable RLS and create authenticated-only insert policy
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY allow_insert_auth_users
  ON public.messages
  FOR INSERT
  USING ( auth.uid() IS NOT NULL )
  WITH CHECK ( auth.uid() IS NOT NULL );

CREATE POLICY allow_select_public
  ON public.messages
  FOR SELECT
  USING ( true );
