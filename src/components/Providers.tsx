"use client";

import { SessionProvider } from "next-auth/react";
import { AuthProvider } from "./AuthProvider";
import { I18nProvider } from "@/lib/i18n";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <I18nProvider>
        <AuthProvider>{children}</AuthProvider>
      </I18nProvider>
    </SessionProvider>
  );
}
