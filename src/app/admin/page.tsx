import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { AdminDashboard } from "@/components/AdminDashboard";
import { isAdminEmail } from "@/lib/admin";
import { getAdminDashboardStats } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Private Admin Telemetry",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    redirect("/login?next=/admin");
  }

  if (!isAdminEmail(email)) {
    notFound();
  }

  const initialStats = await getAdminDashboardStats();

  return <AdminDashboard initialStats={initialStats} adminEmail={email} />;
}
