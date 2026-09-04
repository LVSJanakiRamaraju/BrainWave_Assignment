import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, clearToken, hasToken, saveToken, type PortalUser } from "@/lib/api";
import type { Profile, Role } from "@/types";

interface AuthContextValue {
  session: { access_token: string } | null;
  user: PortalUser | null;
  profile: Profile | null;
  roles: Role[];
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, department: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [user, setUser] = useState<PortalUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const applyAuth = (data: Awaited<ReturnType<typeof api.login>>) => { saveToken(data.token); setSession({ access_token: data.token }); setUser(data.user); setProfile(data.profile); setRoles(data.roles); };

  useEffect(() => {
    if (!hasToken()) { setLoading(false); return; }
    api.me().then((data) => { setUser(data.user); setProfile(data.profile); setRoles(data.roles); setSession({ access_token: localStorage.getItem("brainwave_token")! }); }).catch(clearToken).finally(() => setLoading(false));
  }, []);
  const signIn = async (email: string, password: string) => { try { applyAuth(await api.login(email, password)); return { error: null }; } catch (error) { return { error: error instanceof Error ? error.message : "Unable to sign in" }; } };
  const signUp = async (email: string, password: string, fullName: string, department: string) => { try { await api.signup(email, password, fullName, department); return { error: null }; } catch (error) { return { error: error instanceof Error ? error.message : "Unable to create account" }; } };
  const signOut = async () => { clearToken(); setSession(null); setUser(null); setProfile(null); setRoles([]); };
  const refreshProfile = async () => { const data = await api.me(); setUser(data.user); setProfile(data.profile); setRoles(data.roles); };
  const isAdmin = roles.some((role) => role.name === "Admin");
  return <AuthContext.Provider value={{ session, user, profile, roles, loading, isAdmin, signIn, signUp, signOut, refreshProfile }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error("useAuth must be used within AuthProvider"); return context; }
