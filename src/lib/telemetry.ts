import { promises as fs } from "fs";
import path from "path";
import { listAllCloudProjects, resolveNetlifyStore } from "./cloudStore";
import type { ExportFormat, Project } from "./types";

const TELEMETRY_BLOB_KEY = "meta/telemetry-v1";
const LOCAL_TELEMETRY_FILE = path.join(process.cwd(), ".data", "telemetry.json");

export type TrackedUser = {
  email: string;
  name?: string;
  image?: string | null;
  firstSeenAt: number;
  lastSeenAt: number;
  signInCount: number;
};

export type ExportEventRecord = {
  id: string;
  timestamp: number;
  userEmail?: string;
  projectId?: string;
  title?: string;
  format: ExportFormat | string;
  aspect: string;
  resolution: string;
  fps: number;
  stopsCount: number;
};

export type DailyBucket = {
  date: string; // YYYY-MM-DD (UTC)
  pageViews: number;
  uniqueVisitors: number;
  visitorIds: string[];
  signUps: number;
  tripsCreated: number;
  exports: number;
};

export type StoredTelemetry = {
  totalPageViews: number;
  uniqueVisitors: number;
  knownVisitorIds: string[];
  pageViewsByPath: Record<string, number>;
  referrers: Record<string, number>;
  users: Record<string, TrackedUser>;
  lifetimeTripsCreated: number;
  knownTripIds: string[];
  totalExports: number;
  exportsByFormat: Record<string, number>;
  exportsByAspect: Record<string, number>;
  exportsByResolution: Record<string, number>;
  recentExports: ExportEventRecord[];
  daily: Record<string, DailyBucket>;
  updatedAt: number;
};

let memoryCache: { state: StoredTelemetry; fetchedAt: number } | null = null;
const MEMORY_CACHE_TTL_MS = 10_000;

function defaultTelemetry(): StoredTelemetry {
  return {
    totalPageViews: 0,
    uniqueVisitors: 0,
    knownVisitorIds: [],
    pageViewsByPath: {},
    referrers: {},
    users: {},
    lifetimeTripsCreated: 0,
    knownTripIds: [],
    totalExports: 0,
    exportsByFormat: {},
    exportsByAspect: {},
    exportsByResolution: {},
    recentExports: [],
    daily: {},
    updatedAt: Date.now(),
  };
}

function normalizeTelemetry(raw?: Partial<StoredTelemetry> | null): StoredTelemetry {
  const base = defaultTelemetry();
  if (!raw || typeof raw !== "object") return base;
  return {
    totalPageViews: typeof raw.totalPageViews === "number" ? raw.totalPageViews : 0,
    uniqueVisitors: typeof raw.uniqueVisitors === "number" ? raw.uniqueVisitors : 0,
    knownVisitorIds: Array.isArray(raw.knownVisitorIds) ? raw.knownVisitorIds : [],
    pageViewsByPath: raw.pageViewsByPath && typeof raw.pageViewsByPath === "object" ? raw.pageViewsByPath : {},
    referrers: raw.referrers && typeof raw.referrers === "object" ? raw.referrers : {},
    users: raw.users && typeof raw.users === "object" ? raw.users : {},
    lifetimeTripsCreated: typeof raw.lifetimeTripsCreated === "number" ? raw.lifetimeTripsCreated : 0,
    knownTripIds: Array.isArray(raw.knownTripIds) ? raw.knownTripIds : [],
    totalExports: typeof raw.totalExports === "number" ? raw.totalExports : 0,
    exportsByFormat: raw.exportsByFormat && typeof raw.exportsByFormat === "object" ? raw.exportsByFormat : {},
    exportsByAspect: raw.exportsByAspect && typeof raw.exportsByAspect === "object" ? raw.exportsByAspect : {},
    exportsByResolution:
      raw.exportsByResolution && typeof raw.exportsByResolution === "object" ? raw.exportsByResolution : {},
    recentExports: Array.isArray(raw.recentExports) ? raw.recentExports : [],
    daily: raw.daily && typeof raw.daily === "object" ? raw.daily : {},
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
  };
}

