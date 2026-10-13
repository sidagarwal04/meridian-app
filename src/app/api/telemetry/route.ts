import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import { recordExportEvent, recordVisit } from "@/lib/telemetry";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      type?: "visit" | "export";
      path?: string;
      visitorId?: string;
      referrer?: string;
      projectId?: string;
      title?: string;
      format?: string;
      aspect?: string;
      resolution?: string;
      fps?: number;
      stopsCount?: number;
    };

    if (body.type === "visit") {
      void recordVisit({
        path: body.path || "/",
        visitorId: body.visitorId,
        referrer: body.referrer,
      }).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    if (body.type === "export") {
      const session = await getServerSession(authOptions);
      void recordExportEvent({
        userEmail: session?.user?.email,
        projectId: body.projectId,
        title: body.title,
        format: body.format,
        aspect: body.aspect,
        resolution: body.resolution,
        fps: body.fps,
        stopsCount: body.stopsCount,
      }).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
