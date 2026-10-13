"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { AuthProvider } from "./AuthProvider";
import { PwaProvider } from "./PwaManager";
import { TelemetryTracker } from "./TelemetryTracker";
import { I18nProvider } from "@/lib/i18n";

export function Providers({ children, session }: { children: React.ReactNode; session?: Session | null }) {
  return (
    <SessionProvider session={session}>
      <I18nProvider>
        <AuthProvider>
          <PwaProvider>
            <TelemetryTracker />
            {children}
          </PwaProvider>
        </AuthProvider>
      </I18nProvider>
    </SessionProvider>
  );
}
