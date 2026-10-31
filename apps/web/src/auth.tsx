import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api } from "./api";
import type { User } from "./types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  register: (name: string, username: string, email: string, phone: string, password: string) => Promise<User>;
  registerRecruiter: (input: { name: string; username: string; email: string; phone: string; password: string; companyName: string; companyDescription?: string; companyWebsite?: string; companyLocation?: string }) => Promise<User>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    try {
      const result = await api<{ user: User }>("/auth/me");
      setUser(result.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void refresh(); }, []);
  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    refresh,
    async signIn(email, password) {
      const result = await api<{ user: User }>("/auth/login", { method: "POST", body: { email, password } });
      setUser(result.user);
      return result.user;
    },
    async register(name, username, email, phone, password) {
      const result = await api<{ user: User }>("/auth/register", { method: "POST", body: { name, username, email, phone, password } });
      setUser(result.user);
      return result.user;
    },
    async registerRecruiter(input) {
      const result = await api<{ user: User }>("/auth/register-recruiter", { method: "POST", body: input });
      setUser(result.user);
      return result.user;
    },
    async signOut() {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
    },
  }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider.");
  return value;
}
