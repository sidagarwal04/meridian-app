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
const SNAPSHOT_KEY = "meridian-projects-snapshot";
const INITIAL_SYNC_DONE = "meridian-initial-sync-done";

let memoryProjects: Project[] | null = null;
let memoryEmail: string | null = null;
const projectSubscribers = new Set<(projects: Project[]) => void>();
let activeCloudSync: Promise<Project[]> | null = null;

function notifySubscribers(projects: Project[]) {
  projectSubscribers.forEach((fn) => {
    try {
      fn(projects);
    } catch {
      // ignore subscriber errors
    }
  });
}

export function subscribeProjects(listener: (projects: Project[]) => void): () => void {
  projectSubscribers.add(listener);
  return () => {
    projectSubscribers.delete(listener);
  };
}

function readSnapshot(email: string | null): Project[] | null {
  if (typeof window === "undefined") return null;
  try {
    const key = email ? `${SNAPSHOT_KEY}:${email}` : SNAPSHOT_KEY;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Project[];
    if (!Array.isArray(parsed)) return null;
    return parsed.map(normalizeProject).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return null;
  }
}

function writeSnapshot(email: string | null, projects: Project[]) {
  if (typeof window === "undefined") return;
  try {
    const key = email ? `${SNAPSHOT_KEY}:${email}` : SNAPSHOT_KEY;
    const stripped = projects.map(stripPhotosForCloud);
    localStorage.setItem(key, JSON.stringify(stripped));
  } catch {
    // ignore storage quota errors
  }
}

function updateMemoryCache(email: string | null, projects: Project[]) {
  const sorted = [...projects].map(normalizeProject).sort((a, b) => b.updatedAt - a.updatedAt);
  memoryEmail = email;
  memoryProjects = sorted;
  writeSnapshot(email, sorted);
  notifySubscribers(sorted);
}

function upsertInMemoryCache(project: Project) {
  const email = currentSessionEmail();
  const current = getCachedProjectsSync() ?? [];
  const next = [project, ...current.filter((p) => p.id !== project.id)].sort((a, b) => b.updatedAt - a.updatedAt);
  updateMemoryCache(email, next);
}

function removeFromMemoryCache(id: string) {
  const email = currentSessionEmail();
  const current = getCachedProjectsSync();
  if (!current) return;
  updateMemoryCache(
    email,
    current.filter((p) => p.id !== id)
  );
}

export function getInMemoryProjectsSync(): Project[] | null {
  if (typeof window === "undefined") return null;
  const email = currentSessionEmail();
  if (memoryProjects && memoryEmail === email) {
    return memoryProjects;
  }
  return null;
}

export function getInMemoryProjectSync(id: string): Project | null {
  const list = getInMemoryProjectsSync();
  if (!list) return null;
  return list.find((p) => p.id === id) ?? null;
}

export function getCachedProjectsSync(): Project[] | null {
  if (typeof window === "undefined") return null;
  const email = currentSessionEmail();
  if (memoryProjects && memoryEmail === email) {
    return memoryProjects;
  }
  const snap = readSnapshot(email);
  if (snap) {
    memoryEmail = email;
    memoryProjects = snap;
    return snap;
  }
  return null;
}

export function getCachedProjectSync(id: string): Project | null {
  const list = getCachedProjectsSync();
  if (!list) return null;
  return list.find((p) => p.id === id) ?? null;
}

function isInitialSyncDone(email: string | null): boolean {
  if (typeof window === "undefined" || !email) return false;
  return localStorage.getItem(`${INITIAL_SYNC_DONE}:${email}`) === "1";
}

function markInitialSyncDone(email: string | null) {
  if (typeof window === "undefined" || !email) return;
  try {
    localStorage.setItem(`${INITIAL_SYNC_DONE}:${email}`, "1");
  } catch {
    // ignore
  }
}

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
  memoryProjects = null;
  memoryEmail = null;
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
      if (!found) {
        resolve(null);
        return;
      }
      const email = currentSessionEmail();
      if (email && found.ownerEmail && found.ownerEmail.toLowerCase() !== email) {
        resolve(null);
        return;
      }
      resolve(normalizeProject(found));
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

