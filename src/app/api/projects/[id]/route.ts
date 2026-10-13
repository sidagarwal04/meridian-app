import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import { deleteCloudProject, getCloudProject, saveCloudProject } from "@/lib/cloudStore";
import type { Project } from "@/lib/types";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const project = await getCloudProject(email, id);
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ project });
  } catch (err) {
    console.error("Failed to get cloud project:", err);
    return NextResponse.json({ error: "Failed to load project" }, { status: 500 });
  }
}

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    const body = (await req.json()) as { project?: Project };
    if (!body.project) {
      return NextResponse.json({ error: "Missing project" }, { status: 400 });
    }
    const saved = await saveCloudProject(email, { ...body.project, id });
    return NextResponse.json({ project: saved });
  } catch (err) {
    console.error("Failed to update cloud project:", err);
    return NextResponse.json({ error: "Failed to save project" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    await deleteCloudProject(email, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete cloud project:", err);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
