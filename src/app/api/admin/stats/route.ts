import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import { isAdminEmail } from "@/lib/admin";
import { getAdminDashboardStats } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email || !isAdminEmail(email)) {
    return NextResponse.json(
      { error: "Not found" },
      {
        status: 404,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, private",
        },
      }
    );
  }

  try {
    const stats = await getAdminDashboardStats();
    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  } catch (err) {
    console.error("Failed to load admin stats:", err);
    return NextResponse.json(
      { error: "Failed to load stats" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, private",
        },
      }
    );
  }
}
