import { getStore, type Store } from "@netlify/blobs";
import { promises as fs } from "fs";
import path from "path";
import { THEMES, defaultStyle, type Project, type ThemeId } from "./types";

const STORE_NAME = "meridian-projects";
const LOCAL_FALLBACK_FILE = path.join(process.cwd(), ".data", "cloud-projects.json");

function emailPrefix(email: string): string {
  return `u/${Buffer.from(email.trim().toLowerCase()).toString("base64url")}/`;
}

function projectKey(email: string, projectId: string): string {
  const safeId = projectId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `${emailPrefix(email)}${safeId}`;
}

/**
 * Strips stop photos before persisting to the cloud so user photos
 * are never uploaded to or stored on our servers.
 */
export function stripProjectPhotos(project: Project, ownerEmail?: string): Project {
  const mergedStyle = { ...defaultStyle(), ...(project?.style ?? {}) };
  const rawTheme = mergedStyle.theme as string | undefined;
  const validTheme: ThemeId = rawTheme && rawTheme in THEMES ? (rawTheme as ThemeId) : "earth";

  return {
    id: project.id,
    title: project.title || "My trip",
    createdAt: project.createdAt || Date.now(),
    updatedAt: project.updatedAt || Date.now(),
    ownerEmail: ownerEmail ? ownerEmail.trim().toLowerCase() : project.ownerEmail,
    stops: (project.stops ?? []).map((stop) => ({
      ...stop,
      photos: [],
    })),
    legs: project.legs ?? [],
    style: {
      ...mergedStyle,
      theme: validTheme,
    },
  };
}

function resolveNetlifyStore(): Store | null {
  try {
    const hasAutoContext =
      Boolean(process.env.NETLIFY_BLOBS_CONTEXT) ||
      Boolean((globalThis as { netlifyBlobsContext?: unknown }).netlifyBlobsContext);

    if (hasAutoContext) {
      return getStore({ name: STORE_NAME, consistency: "strong" });
    }

    const siteID = process.env.NETLIFY_SITE_ID;
    const token = process.env.NETLIFY_AUTH_TOKEN;
    if (siteID && token) {
      return getStore({ name: STORE_NAME, siteID, token, consistency: "strong" });
    }
  } catch {
    // Fall back to local file store in non-Netlify dev environments
  }
  return null;
}

type LocalStoreData = Record<string, Project>;

async function readLocalStore(): Promise<LocalStoreData> {
  try {
    const raw = await fs.readFile(LOCAL_FALLBACK_FILE, "utf8");
    return JSON.parse(raw) as LocalStoreData;
  } catch {
    return {};
  }
}

async function writeLocalStore(data: LocalStoreData): Promise<void> {
  await fs.mkdir(path.dirname(LOCAL_FALLBACK_FILE), { recursive: true });
  await fs.writeFile(LOCAL_FALLBACK_FILE, JSON.stringify(data, null, 2), "utf8");
}

export async function listCloudProjects(email: string): Promise<Project[]> {
  const store = resolveNetlifyStore();
  const prefix = emailPrefix(email);

  if (store) {
    const { blobs } = await store.list({ prefix });
    const items = await Promise.all(
      blobs.map(async (b) => {
        try {
          return (await store.get(b.key, { type: "json" })) as Project | null;
        } catch {
          return null;
        }
      })
    );
    return items
      .filter((item): item is Project => Boolean(item && item.id))
      .map((item) => stripProjectPhotos(item, email))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  const all = await readLocalStore();
  return Object.entries(all)
    .filter(([key]) => key.startsWith(prefix))
    .map(([, project]) => stripProjectPhotos(project, email))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getCloudProject(email: string, projectId: string): Promise<Project | null> {
  const store = resolveNetlifyStore();
  const key = projectKey(email, projectId);

  if (store) {
    const found = (await store.get(key, { type: "json" })) as Project | null;
    return found ? stripProjectPhotos(found, email) : null;
  }

  const all = await readLocalStore();
  const found = all[key];
  return found ? stripProjectPhotos(found, email) : null;
}

export async function saveCloudProject(email: string, project: Project): Promise<Project> {
  const sanitized = stripProjectPhotos(project, email);
  const store = resolveNetlifyStore();
  const key = projectKey(email, sanitized.id);

  if (store) {
    await store.setJSON(key, sanitized);
    return sanitized;
  }

  const all = await readLocalStore();
  all[key] = sanitized;
  await writeLocalStore(all);
  return sanitized;
}

export async function deleteCloudProject(email: string, projectId: string): Promise<void> {
  const store = resolveNetlifyStore();
  const key = projectKey(email, projectId);

  if (store) {
    await store.delete(key);
    return;
  }

  const all = await readLocalStore();
  delete all[key];
  await writeLocalStore(all);
}
