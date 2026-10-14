import { getStore, type Store } from "@netlify/blobs";
import { promises as fs } from "fs";
import path from "path";
import { THEMES, defaultStyle, type Project, type ThemeId } from "./types";

export const STORE_NAME = "meridian-projects";
const LOCAL_FALLBACK_FILE = path.join(process.cwd(), ".data", "cloud-projects.json");

function emailPrefix(email: string): string {
  return `u/${Buffer.from(email.trim().toLowerCase()).toString("base64url")}/`;
}

function decodeEmailFromKey(key: string): string | undefined {
  if (!key.startsWith("u/")) return undefined;
  const parts = key.split("/");
  if (parts.length < 3 || !parts[1]) return undefined;
  try {
    return Buffer.from(parts[1], "base64url").toString("utf8").trim().toLowerCase();
  } catch {
    return undefined;
  }
}

function projectKey(email: string, projectId: string): string {
  const safeId = projectId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `${emailPrefix(email)}${safeId}`;
}

/**
 * Custom fetch wrapper for Netlify Blobs so missing keys on S3 signed URLs (which can return 403)
 * or slow network calls do not trigger @netlify/blobs's 5 × 5s (25-second) retry loop.
 */
export const fastBlobsFetch: typeof fetch = async (input, init) => {
  try {
    const res = await fetch(input, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(5000),
    });
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();

    if (!urlStr.includes("api.netlify.com") && res.status === 403 && method === "GET") {
      return new Response(null, { status: 404, headers: res.headers });
    }
    if (res.status === 403 || res.status === 429 || res.status >= 500) {
      return new Response(res.body, { status: 400, headers: res.headers });
    }
    return res;
  } catch {
    return new Response(null, { status: 400 });
  }
};

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

export function resolveNetlifyStore(): Store | null {
  try {
    const hasAutoContext =
      Boolean(process.env.NETLIFY_BLOBS_CONTEXT) ||
      Boolean((globalThis as { netlifyBlobsContext?: unknown }).netlifyBlobsContext);

    if (hasAutoContext) {
      return getStore({ name: STORE_NAME, consistency: "strong", fetch: fastBlobsFetch });
    }

    const siteID = process.env.NETLIFY_SITE_ID;
    const token = process.env.NETLIFY_AUTH_TOKEN;
    if (siteID && token) {
      return getStore({ name: STORE_NAME, siteID, token, consistency: "strong", fetch: fastBlobsFetch });
    }
  } catch {
    // Fall back to local file store in non-Netlify dev environments
  }
  return null;
}

type LocalStoreData = Record<string, Project>;

const userProjectsMemCache = new Map<string, { expiresAt: number; byId: Map<string, Project> }>();
const MEM_CACHE_TTL_MS = 60_000;

function getMemCacheForEmail(email: string): Map<string, Project> | null {
  const norm = email.trim().toLowerCase();
  const entry = userProjectsMemCache.get(norm);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    userProjectsMemCache.delete(norm);
    return null;
  }
  return entry.byId;
}

function setMemCacheForEmail(email: string, projects: Project[]): void {
  const norm = email.trim().toLowerCase();
  const byId = new Map<string, Project>();
  for (const p of projects) {
    byId.set(p.id, p);
  }
  userProjectsMemCache.set(norm, { expiresAt: Date.now() + MEM_CACHE_TTL_MS, byId });
}

function upsertMemCacheProject(email: string, project: Project): void {
  const norm = email.trim().toLowerCase();
  const entry = userProjectsMemCache.get(norm);
  if (entry) {
    entry.byId.set(project.id, project);
    entry.expiresAt = Date.now() + MEM_CACHE_TTL_MS;
  }
}

