import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { LoginForm } from "@/components/LoginForm";

function safeNextPath(raw?: string | string[]) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return "/videos";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const parsed = new URL(value);
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/videos";
  } catch {
    return "/videos";
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; callbackUrl?: string | string[] }>;
}) {
  const session = await getServerSession(authOptions);
  const params = await searchParams;
  if (session?.user?.email) {
    redirect(safeNextPath(params.next ?? params.callbackUrl));
  }
  const googleReady = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  return (
    <Suspense fallback={null}>
      <LoginForm googleReady={googleReady} />
    </Suspense>
  );
}
