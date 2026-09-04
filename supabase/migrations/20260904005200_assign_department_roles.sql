-- Assign the matching non-Admin role when a user signs up with a department.
-- Admin access remains an explicit administrator-only assignment.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  department_name text;
  matching_role_id uuid;
BEGIN
  department_name := COALESCE(NEW.raw_user_meta_data->>'department', 'Unassigned');

  INSERT INTO public.profiles (id, full_name, department)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    department_name
  );

  SELECT id INTO matching_role_id
  FROM public.roles
  WHERE lower(name) = lower(department_name)
    AND name <> 'Admin';

  IF matching_role_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (NEW.id, matching_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill users created before automatic department assignment was installed.
INSERT INTO public.user_roles (user_id, role_id)
SELECT p.id, r.id
FROM public.profiles p
JOIN public.roles r ON lower(r.name) = lower(p.department)
WHERE r.name <> 'Admin'
ON CONFLICT (user_id, role_id) DO NOTHING;