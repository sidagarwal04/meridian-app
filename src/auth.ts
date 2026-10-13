import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { recordUserSignIn } from "@/lib/telemetry";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: { prompt: "select_account" },
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  events: {
    signIn({ user }) {
      if (user?.email) {
        void recordUserSignIn({
          email: user.email,
          name: user.name,
          image: user.image,
        }).catch(() => {});
      }
    },
  },
};
