import { THEMES, createProject, defaultStyle, type Account, type Project, type ThemeId, type User } from "./types";

function normalizeProject(project: Project): Project {
  const mergedStyle = { ...defaultStyle(), ...(project?.style ?? {}) };
  const rawTheme = mergedStyle.theme as string | undefined;
  const validTheme: ThemeId = rawTheme && rawTheme in THEMES ? (rawTheme as ThemeId) : "earth";
  return {
    ...project,
    style: {
      ...mergedStyle,
      theme: validTheme,
    },
  };
}

/**
 * Strips stop photos before sending to cloud API so photos never leave the user's device.
 */
function stripPhotosForCloud(project: Project): Project {
  return {
    ...project,
    stops: (project.stops ?? []).map((stop) => ({
      ...stop,
      photos: [],
    })),
  };
}

/**
 * Re-attaches any locally stored stop photos on this device onto a cloud-synced project.
 */
function mergeLocalPhotos(base: Project, local: Project | null | undefined): Project {
  if (!local?.stops?.length) return normalizeProject(base);
  const byId = new Map(local.stops.map((s) => [s.id, s.photos ?? []]));
  const byCoord = new Map(
    local.stops.map((s) => [`${s.name}:${s.lat.toFixed(3)}:${s.lon.toFixed(3)}`, s.photos ?? []])
  );

  return normalizeProject({
    ...base,
    stops: (base.stops ?? []).map((stop) => {
      if (stop.photos && stop.photos.length > 0) return stop;
      const localPhotos =
        byId.get(stop.id) ??
        byCoord.get(`${stop.name}:${stop.lat.toFixed(3)}:${stop.lon.toFixed(3)}`) ??
        [];
      return { ...stop, photos: localPhotos };
    }),
  });
}

const SESSION = "meridian-session";
const ACCOUNTS = "meridian-accounts";
const LANG = "meridian-lang";
const SYNCED_IDS = "meridian-synced-ids";

type Recorded = { user: User; account: Account };

function readAccounts(): Record<string, Recorded> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS) || "{}") as Record<string, Recorded>;
  } catch {
    return {};
  }
}

function writeAccounts(all: Record<string, Recorded>) {
  localStorage.setItem(ACCOUNTS, JSON.stringify(all));
}

function currentSessionEmail(): string | null {
  if (typeof window === "undefined") return null;
  const email = localStorage.getItem(SESSION);
  return email ? email.trim().toLowerCase() : null;
}

