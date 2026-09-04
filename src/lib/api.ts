import type { AuditLog, Permission, Profile, Role, UserWithRoles, ZohoAppResponse } from "@/types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const TOKEN_KEY = "brainwave_token";

export interface PortalUser extends Profile { email: string }
export interface AuthResponse { token: string; user: PortalUser; profile: Profile; roles: Role[] }

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data as T;
}

export const api = {
  login: (email: string, password: string) => request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  signup: (email: string, password: string, fullName: string, department: string) => request<{ message: string }>("/auth/signup", { method: "POST", body: JSON.stringify({ email, password, fullName, department }) }),
  me: () => request<AuthResponse>("/auth/me"),
  apps: () => request<{ applications: ZohoAppResponse[]; roles: string[]; zoho_connected: boolean }>("/apps"),
  launch: (appName: string) => request<{ app_name: string; url: string; zoho_connected: boolean }>("/apps/launch", { method: "POST", body: JSON.stringify({ app_name: appName }) }),
  admin: () => request<{ roles: Role[]; permissions: Permission[]; users: UserWithRoles[]; auditLogs: AuditLog[] }>("/admin/bootstrap"),
  toggleRole: (userId: string, roleId: string) => request<{ message: string }>(`/admin/users/${userId}/roles/${roleId}/toggle`, { method: "POST" }),
  toggleStatus: (userId: string) => request<{ status: Profile["status"] }>(`/admin/users/${userId}/status`, { method: "PATCH" }),
};

export function saveToken(token: string) { localStorage.setItem(TOKEN_KEY, token); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }
export function hasToken() { return Boolean(localStorage.getItem(TOKEN_KEY)); }
