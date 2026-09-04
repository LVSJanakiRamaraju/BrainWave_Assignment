/*
# Add RBAC Policies and Helper Functions (Part 2)

## Overview
Adds the is_admin() SECURITY DEFINER function and all RLS policies for the employee portal tables.
Tables were created in the 'create_portal_tables' migration with RLS enabled but no policies.

## Security Changes
- is_admin(): SECURITY DEFINER function that checks if current user has Admin role
- Profiles: users read/update own; admins read/update/insert/delete all
- Roles: all authenticated can read; admins can modify
- Permissions: all authenticated can read; admins can modify
- User roles: users read own; admins manage all
- Role permissions: all authenticated can read; admins can modify
- Zoho applications: all authenticated can read; admins can modify
- Audit logs: only admins can read; any authenticated can insert (append-only)
- log_audit(): SECURITY DEFINER function for inserting audit entries
*/

-- ============================================================
-- SECURITY DEFINER FUNCTION: is_admin()
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'Admin'
  );
$$;

GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- ============================================================
-- PROFILES POLICIES
-- ============================================================
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR is_admin());

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id OR is_admin())
  WITH CHECK (auth.uid() = id OR is_admin());

DROP POLICY IF EXISTS "insert_profile" ON profiles;
CREATE POLICY "insert_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id OR is_admin());

DROP POLICY IF EXISTS "delete_profile" ON profiles;
CREATE POLICY "delete_profile" ON profiles FOR DELETE
  TO authenticated USING (is_admin());

-- ============================================================
-- ROLES POLICIES
-- ============================================================
DROP POLICY IF EXISTS "select_roles" ON roles;
CREATE POLICY "select_roles" ON roles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_role" ON roles;
CREATE POLICY "insert_role" ON roles FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "update_role" ON roles;
CREATE POLICY "update_role" ON roles FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "delete_role" ON roles;
CREATE POLICY "delete_role" ON roles FOR DELETE
  TO authenticated USING (is_admin());

-- ============================================================
-- PERMISSIONS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "select_permissions" ON permissions;
CREATE POLICY "select_permissions" ON permissions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_permission" ON permissions;
CREATE POLICY "insert_permission" ON permissions FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "update_permission" ON permissions;
CREATE POLICY "update_permission" ON permissions FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "delete_permission" ON permissions;
CREATE POLICY "delete_permission" ON permissions FOR DELETE
  TO authenticated USING (is_admin());

-- ============================================================
-- USER_ROLES POLICIES
-- ============================================================
DROP POLICY IF EXISTS "select_user_roles" ON user_roles;
CREATE POLICY "select_user_roles" ON user_roles FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "insert_user_role" ON user_roles;
CREATE POLICY "insert_user_role" ON user_roles FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "update_user_role" ON user_roles;
CREATE POLICY "update_user_role" ON user_roles FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "delete_user_role" ON user_roles;
CREATE POLICY "delete_user_role" ON user_roles FOR DELETE
  TO authenticated USING (is_admin());

-- ============================================================
-- ROLE_PERMISSIONS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "select_role_permissions" ON role_permissions;
CREATE POLICY "select_role_permissions" ON role_permissions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_role_permission" ON role_permissions;
CREATE POLICY "insert_role_permission" ON role_permissions FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "update_role_permission" ON role_permissions;
CREATE POLICY "update_role_permission" ON role_permissions FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "delete_role_permission" ON role_permissions;
CREATE POLICY "delete_role_permission" ON role_permissions FOR DELETE
  TO authenticated USING (is_admin());

-- ============================================================
-- ZOHO_APPLICATIONS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "select_zoho_apps" ON zoho_applications;
CREATE POLICY "select_zoho_apps" ON zoho_applications FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_zoho_app" ON zoho_applications;
CREATE POLICY "insert_zoho_app" ON zoho_applications FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "update_zoho_app" ON zoho_applications;
CREATE POLICY "update_zoho_app" ON zoho_applications FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "delete_zoho_app" ON zoho_applications;
CREATE POLICY "delete_zoho_app" ON zoho_applications FOR DELETE
  TO authenticated USING (is_admin());

-- ============================================================
-- AUDIT_LOGS POLICIES (append-only: no UPDATE or DELETE)
-- ============================================================
DROP POLICY IF EXISTS "select_audit_logs" ON audit_logs;
CREATE POLICY "select_audit_logs" ON audit_logs FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "insert_audit_log" ON audit_logs;
CREATE POLICY "insert_audit_log" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (true);

-- ============================================================
-- FUNCTION: log_audit
-- ============================================================
CREATE OR REPLACE FUNCTION log_audit(
  p_action text,
  p_target_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (action, actor_id, target_id, details)
  VALUES (p_action, auth.uid(), p_target_id, p_details);
END;
$$;

GRANT EXECUTE ON FUNCTION log_audit(text, uuid, jsonb) TO authenticated;