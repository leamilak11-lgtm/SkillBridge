import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api } from "./api";
import type { User } from "./types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<RegistrationResult>;
  registerRecruiter: (input: { name: string; email: string; password: string; companyName: string; companyDescription?: string; companyWebsite?: string; companyLocation?: string }) => Promise<RegistrationResult>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};
export type RegistrationResult = { message: string; developmentVerificationUrl?: string };
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
    async register(name, email, password) {
      return api<RegistrationResult>("/auth/register", { method: "POST", body: { name, email, password } });
    },
    async registerRecruiter(input) {
      return api<RegistrationResult>("/auth/register-recruiter", { method: "POST", body: input });
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