async function readLocalTelemetry(): Promise<StoredTelemetry | null> {
  try {
    const raw = await fs.readFile(LOCAL_TELEMETRY_FILE, "utf8");
    return normalizeTelemetry(JSON.parse(raw) as Partial<StoredTelemetry>);
  } catch {
    return null;
  }
}

async function writeLocalTelemetry(state: StoredTelemetry): Promise<void> {
  try {
    await fs.mkdir(path.dirname(LOCAL_TELEMETRY_FILE), { recursive: true });
    await fs.writeFile(LOCAL_TELEMETRY_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch {
    // Ignore on read-only serverless filesystems
  }
}

async function readTelemetry(forceRefresh = false): Promise<StoredTelemetry> {
  if (!forceRefresh && memoryCache && Date.now() - memoryCache.fetchedAt < MEMORY_CACHE_TTL_MS) {
    return memoryCache.state;
  }

  const localState = await readLocalTelemetry();
  const store = resolveNetlifyStore();

  if (store) {
    try {
      const { blobs } = await store.list({ prefix: TELEMETRY_BLOB_KEY });
      if (blobs.length > 0) {
        const cloudRaw = (await store.get(TELEMETRY_BLOB_KEY, { type: "json" })) as Partial<StoredTelemetry> | null;
        if (cloudRaw) {
          const cloudState = normalizeTelemetry(cloudRaw);
          const chosen =
            localState && localState.updatedAt > cloudState.updatedAt ? localState : cloudState;
          memoryCache = { state: chosen, fetchedAt: Date.now() };
          return chosen;
        }
      }
    } catch {
      // Fall back to local telemetry
    }
  }

  const resolved = localState ?? defaultTelemetry();
  memoryCache = { state: resolved, fetchedAt: Date.now() };
  return resolved;
}

async function writeTelemetry(state: StoredTelemetry): Promise<void> {
  state.updatedAt = Date.now();

  // Retain 365 days of daily time-series buckets (lifetime totals are kept forever)
  const dayKeys = Object.keys(state.daily).sort();
  if (dayKeys.length > 365) {
    for (const oldKey of dayKeys.slice(0, dayKeys.length - 365)) {
      delete state.daily[oldKey];
    }
  }

  // Cap deduplication/log arrays so the JSON document remains fast and compact
  if (state.knownVisitorIds.length > 25_000) {
    state.knownVisitorIds = state.knownVisitorIds.slice(-25_000);
  }
  if (state.knownTripIds.length > 25_000) {
    state.knownTripIds = state.knownTripIds.slice(-25_000);
  }
  if (state.recentExports.length > 200) {
    state.recentExports = state.recentExports.slice(0, 200);
  }

  memoryCache = { state, fetchedAt: Date.now() };
  await writeLocalTelemetry(state);

  const store = resolveNetlifyStore();
  if (store) {
    try {
      await store.setJSON(TELEMETRY_BLOB_KEY, state);
    } catch {
      // Local fallback already persisted
    }
  }
}

function dateKeyFromTimestamp(ts = Date.now()): string {
  const safeTs = ts > Date.now() + 86_400_000 * 365 ? Date.now() : ts;
  return new Date(safeTs).toISOString().slice(0, 10);
}

function ensureDailyBucket(state: StoredTelemetry, dateKey: string): DailyBucket {
  if (!state.daily[dateKey]) {
    state.daily[dateKey] = {
      date: dateKey,
      pageViews: 0,
      uniqueVisitors: 0,
      visitorIds: [],
      signUps: 0,
      tripsCreated: 0,
      exports: 0,
    };
  }
  return state.daily[dateKey];
}

function normalizePath(rawPath: string): string {
  if (!rawPath) return "/";
  const clean = rawPath.split("?")[0].split("#")[0].trim() || "/";
  if (clean.startsWith("/studio/")) return "/studio/[id]";
  if (clean.startsWith("/watch/")) return "/watch/[id]";
  if (clean.startsWith("/r/")) return "/r/[code]";
  return clean;
}

function normalizeReferrerHost(referrer?: string): string | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (
      !host ||
      host === "localhost" ||
      host === "meridian.meetsid.dev" ||
      host === "accounts.google.com"
    ) {
      return null;
    }
    return host;
  } catch {
    return null;
  }
}