async function syncProjectsWithCloud(email: string | null, baseLocalRows?: Project[]): Promise<Project[]> {
  if (activeCloudSync) return activeCloudSync;

  activeCloudSync = (async () => {
    const localRows = baseLocalRows ?? (await listLocalProjectsRaw());
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
        markInitialSyncDone(email);
      }

      if (toUpload.length > 0) {
        void fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projects: toUpload }),
        }).catch(() => {});
      }

      const sorted = merged.sort((a, b) => b.updatedAt - a.updatedAt);
      updateMemoryCache(email, sorted);
      return sorted;
    } catch {
      return localRows;
    } finally {
      activeCloudSync = null;
    }
  })();

  return activeCloudSync;
}

export async function listProjects(onUpdate?: (projects: Project[]) => void): Promise<Project[]> {
  const email = currentSessionEmail();
  const localRows = await listLocalProjectsRaw();

  if (localRows.length > 0 || isInitialSyncDone(email)) {
    updateMemoryCache(email, localRows);
    void syncProjectsWithCloud(email, localRows).then((merged) => {
      onUpdate?.(merged);
    });
    return localRows;
  }

  const merged = await syncProjectsWithCloud(email, localRows);
  onUpdate?.(merged);
  return merged;
}

export function preloadProjects(): void {
  if (typeof window === "undefined") return;
  void listProjects();
}

export async function getProject(
  id: string,
  onUpdate?: (project: Project) => void
): Promise<Project | null> {
  const email = currentSessionEmail();
  const localProj = (await getLocalProjectRaw(id)) ?? getCachedProjectSync(id);

  const reconcileWithCloud = async (): Promise<Project | null> => {
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, { cache: "no-store" });
      if (res.ok) {
        const { project: cloudRaw } = (await res.json()) as { project?: Project };
        if (cloudRaw) {
          const cloudProj = normalizeProject(cloudRaw);
          if (localProj && localProj.updatedAt >= cloudProj.updatedAt) {
            if (localProj.updatedAt > cloudProj.updatedAt) {
              void fetch(`/api/projects/${encodeURIComponent(id)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ project: stripPhotosForCloud(localProj) }),
              }).catch(() => {});
            }
            markProjectSynced(email, id);
            return localProj;
          }
          const combined = mergeLocalPhotos(
            email ? { ...cloudProj, ownerEmail: email } : cloudProj,
            localProj
          );
          await putLocalProjectRaw(combined);
          upsertInMemoryCache(combined);
          markProjectSynced(email, id);
          onUpdate?.(combined);
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
  };

  if (localProj) {
    void reconcileWithCloud();
    return localProj;
  }

  return reconcileWithCloud();
}

export async function saveProject(project: Project) {
  const email = currentSessionEmail();
  const next: Project = normalizeProject({
    ...project,
    ownerEmail: email ?? project.ownerEmail,
    updatedAt: Date.now(),
  });

  upsertInMemoryCache(next);
  await putLocalProjectRaw(next);

  // Sync to cloud in background so UI actions & navigation are never blocked
  void fetch(`/api/projects/${encodeURIComponent(next.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project: stripPhotosForCloud(next) }),
  })
    .then((res) => {
      if (res.ok) {
        markProjectSynced(email, next.id);
      }
    })
    .catch(() => {
      // Offline fallback remains in IndexedDB and will sync on next listProjects/getProject
    });
}

export async function deleteProject(id: string) {
  const email = currentSessionEmail();
  removeFromMemoryCache(id);
  await deleteLocalProjectRaw(id);
  unmarkProjectSynced(email, id);

  void fetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: "DELETE",
  }).catch(() => {
    // Ignore network error on delete
  });
}

export async function createAndSave(title?: string) {
  const project = createProject(title);
  await saveProject(project);
  return project;
}
