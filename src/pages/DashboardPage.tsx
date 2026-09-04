import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAuthorizedApps, launchZohoApp } from "@/services/zoho";
import type { ZohoAppResponse } from "@/types";
import {
  Users, Briefcase, Headphones, BookOpen, LayoutDashboard,
  ExternalLink, LogOut, Shield, Sparkles, AlertCircle, Loader2, Building2,
} from "lucide-react";

const iconMap: Record<string, typeof Users> = {
  Users,
  Briefcase,
  Headphones,
  BookOpen,
  LayoutDashboard,
};

const categoryColors: Record<string, string> = {
  HR: "from-emerald-500 to-teal-600",
  Sales: "from-blue-500 to-indigo-600",
  Support: "from-amber-500 to-orange-600",
  Finance: "from-violet-500 to-purple-600",
  Admin: "from-slate-600 to-slate-800",
};

export default function DashboardPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { profile, roles, signOut, isAdmin } = useAuth();
  const [apps, setApps] = useState<ZohoAppResponse[]>([]);
  const [roleNames, setRoleNames] = useState<string[]>([]);
  const [zohoConnected, setZohoConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadApps();
  }, []);

  const loadApps = async () => {
    try {
      setLoading(true);
      const data = await fetchAuthorizedApps();
      setApps(data.applications);
      setRoleNames(data.roles);
      setZohoConnected(data.zoho_connected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  const handleLaunch = async (appName: string) => {
    try {
      setLaunching(appName);
      setError(null);
      const result = await launchZohoApp(appName);
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to launch application");
    } finally {
      setLaunching(null);
    }
  };

  const primaryRole = roles[0]?.name ?? "User";
  const initials = (profile?.full_name ?? "U")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-md shadow-blue-600/20">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-lg">BrainWave Portal</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {isAdmin && (
                <button
                  onClick={() => onNavigate("admin")}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Shield className="w-4 h-4" />
                  Admin Panel
                </button>
              )}
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-slate-900">{profile?.full_name}</p>
                  <p className="text-xs text-slate-500">{primaryRole}</p>
                </div>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-sm font-semibold">
                  {initials}
                </div>
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
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Banner */}
        <div className="mb-8 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <div className="flex items-center gap-2 text-blue-400 text-sm font-medium mb-2">
              <Sparkles className="w-4 h-4" />
              Welcome back
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">{profile?.full_name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {roleNames.map((role) => (
                <span
                  key={role}
                  className="px-3 py-1 bg-white/10 backdrop-blur text-white text-xs font-medium rounded-full border border-white/10"
                >
                  {role}
                </span>
              ))}
              <span className="px-3 py-1 bg-white/10 backdrop-blur text-slate-300 text-xs font-medium rounded-full border border-white/10">
                {profile?.department || "Unassigned"}
              </span>
            </div>
          </div>
        </div>

        {/* Zoho Connection Status */}
        {!zohoConnected && !loading && (
          <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900">Zoho API not yet connected</p>
              <p className="text-xs text-amber-700 mt-1">
                The backend service account needs Zoho OAuth credentials configured. App launch buttons will open Zoho URLs directly. Contact your administrator.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Applications Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Your Authorized Applications</h2>
            <span className="text-sm text-slate-500">{apps.length} app{apps.length !== 1 ? "s" : ""} available</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : apps.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium">No applications assigned</p>
              <p className="text-sm text-slate-400 mt-1">Contact your administrator to get a role assigned.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {apps.map((app) => {
                const Icon = iconMap[app.icon] || LayoutDashboard;
                const gradient = categoryColors[app.category] || "from-slate-600 to-slate-800";
                return (
                  <div
                    key={app.name}
                    className="group bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-xl hover:border-slate-300 transition-all duration-300"
                  >
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg mb-4 group-hover:scale-110 transition-transform`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-1">{app.name}</h3>
                    <p className="text-sm text-slate-500 mb-4 line-clamp-2">{app.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                        {app.category}
                      </span>
                      <button
                        onClick={() => handleLaunch(app.name)}
                        disabled={launching === app.name}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        {launching === app.name ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            Launch
                            <ExternalLink className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Role Info Section */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              Your Access Level
            </h3>
            <div className="space-y-3">
              {roleNames.map((role) => (
                <div key={role} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <span className="text-sm font-medium text-slate-700">{role}</span>
                  <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-md font-medium">Active</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Account Details</h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-slate-500">Name</dt>
                <dd className="text-sm font-medium text-slate-900">{profile?.full_name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-slate-500">Email</dt>
                <dd className="text-sm font-medium text-slate-900">{profile?.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-slate-500">Department</dt>
                <dd className="text-sm font-medium text-slate-900">{profile?.department || "Unassigned"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-slate-500">Status</dt>
                <dd className="text-sm">
                  <span className={`px-2 py-1 rounded-md font-medium ${
                    profile?.status === "active"
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}>
                    {profile?.status || "active"}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </main>
    </div>
  );
}
