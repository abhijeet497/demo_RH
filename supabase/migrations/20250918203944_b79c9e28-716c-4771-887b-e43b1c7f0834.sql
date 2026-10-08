-- Create function for org with ON CONFLICT DO NOTHING
CREATE OR REPLACE FUNCTION create_org_with_conflict_handling(
  org_name TEXT,
  org_description TEXT
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  description TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  aws_secret_name TEXT,
  aws_iam_user_name TEXT,
  aws_iam_role_arn TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH ins AS (
  INSERT INTO public.orgs (name, description)
  VALUES (org_name, org_description)
  -- use your unique constraint on orgs(name):
  ON CONFLICT ON CONSTRAINT orgs_name_unique DO NOTHING
  RETURNING
    id, name, description, created_at, updated_at,
    aws_secret_name, aws_iam_user_name, aws_iam_role_arn
)
SELECT * FROM ins
UNION ALL
SELECT
  o.id, o.name, o.description, o.created_at, o.updated_at,
  o.aws_secret_name, o.aws_iam_user_name, o.aws_iam_role_arn
FROM public.orgs AS o
WHERE o.name = org_name
  AND NOT EXISTS (SELECT 1 FROM ins);
$$;