function readSyncedIds(email: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = JSON.parse(localStorage.getItem(`${SYNCED_IDS}:${email}`) || "[]") as string[];
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

function writeSyncedIds(email: string, ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${SYNCED_IDS}:${email}`, JSON.stringify(Array.from(ids)));
  } catch {
    // ignore storage quota errors
  }
}

function markProjectSynced(email: string | null, id: string) {
  if (!email) return;
  const ids = readSyncedIds(email);
  ids.add(id);
  writeSyncedIds(email, ids);
}

function unmarkProjectSynced(email: string | null, id: string) {
  if (!email) return;
  const ids = readSyncedIds(email);
  ids.delete(id);
  writeSyncedIds(email, ids);
}

export function defaultAccount(): Account {
  return { plan: "free", credits: 5, proUntil: null, purchases: [] };
}

export function accountFor(email: string): Account | null {
  return readAccounts()[email]?.account ?? null;
}

export function loadSession(): { user: User; account: Account } | null {
  if (typeof window === "undefined") return null;
  const email = localStorage.getItem(SESSION);
  if (!email) return null;
  const found = readAccounts()[email];
  return found ?? null;
}

export function persistSession(user: User, account: Account) {
  const all = readAccounts();
  all[user.email] = { user, account };
  writeAccounts(all);
  localStorage.setItem(SESSION, user.email);
}

export function clearSession() {
  localStorage.removeItem(SESSION);
}

export function loadLang() {
  if (typeof window === "undefined") return "en";
  return localStorage.getItem(LANG) || "en";
}

export function saveLang(lang: string) {
  localStorage.setItem(LANG, lang);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("meridian", 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("projects")) {
        req.result.createObjectStore("projects", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function listLocalProjectsRaw(): Promise<Project[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("projects", "readonly");
    const req = tx.objectStore("projects").getAll();
    req.onsuccess = () => {
      const email = currentSessionEmail();
      const rows = (req.result as Project[])
        .filter((p) => !email || !p.ownerEmail || p.ownerEmail.toLowerCase() === email)
        .map(normalizeProject)
        .sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

async function getLocalProjectRaw(id: string): Promise<Project | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction("projects", "readonly").objectStore("projects").get(id);
    req.onsuccess = () => {
      const found = req.result as Project | undefined;
      resolve(found ? normalizeProject(found) : null);
    };
    req.onerror = () => reject(req.error);
  });
}

async function putLocalProjectRaw(project: Project): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const req = db.transaction("projects", "readwrite").objectStore("projects").put(project);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function deleteLocalProjectRaw(id: string): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const req = db.transaction("projects", "readwrite").objectStore("projects").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function listProjects(): Promise<Project[]> {
  const email = currentSessionEmail();
  const localRows = await listLocalProjectsRaw();
  const localMap = new Map(localRows.map((p) => [p.id, p]));

  try {
    const res = await fetch("/api/projects", { cache: "no-store" });
    if (!res.ok) {
      return localRows;
    }
    const { projects: cloudRows = [] } = (await res.json()) as { projects?: Project[] };
    const cloudMap = new Map(cloudRows.map((p) => [p.id, normalizeProject(p)]));
    const syncedIds = email ? readSyncedIds(email) : new Set<string>();

    const merged: Project[] = [];
    const toUpload: Project[] = [];

    for (const cloudProj of cloudMap.values()) {
      const localProj = localMap.get(cloudProj.id);
      if (!localProj) {
        const withOwner = email ? { ...cloudProj, ownerEmail: email } : cloudProj;
        await putLocalProjectRaw(withOwner);
        syncedIds.add(cloudProj.id);
        merged.push(withOwner);
      } else if (localProj.updatedAt > cloudProj.updatedAt) {
        const withOwner = email ? { ...localProj, ownerEmail: email } : localProj;
        merged.push(withOwner);
        toUpload.push(stripPhotosForCloud(withOwner));
        syncedIds.add(localProj.id);
      } else {
        const combined = mergeLocalPhotos(
          email ? { ...cloudProj, ownerEmail: email } : cloudProj,
          localProj
        );
        await putLocalProjectRaw(combined);
        syncedIds.add(cloudProj.id);
        merged.push(combined);
      }
    }

    for (const localProj of localRows) {
      if (cloudMap.has(localProj.id)) continue;
      if (syncedIds.has(localProj.id)) {
        // Project was previously synced to cloud and later deleted on another device
        await deleteLocalProjectRaw(localProj.id);
        syncedIds.delete(localProj.id);
      } else {
        // Legacy or offline-created local project -> push to cloud
        const withOwner = email ? { ...localProj, ownerEmail: email } : localProj;
        await putLocalProjectRaw(withOwner);
        merged.push(withOwner);
        toUpload.push(stripPhotosForCloud(withOwner));
        syncedIds.add(localProj.id);
      }
    }

    if (email) {
      writeSyncedIds(email, syncedIds);
    }

    if (toUpload.length > 0) {
      void fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projects: toUpload }),
      }).catch(() => {});
    }

    return merged.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return localRows;
  }
}

export async function getProject(id: string): Promise<Project | null> {
  const email = currentSessionEmail();
  const localProj = await getLocalProjectRaw(id);

  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (res.ok) {
      const { project: cloudRaw } = (await res.json()) as { project?: Project };
      if (cloudRaw) {
        const cloudProj = normalizeProject(cloudRaw);
        if (localProj && localProj.updatedAt > cloudProj.updatedAt) {
          void fetch(`/api/projects/${encodeURIComponent(id)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ project: stripPhotosForCloud(localProj) }),
          }).catch(() => {});
          markProjectSynced(email, id);
          return localProj;
        }
        const combined = mergeLocalPhotos(
          email ? { ...cloudProj, ownerEmail: email } : cloudProj,
          localProj
        );
        await putLocalProjectRaw(combined);
        markProjectSynced(email, id);
        return combined;
      }
    } else if (res.status === 404 && localProj) {
      // Exists locally but not yet in cloud -> push to cloud so other devices get it
      void fetch(`/api/projects/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: stripPhotosForCloud(localProj) }),
      })
        .then((r) => {
          if (r.ok) markProjectSynced(email, id);
        })
        .catch(() => {});
    }
  } catch {
    // Offline or network error -> fall back to local IndexedDB
  }

  return localProj;
}

export async function saveProject(project: Project) {
  const email = currentSessionEmail();
  const next: Project = normalizeProject({
    ...project,
    ownerEmail: email ?? project.ownerEmail,
    updatedAt: Date.now(),
  });

  await putLocalProjectRaw(next);

  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(next.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: stripPhotosForCloud(next) }),
    });
    if (res.ok) {
      markProjectSynced(email, next.id);
    }
  } catch {
    // Offline fallback remains in IndexedDB and will sync on next listProjects/getProject
  }
}

export async function deleteProject(id: string) {
  const email = currentSessionEmail();
  await deleteLocalProjectRaw(id);
  unmarkProjectSynced(email, id);

  try {
    await fetch(`/api/projects/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  } catch {
    // Ignore network error on delete
  }
}

export async function createAndSave(title?: string) {
  const project = createProject(title);
  await saveProject(project);
  return project;
}
