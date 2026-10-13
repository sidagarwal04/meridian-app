"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { signOut as googleSignOut, useSession } from "next-auth/react";
import { accountFor, clearSession, defaultAccount, persistSession } from "@/lib/storage";
import type { User } from "@/lib/types";

type AuthValue = {
  ready: boolean;
  user: User | null;
  signOut: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    const email = session?.user?.email;
    if (!email) {
      setUser(null);
      return;
    }
    const nextUser: User = {
      email,
      name: session.user?.name || email.split("@")[0] || "Traveler",
      provider: "google",
      image: session.user?.image,
    };
    const nextAccount = accountFor(email) ?? defaultAccount();
    setUser(nextUser);
    persistSession(nextUser, nextAccount);
  }, [session, status]);

  const value: AuthValue = {
    ready: status !== "loading",
    user,
    signOut: () => {
      clearSession();
      setUser(null);
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
