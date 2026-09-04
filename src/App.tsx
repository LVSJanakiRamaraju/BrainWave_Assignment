import { useState } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import AdminPage from "@/pages/AdminPage";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Building2, Loader2 } from "lucide-react";

function ConfigurationNotice() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white shadow-2xl">
        <Building2 className="mx-auto mb-4 h-10 w-10 text-blue-400" />
        <h1 className="text-2xl font-bold">BrainWave Portal</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to a local .env file, then restart the development server.
        </p>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, loading, isAdmin } = useAuth();
  const [page, setPage] = useState<string>("dashboard");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30 mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <div className="flex items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading your portal...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (page === "admin" && isAdmin) {
    return <AdminPage onNavigate={setPage} />;
  }

  return <DashboardPage onNavigate={setPage} />;
}

export default function App() {
  if (!isSupabaseConfigured) {
    return <ConfigurationNotice />;
  }

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