export async function recordVisit(input: {
  path: string;
  visitorId?: string;
  referrer?: string;
}): Promise<void> {
  const cleanPath = normalizePath(input.path);
  if (cleanPath.startsWith("/admin") || cleanPath.startsWith("/api")) return;

  const state = await readTelemetry();
  const today = dateKeyFromTimestamp();
  const bucket = ensureDailyBucket(state, today);

  state.totalPageViews += 1;
  bucket.pageViews += 1;

  state.pageViewsByPath[cleanPath] = (state.pageViewsByPath[cleanPath] ?? 0) + 1;

  const refHost = normalizeReferrerHost(input.referrer);
  if (refHost) {
    state.referrers[refHost] = (state.referrers[refHost] ?? 0) + 1;
  }

  const vid = input.visitorId?.trim().slice(0, 64);
  if (vid) {
    if (!state.knownVisitorIds.includes(vid)) {
      state.knownVisitorIds.push(vid);
      state.uniqueVisitors += 1;
    }
    if (!bucket.visitorIds.includes(vid)) {
      bucket.visitorIds.push(vid);
      bucket.uniqueVisitors += 1;
    }
  }

  await writeTelemetry(state);
}

export async function recordUserSignIn(input: {
  email: string;
  name?: string | null;
  image?: string | null;
}): Promise<void> {
  const email = input.email?.trim().toLowerCase();
  if (!email) return;

  const state = await readTelemetry();
  const now = Date.now();
  const today = dateKeyFromTimestamp(now);
  const existing = state.users[email];

  if (!existing) {
    state.users[email] = {
      email,
      name: input.name || email.split("@")[0],
      image: input.image ?? null,
      firstSeenAt: now,
      lastSeenAt: now,
      signInCount: 1,
    };
    const bucket = ensureDailyBucket(state, today);
    bucket.signUps += 1;
  } else {
    state.users[email] = {
      ...existing,
      name: input.name || existing.name,
      image: input.image ?? existing.image,
      lastSeenAt: now,
      signInCount: (existing.signInCount || 1) + 1,
    };
  }

  await writeTelemetry(state);
}

export async function recordTripSaved(email: string, project: Project): Promise<void> {
  if (!project?.id) return;
  const cleanEmail = email?.trim().toLowerCase();
  const state = await readTelemetry();
  const now = Date.now();

  if (cleanEmail) {
    if (!state.users[cleanEmail]) {
      state.users[cleanEmail] = {
        email: cleanEmail,
        name: cleanEmail.split("@")[0],
        image: null,
        firstSeenAt: project.createdAt || now,
        lastSeenAt: now,
        signInCount: 1,
      };
      const signupDay = dateKeyFromTimestamp(project.createdAt || now);
      ensureDailyBucket(state, signupDay).signUps += 1;
    } else {
      state.users[cleanEmail].lastSeenAt = Math.max(state.users[cleanEmail].lastSeenAt, now);
    }
  }

  if (!state.knownTripIds.includes(project.id)) {
    state.knownTripIds.push(project.id);
    state.lifetimeTripsCreated += 1;
    const createdDay = dateKeyFromTimestamp(project.createdAt || now);
    ensureDailyBucket(state, createdDay).tripsCreated += 1;
  }

  await writeTelemetry(state);
}

