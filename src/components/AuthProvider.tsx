"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { signOut as googleSignOut, useSession } from "next-auth/react";
import { accountFor, clearSession, defaultAccount, persistSession } from "@/lib/storage";
import type { User } from "@/lib/types";

type AuthValue = {
  ready: boolean;
  user: User | null;
  signOut: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

function userFromSession(session: { user?: { email?: string | null; name?: string | null; image?: string | null } } | null): User | null {
  const email = session?.user?.email;
  if (!email) return null;
  return {
    email,
    name: session.user?.name || email.split("@")[0] || "Traveler",
    provider: "google",
    image: session.user?.image,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const user = useMemo(() => (status === "authenticated" ? userFromSession(session) : null), [session, status]);

  useEffect(() => {
    if (!user) return;
    persistSession(user, accountFor(user.email) ?? defaultAccount());
  }, [user]);

  const value: AuthValue = {
    ready: status !== "loading",
    user,
    signOut: () => {
      clearSession();
      void googleSignOut({ callbackUrl: "/" });
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
