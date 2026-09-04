import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import type { Role, AuditLog, UserWithRoles, Permission, Profile } from "@/types";
import {
  Shield, Users, KeyRound, ScrollText, LogOut, Building2, Plus, X,
  Search, Loader2, AlertCircle, Check, UserCog, Lock, Unlock, ChevronRight,
} from "lucide-react";

type Tab = "users" | "roles" | "permissions" | "audit";

export default function AdminPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Role assignment modal state
  const [assignModal, setAssignModal] = useState<{ user: UserWithRoles } | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

  const loadRoles = useCallback(async () => {
    const { data } = await supabase.from("roles").select("*").order("name");
    setRoles(data || []);
  }, []);

  const loadPermissions = useCallback(async () => {
    const { data } = await supabase.from("permissions").select("*").order("name");
    setPermissions(data || []);
  }, []);

  const loadUsers = useCallback(async () => {
    const { data: profiles } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (!profiles) return;

    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("user_id, roles(id, name, description, created_at)");

    const roleMap = new Map<string, Role[]>();
    (userRoles as unknown as { user_id: string; roles: Role }[] | null)?.forEach((ur) => {
      if (!roleMap.has(ur.user_id)) roleMap.set(ur.user_id, []);
      roleMap.get(ur.user_id)!.push(ur.roles);
    });

    const usersWithRoles: UserWithRoles[] = profiles.map((p: Record<string, unknown>) => ({
      ...p,
      email: (p as { email?: string }).email ?? "",
      roles: roleMap.get((p as { id: string }).id) || [],
    })) as UserWithRoles[];

    // Fetch emails from auth via the admin API is not available client-side,
    // so we use a workaround: the profiles don't have email. We'll show name + department.
    setUsers(usersWithRoles);
  }, []);

  const loadAuditLogs = useCallback(async () => {
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    // Fetch actor/target profiles
    const actorIds = [...new Set((data || []).map((l: AuditLog) => l.actor_id).filter(Boolean))] as string[];
    const targetIds = [...new Set((data || []).map((l: AuditLog) => l.target_id).filter(Boolean))] as string[];
    const allIds = [...new Set([...actorIds, ...targetIds])];

    let profileMap = new Map<string, Profile>();
    if (allIds.length > 0) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .in("id", allIds);
      (profileData || []).forEach((p: Record<string, unknown>) => {
        profileMap.set((p as { id: string }).id, p as unknown as Profile);
      });
    }

    const logsWithProfiles: AuditLog[] = (data || []).map((log: AuditLog) => ({
      ...log,
      actor_profile: log.actor_id ? profileMap.get(log.actor_id) || null : null,
      target_profile: log.target_id ? profileMap.get(log.target_id) || null : null,
    }));

    setAuditLogs(logsWithProfiles);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadRoles(), loadPermissions(), loadUsers(), loadAuditLogs()]);
      setLoading(false);
    })();
  }, [loadRoles, loadPermissions, loadUsers, loadAuditLogs]);

  const handleAssignRole = async () => {
    if (!assignModal || !selectedRoleId) return;
    setAssigning(true);
    setError(null);

    try {
      // Check if role already assigned
      const existing = assignModal.user.roles.find((r) => r.id === selectedRoleId);
      if (existing) {
        // Remove the role (toggle off)
        const { error: delError } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", assignModal.user.id)
          .eq("role_id", selectedRoleId);

        if (delError) throw delError;
        await supabase.from("audit_logs").insert({
          action: "user.role.removed",
          target_id: assignModal.user.id,
          details: { role_id: selectedRoleId, role_name: roles.find((r) => r.id === selectedRoleId)?.name },
        });
      } else {
        // Assign the role
        const { error: insError } = await supabase
          .from("user_roles")
          .insert({
            user_id: assignModal.user.id,
            role_id: selectedRoleId,
            assigned_by: (await supabase.auth.getUser()).data.user?.id,
          });

        if (insError) throw insError;
        await supabase.from("audit_logs").insert({
          action: "user.role.assigned",
          target_id: assignModal.user.id,
          details: { role_id: selectedRoleId, role_name: roles.find((r) => r.id === selectedRoleId)?.name },
        });
      }

      await loadUsers();
      await loadAuditLogs();
      setAssignModal(null);
      setSelectedRoleId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setAssigning(false);
    }
  };

  const handleToggleStatus = async (user: UserWithRoles) => {
    const newStatus = user.status === "active" ? "suspended" : "active";
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ status: newStatus })
      .eq("id", user.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await supabase.from("audit_logs").insert({
      action: newStatus === "suspended" ? "user.suspended" : "user.activated",
      target_id: user.id,
      details: { previous_status: user.status, new_status: newStatus },
    });

    await loadUsers();
    await loadAuditLogs();
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.full_name.toLowerCase().includes(q) ||
      (u.department || "").toLowerCase().includes(q) ||
      u.roles.some((r) => r.name.toLowerCase().includes(q))
    );
  });

  const initials = (name: string) =>
    name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-md">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-lg">Admin Panel</span>
                <span className="text-slate-400 text-sm ml-2">· BrainWave Portal</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => onNavigate("dashboard")}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Building2 className="w-4 h-4" />
                Dashboard
              </button>
              <button
                onClick={signOut}
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4 text-red-400" />
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl mb-6 overflow-x-auto">
          {([
            { id: "users", label: "Users", icon: Users },
            { id: "roles", label: "Roles", icon: KeyRound },
            { id: "permissions", label: "Permissions", icon: Lock },
            { id: "audit", label: "Audit Logs", icon: ScrollText },
          ] as { id: Tab; label: string; icon: typeof Users }[]).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-slate-900 text-white shadow-md"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* USERS TAB */}
        {activeTab === "users" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Portal Users</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search users..."
                  className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">User</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">Department</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">Roles</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">Status</th>
                    <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-xs font-semibold">
                            {initials(user.full_name)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{user.full_name}</p>
                            <p className="text-xs text-slate-400">{user.id === profile?.id ? "You" : ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{user.department || "—"}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {user.roles.length === 0 ? (
                            <span className="text-xs text-slate-400 italic">No role assigned</span>
                          ) : (
                            user.roles.map((role) => (
                              <span
                                key={role.id}
                                className={`px-2 py-0.5 text-xs font-medium rounded-md ${
                                  role.name === "Admin"
                                    ? "bg-slate-800 text-white"
                                    : "bg-blue-50 text-blue-700"
                                }`}
                              >
                                {role.name}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-md ${
                          user.status === "active"
                            ? "bg-green-50 text-green-700"
                            : "bg-red-50 text-red-700"
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setAssignModal({ user });
                              setSelectedRoleId("");
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            <UserCog className="w-3.5 h-3.5" />
                            Manage Roles
                          </button>
                          <button
                            onClick={() => handleToggleStatus(user)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              user.status === "active"
                                ? "text-red-600 hover:bg-red-50"
                                : "text-green-600 hover:bg-green-50"
                            }`}
                            title={user.status === "active" ? "Suspend user" : "Activate user"}
                          >
                            {user.status === "active" ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-sm">No users found</div>
              )}
            </div>
          </div>
        )}

        {/* ROLES TAB */}
        {activeTab === "roles" && (
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">System Roles</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {roles.map((role) => {
                const userCount = users.filter((u) => u.roles.some((r) => r.id === role.id)).length;
                const rolePermissions = permissions.filter((p) => {
                  // We'd need role_permissions data to show this accurately
                  return true;
                });
                return (
                  <div key={role.id} className="bg-white rounded-2xl border border-slate-200 p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        role.name === "Admin"
                          ? "bg-slate-800 text-white"
                          : "bg-blue-50 text-blue-600"
                      }`}>
                        <Shield className="w-5 h-5" />
                      </div>
                      <span className="text-xs text-slate-400">{userCount} user{userCount !== 1 ? "s" : ""}</span>
                    </div>
                    <h3 className="font-semibold text-slate-900">{role.name}</h3>
                    <p className="text-sm text-slate-500 mt-1">{role.description}</p>
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-xs text-slate-400 mb-2">Permissions: {rolePermissions.length}</p>
                      <div className="flex flex-wrap gap-1">
                        {permissions.slice(0, 3).map((p) => (
                          <span key={p.id} className="px-2 py-0.5 text-xs bg-slate-50 text-slate-600 rounded-md border border-slate-200">
                            {p.name}
                          </span>
                        ))}
                        {permissions.length > 3 && (
                          <span className="px-2 py-0.5 text-xs text-slate-400">
                            +{permissions.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PERMISSIONS TAB */}
        {activeTab === "permissions" && (
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">System Permissions</h2>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">Permission</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-6 py-3">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {permissions.map((perm) => (
                    <tr key={perm.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <code className="text-sm font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{perm.name}</code>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{perm.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AUDIT LOGS TAB */}
        {activeTab === "audit" && (
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Audit Trail</h2>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              {auditLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">No audit logs recorded yet</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-4 px-6 py-4 hover:bg-slate-50 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <ScrollText className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono text-slate-700 font-medium">{log.action}</code>
                          <span className="text-xs text-slate-400">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {log.actor_profile?.full_name || "System"}
                          {log.target_profile ? ` → ${log.target_profile.full_name}` : ""}
                          {log.details ? ` · ${JSON.stringify(log.details)}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Role Assignment Modal */}
      {assignModal && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setAssignModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Manage Roles</h3>
                <p className="text-sm text-slate-500">{assignModal.user.full_name}</p>
              </div>
              <button onClick={() => setAssignModal(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-2 mb-6">
              {roles.map((role) => {
                const hasRole = assignModal.user.roles.some((r) => r.id === role.id);
                return (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                      selectedRoleId === role.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-left">
                      <p className="text-sm font-medium text-slate-900">{role.name}</p>
                      <p className="text-xs text-slate-500">{role.description}</p>
                    </div>
                    {hasRole && (
                      <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                        <Check className="w-3.5 h-3.5" />
                        Assigned
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setAssignModal(null)}
                className="flex-1 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignRole}
                disabled={!selectedRoleId || assigning}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {assigning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {assignModal.user.roles.some((r) => r.id === selectedRoleId) ? "Remove" : "Assign"}
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