function deleteMemCacheProject(email: string, projectId: string): void {
  const norm = email.trim().toLowerCase();
  const entry = userProjectsMemCache.get(norm);
  if (entry) {
    entry.byId.delete(projectId);
  }
}

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
  const cached = getMemCacheForEmail(email);
  if (cached) {
    return Array.from(cached.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  const store = resolveNetlifyStore();
  const prefix = emailPrefix(email);

  if (store) {
    try {
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
      const sorted = items
        .filter((item): item is Project => Boolean(item && item.id))
        .map((item) => stripProjectPhotos(item, email))
        .sort((a, b) => b.updatedAt - a.updatedAt);
      setMemCacheForEmail(email, sorted);
      return sorted;
    } catch {
      // Fall back to local store if Netlify Blobs is unreachable
    }
  }

  const all = await readLocalStore();
  const sorted = Object.entries(all)
    .filter(([key]) => key.startsWith(prefix))
    .map(([, project]) => stripProjectPhotos(project, email))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  setMemCacheForEmail(email, sorted);
  return sorted;
}

export async function getCloudProject(email: string, projectId: string): Promise<Project | null> {
  const cached = getMemCacheForEmail(email);
  if (cached && cached.has(projectId)) {
    return cached.get(projectId) ?? null;
  }

  const store = resolveNetlifyStore();
  const key = projectKey(email, projectId);

  if (store) {
    try {
      const found = (await store.get(key, { type: "json" })) as Project | null;
      const sanitized = found ? stripProjectPhotos(found, email) : null;
      if (sanitized) upsertMemCacheProject(email, sanitized);
      return sanitized;
    } catch {
      // Fall back to local store
    }
  }

  const all = await readLocalStore();
  const found = all[key];
  const sanitized = found ? stripProjectPhotos(found, email) : null;
  if (sanitized) upsertMemCacheProject(email, sanitized);
  return sanitized;
}

export async function saveCloudProject(email: string, project: Project): Promise<Project> {
  const sanitized = stripProjectPhotos(project, email);
  upsertMemCacheProject(email, sanitized);
  const store = resolveNetlifyStore();
  const key = projectKey(email, sanitized.id);

  // Always keep local fallback updated in dev
  try {
    const all = await readLocalStore();
    all[key] = sanitized;
    await writeLocalStore(all);
  } catch {
    // Ignore local write errors on read-only serverless filesystems
  }

  if (store) {
    try {
      await store.setJSON(key, sanitized);
      return sanitized;
    } catch {
      // Returned via local store fallback
    }
  }

  return sanitized;
}

export async function deleteCloudProject(email: string, projectId: string): Promise<void> {
  deleteMemCacheProject(email, projectId);
  const store = resolveNetlifyStore();
  const key = projectKey(email, projectId);

  try {
    const all = await readLocalStore();
    if (key in all) {
      delete all[key];
      await writeLocalStore(all);
    }
  } catch {
    // Ignore on read-only filesystems
  }

  if (store) {
    try {
      await store.delete(key);
    } catch {
      // Ignore blob delete error
    }
  }
}

export async function listAllCloudProjects(): Promise<Project[]> {
  const store = resolveNetlifyStore();
  const byKey = new Map<string, Project>();

  // Include local store entries first
  try {
    const allLocal = await readLocalStore();
    for (const [key, project] of Object.entries(allLocal)) {
      if (key.startsWith("u/") && project && project.id) {
        byKey.set(key, stripProjectPhotos(project, project.ownerEmail || decodeEmailFromKey(key)));
      }
    }
  } catch {
    // Ignore
  }

  if (store) {
    try {
      const { blobs } = await store.list({ prefix: "u/" });
      const items = await Promise.all(
        blobs.map(async (b) => {
          try {
            const proj = (await store.get(b.key, { type: "json" })) as Project | null;
            if (!proj || !proj.id) return null;
            const fallbackEmail = decodeEmailFromKey(b.key);
            return [b.key, stripProjectPhotos(proj, proj.ownerEmail || fallbackEmail)] as const;
          } catch {
            return null;
          }
        })
      );
      for (const entry of items) {
        if (entry) {
          byKey.set(entry[0], entry[1]);
        }
      }
    } catch {
      // Fall back to local entries already in byKey
    }
  }

  return Array.from(byKey.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}
