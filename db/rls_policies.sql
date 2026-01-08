-- RLS policies for public.messages
-- Run in Supabase SQL editor (or psql) for your project.

-- 1) Enable Row Level Security (if not already enabled)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 2a) Permissive policy (ALLOW ANONYMOUS INSERT)
-- WARNING: This allows anyone with the anon key (or public access) to INSERT messages.
-- Only use for fully public chat where anonymous posting is acceptable.
CREATE POLICY allow_public_insert
  ON public.messages
  FOR INSERT
  USING ( true )
  WITH CHECK ( true );

-- 2b) Recommended safer policy (AUTHENTICATED USERS ONLY)
-- Use this if you require users to sign in via Supabase Auth.
-- It allows INSERT only when auth.uid() is present (i.e., a logged-in user).
-- COMMENT OUT 2a) if you use this policy.
CREATE POLICY allow_insert_auth_users
  ON public.messages
  FOR INSERT
  USING ( auth.uid() IS NOT NULL )
  WITH CHECK ( auth.uid() IS NOT NULL );

-- 3) Optional: allow everyone to SELECT (read) messages
-- Generally SELECT is allowed; if you enabled RLS and want to permit read access to public, use this:
CREATE POLICY allow_select_public
  ON public.messages
  FOR SELECT
  USING ( true );

-- 4) Optional: restrict UPDATE/DELETE to message owner only (requires storing owner id)
-- If you later add a "user_id" column populated from auth.uid(), use:
-- ALTER TABLE public.messages ADD COLUMN user_id uuid;
-- CREATE POLICY allow_update_owner ON public.messages FOR UPDATE USING ( auth.uid() = user_id ) WITH CHECK ( auth.uid() = user_id );
-- CREATE POLICY allow_delete_owner ON public.messages FOR DELETE USING ( auth.uid() = user_id );

-- After running policies, in Supabase Dashboard → Realtime -> Publications, ensure `public.messages` is enabled for realtime subscriptions.
