export interface Profile {
  id: string;
  full_name: string;
  department: string | null;
  status: "active" | "suspended";
  created_at: string;
  email?: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Permission {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  assigned_by: string | null;
  assigned_at: string;
  roles?: Role;
}

export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  created_at: string;
  permissions?: Permission;
}

export interface ZohoApplication {
  id: string;
  name: string;
  description: string | null;
  url: string;
  icon: string | null;
  category: string | null;
  role_id: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  action: string;
  actor_id: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  actor_profile?: Profile | null;
  target_profile?: Profile | null;
}

export interface UserWithRoles extends Profile {
  email: string;
  roles: Role[];
}

export interface ZohoAppResponse {
  name: string;
  url: string;
  category: string;
  icon: string;
  description: string;
}