export async function recordExportEvent(input: {
  userEmail?: string | null;
  projectId?: string;
  title?: string;
  format?: string;
  aspect?: string;
  resolution?: string;
  fps?: number;
  stopsCount?: number;
}): Promise<void> {
  const state = await readTelemetry();
  const now = Date.now();
  const today = dateKeyFromTimestamp(now);
  const bucket = ensureDailyBucket(state, today);

  const format = (input.format || "mp4").toLowerCase();
  const aspect = input.aspect || "16:9";
  const resolution = String(input.resolution || "768");
  const fps = Number(input.fps) || 30;
  const stopsCount = Number(input.stopsCount) || 0;

  state.totalExports += 1;
  bucket.exports += 1;

  state.exportsByFormat[format] = (state.exportsByFormat[format] ?? 0) + 1;
  state.exportsByAspect[aspect] = (state.exportsByAspect[aspect] ?? 0) + 1;
  state.exportsByResolution[resolution] = (state.exportsByResolution[resolution] ?? 0) + 1;

  state.recentExports.unshift({
    id: `exp_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: now,
    userEmail: input.userEmail ? input.userEmail.trim().toLowerCase() : undefined,
    projectId: input.projectId,
    title: input.title || "Untitled trip",
    format,
    aspect,
    resolution,
    fps,
    stopsCount,
  });

  await writeTelemetry(state);
}

export type AdminDashboardStats = {
  generatedAt: number;
  overview: {
    uniqueVisitors: number;
    totalPageViews: number;
    totalSignUps: number;
    lifetimeTripsCreated: number;
    activeCloudTrips: number;
    totalExports: number;
    totalStopsPlotted: number;
  };
  pageViewsByPath: { path: string; count: number }[];
  topReferrers: { host: string; count: number }[];
  users: {
    email: string;
    name: string;
    firstSeenAt: number;
    lastSeenAt: number;
    signInCount: number;
    activeTripsCount: number;
    totalStopsCount: number;
  }[];
  trips: {
    byTheme: Record<string, number>;
    byAspect: Record<string, number>;
    byTransport: Record<string, number>;
    recent: {
      id: string;
      title: string;
      ownerEmail: string;
      stopsCount: number;
      stopNames: string[];
      theme: string;
      aspect: string;
      transports: string[];
      createdAt: number;
      updatedAt: number;
    }[];
  };
  exports: {
    byFormat: Record<string, number>;
    byAspect: Record<string, number>;
    byResolution: Record<string, number>;
    recent: ExportEventRecord[];
  };
  dailySeries: {
    date: string;
    pageViews: number;
    uniqueVisitors: number;
    signUps: number;
    tripsCreated: number;
    exports: number;
  }[];
};

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const [state, cloudProjects] = await Promise.all([readTelemetry(true), listAllCloudProjects()]);

  let dirty = false;

  const tripsByUser = new Map<string, Project[]>();
  const byTheme: Record<string, number> = {};
  const byAspect: Record<string, number> = {};
  const byTransport: Record<string, number> = {};
  let totalStopsPlotted = 0;

  for (const proj of cloudProjects) {
    const owner = (proj.ownerEmail || "unknown").trim().toLowerCase();
    const list = tripsByUser.get(owner) ?? [];
    list.push(proj);
    tripsByUser.set(owner, list);

    if (owner && owner !== "unknown" && !state.users[owner]) {
      state.users[owner] = {
        email: owner,
        name: owner.split("@")[0],
        image: null,
        firstSeenAt: proj.createdAt || proj.updatedAt || Date.now(),
        lastSeenAt: proj.updatedAt || Date.now(),
        signInCount: 1,
      };
      const dayKey = dateKeyFromTimestamp(proj.createdAt || proj.updatedAt || Date.now());
      ensureDailyBucket(state, dayKey).signUps += 1;
      dirty = true;
    }

    if (proj.id && !state.knownTripIds.includes(proj.id)) {
      state.knownTripIds.push(proj.id);
      state.lifetimeTripsCreated += 1;
      const dayKey = dateKeyFromTimestamp(proj.createdAt || proj.updatedAt || Date.now());
      ensureDailyBucket(state, dayKey).tripsCreated += 1;
      dirty = true;
    }

    const theme = proj.style?.theme || "earth";
    byTheme[theme] = (byTheme[theme] ?? 0) + 1;

    const aspect = proj.style?.aspect || "16:9";
    byAspect[aspect] = (byAspect[aspect] ?? 0) + 1;

    const stopsCount = proj.stops?.length ?? 0;
    totalStopsPlotted += stopsCount;

    for (const leg of proj.legs ?? []) {
      const tr = leg.transport || "plane";
      byTransport[tr] = (byTransport[tr] ?? 0) + 1;
    }
  }

  if (state.lifetimeTripsCreated < cloudProjects.length) {
    state.lifetimeTripsCreated = cloudProjects.length;
    dirty = true;
  }

  if (dirty) {
    void writeTelemetry(state).catch(() => {});
  }

  const usersList = Object.values(state.users)
    .map((u) => {
      const userProjects = tripsByUser.get(u.email) ?? [];
      const userStops = userProjects.reduce((sum, p) => sum + (p.stops?.length ?? 0), 0);
      const latestProjectUpdate = userProjects.reduce((max, p) => Math.max(max, p.updatedAt || 0), 0);
      return {
        email: u.email,
        name: u.name || u.email.split("@")[0],
        firstSeenAt: u.firstSeenAt,
        lastSeenAt: Math.max(u.lastSeenAt, latestProjectUpdate),
        signInCount: u.signInCount || 1,
        activeTripsCount: userProjects.length,
        totalStopsCount: userStops,
      };
    })
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt);

  const pageViewsByPath = Object.entries(state.pageViewsByPath)
    .map(([p, count]) => ({ path: p, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const topReferrers = Object.entries(state.referrers)
    .map(([host, count]) => ({ host, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // Build up to 90 days series for charts & time-range filters
  const dailySeries: AdminDashboardStats["dailySeries"] = [];
  const now = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const key = d.toISOString().slice(0, 10);
    const bucket = state.daily[key];
    dailySeries.push({
      date: key,
      pageViews: bucket?.pageViews ?? 0,
      uniqueVisitors: bucket?.uniqueVisitors ?? 0,
      signUps: bucket?.signUps ?? 0,
      tripsCreated: bucket?.tripsCreated ?? 0,
      exports: bucket?.exports ?? 0,
    });
  }

  const recentTrips = cloudProjects.slice(0, 100).map((p) => ({
    id: p.id,
    title: p.title || "Untitled trip",
    ownerEmail: p.ownerEmail || "unknown",
    stopsCount: p.stops?.length ?? 0,
    stopNames: (p.stops ?? []).map((s) => s.name).filter(Boolean),
    theme: p.style?.theme || "earth",
    aspect: p.style?.aspect || "16:9",
    transports: Array.from(new Set((p.legs ?? []).map((l) => l.transport || "plane"))),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));

  return {
    generatedAt: Date.now(),
    overview: {
      uniqueVisitors: state.uniqueVisitors,
      totalPageViews: state.totalPageViews,
      totalSignUps: usersList.length,
      lifetimeTripsCreated: state.lifetimeTripsCreated,
      activeCloudTrips: cloudProjects.length,
      totalExports: state.totalExports,
      totalStopsPlotted,
    },
    pageViewsByPath,
    topReferrers,
    users: usersList,
    trips: {
      byTheme,
      byAspect,
      byTransport,
      recent: recentTrips,
    },
    exports: {
      byFormat: state.exportsByFormat,
      byAspect: state.exportsByAspect,
      byResolution: state.exportsByResolution,
      recent: state.recentExports.slice(0, 100),
    },
    dailySeries,
  };
}
