import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import { listCloudProjects, saveCloudProject } from "@/lib/cloudStore";
import type { Project } from "@/lib/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projects = await listCloudProjects(email);
    return NextResponse.json({ projects });
  } catch (err) {
    console.error("Failed to list cloud projects:", err);
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { project?: Project; projects?: Project[] };
    if (Array.isArray(body.projects)) {
      const saved = await Promise.all(
        body.projects
          .filter((p): p is Project => Boolean(p && p.id))
          .map((p) => saveCloudProject(email, p))
      );
      return NextResponse.json({ projects: saved });
    }
    if (body.project && body.project.id) {
      const saved = await saveCloudProject(email, body.project);
      return NextResponse.json({ project: saved });
    }
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  } catch (err) {
    console.error("Failed to save cloud projects:", err);
    return NextResponse.json({ error: "Failed to save projects" }, { status: 500 });
  }
}
