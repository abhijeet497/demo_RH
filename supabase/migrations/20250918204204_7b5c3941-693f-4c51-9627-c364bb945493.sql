-- Create function for user_profiles with ON CONFLICT DO NOTHING
CREATE OR REPLACE FUNCTION create_user_profile_with_conflict_handling(
  user_id UUID,
  user_org_id UUID,
  user_role TEXT
)
RETURNS TABLE(
  id UUID,
  org_id UUID,
  role TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH ins AS (
  INSERT INTO public.user_profiles (id, org_id, role)
  VALUES (user_id, user_org_id, user_role)
  -- Use the primary key/unique constraint on id:
  -- If your PK is named differently, replace user_profiles_pkey accordingly.
  ON CONFLICT ON CONSTRAINT user_profiles_pkey DO NOTHING
  RETURNING id, org_id, role, created_at, updated_at
)
SELECT * FROM ins
UNION ALL
SELECT u.id, u.org_id, u.role, u.created_at, u.updated_at
FROM public.user_profiles AS u
WHERE u.id = user_id
  AND NOT EXISTS (SELECT 1 FROM ins);
$$;
