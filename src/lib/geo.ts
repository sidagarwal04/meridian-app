import { CITIES, type City } from "./cities";
import type { Transport } from "./types";

export type LatLng = { lat: number; lon: number };

export function haversineKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toVec(lat: number, lon: number) {
  const φ = (lat * Math.PI) / 180;
  const λ = (lon * Math.PI) / 180;
  return [Math.cos(φ) * Math.cos(λ), Math.cos(φ) * Math.sin(λ), Math.sin(φ)];
}

function fromVec(v: number[]): [number, number] {
  const lon = (Math.atan2(v[1], v[0]) * 180) / Math.PI;
  const hyp = Math.sqrt(v[0] * v[0] + v[1] * v[1]);
  const lat = (Math.atan2(v[2], hyp) * 180) / Math.PI;
  return [lon, lat];
}

export function greatCircle(a: LatLng, b: LatLng, steps = 72): [number, number][] {
  const va = toVec(a.lat, a.lon);
  const vb = toVec(b.lat, b.lon);
  const dot = Math.min(1, Math.max(-1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const omega = Math.acos(dot);
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (omega < 1e-6) {
      pts.push([a.lon, a.lat]);
      continue;
    }
    const s1 = Math.sin((1 - t) * omega) / Math.sin(omega);
    const s2 = Math.sin(t * omega) / Math.sin(omega);
    pts.push(fromVec([va[0] * s1 + vb[0] * s2, va[1] * s1 + vb[1] * s2, va[2] * s1 + vb[2] * s2]));
  }
  return pts;
}

const pathMetricsCache = new WeakMap<[number, number][], { lengths: number[]; total: number }>();

function getPathMetrics(coords: [number, number][]): { lengths: number[]; total: number } {
  const cached = pathMetricsCache.get(coords);
  if (cached) return cached;
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const d = haversineKm({ lon: coords[i - 1][0], lat: coords[i - 1][1] }, { lon: coords[i][0], lat: coords[i][1] });
    lengths.push(d);
    total += d;
  }
  const metrics = { lengths, total };
  pathMetricsCache.set(coords, metrics);
  return metrics;
}

export function pathKm(coords: [number, number][]) {
  return getPathMetrics(coords).total;
}

export function pointAlong(coords: [number, number][], u: number): [number, number] {
  if (coords.length === 0) return [0, 0];
  if (coords.length === 1 || u <= 0) return coords[0];
  if (u >= 1) return coords[coords.length - 1];
  const { lengths, total } = getPathMetrics(coords);
  let target = u * total;
  for (let i = 0; i < lengths.length; i++) {
    if (target <= lengths[i] || i === lengths.length - 1) {
      const f = lengths[i] === 0 ? 0 : target / lengths[i];
      const [lon1, lat1] = coords[i];
      let [lon2, lat2] = coords[i + 1];
      while (lon2 - lon1 > 180) lon2 -= 360;
      while (lon1 - lon2 > 180) lon2 += 360;
      let lon = lon1 + (lon2 - lon1) * f;
      if (lon > 180) lon -= 360;
      if (lon < -180) lon += 360;
      return [lon, lat1 + (lat2 - lat1) * f];
    }
    target -= lengths[i];
  }
  return coords[coords.length - 1];
}

export function slicePath(coords: [number, number][], u: number): [number, number][] {
  if (u <= 0) return coords.slice(0, 1);
  if (u >= 1) return coords;
  const head = pointAlong(coords, u);
  const out: [number, number][] = [];
  const { lengths, total } = getPathMetrics(coords);
  let target = u * total;
  out.push(coords[0]);
  for (let i = 0; i < lengths.length; i++) {
    if (target <= lengths[i]) {
      out.push(head);
      return out;
    }
    out.push(coords[i + 1]);
    target -= lengths[i];
  }
  out.push(head);
  return out;
}

const ROAD = new Set<Transport>(["car", "bus", "motorcycle", "tuktuk", "camper", "bike", "walk"]);

export function profileFor(transport: Transport) {
  if (transport === "bike") return "bike";
  if (transport === "walk") return "foot";
  if (ROAD.has(transport)) return "driving";
  return null;
}

const pathCache = new Map<string, [number, number][]>();

export function buildSyncPaths(
  stops: LatLng[],
  transports: Transport[],
  allowRoads: boolean
): { paths: [number, number][][]; hasUnresolvedRoads: boolean } {
  let hasUnresolvedRoads = false;
  const paths = transports.map((transport, i) => {
    const a = stops[i];
    const b = stops[i + 1];
    if (!a || !b) return [] as [number, number][];
    const profile = allowRoads ? profileFor(transport) : null;
    if (!profile) return greatCircle(a, b);
    const key = `${profile}:${a.lon.toFixed(4)},${a.lat.toFixed(4)};${b.lon.toFixed(4)},${b.lat.toFixed(4)}`;
    const hit = pathCache.get(key);
    if (hit) return hit;
    hasUnresolvedRoads = true;
    return greatCircle(a, b);
  });
  return { paths, hasUnresolvedRoads };
}

export async function buildPaths(
  stops: LatLng[],
  transports: Transport[],
  allowRoads: boolean
): Promise<[number, number][][]> {
  const jobs = transports.map(async (transport, i) => {
    const a = stops[i];
    const b = stops[i + 1];
    if (!a || !b) return [] as [number, number][];
    const profile = allowRoads ? profileFor(transport) : null;
    if (!profile) return greatCircle(a, b);
    const key = `${profile}:${a.lon.toFixed(4)},${a.lat.toFixed(4)};${b.lon.toFixed(4)},${b.lat.toFixed(4)}`;
    const hit = pathCache.get(key);
    if (hit) return hit;
    try {
      const res = await fetch(`/api/route?profile=${profile}&a=${a.lon},${a.lat}&b=${b.lon},${b.lat}`);
      if (res.ok) {
        const data = (await res.json()) as { coordinates?: [number, number][] };
        if (data.coordinates && data.coordinates.length > 1) {
          pathCache.set(key, data.coordinates);
          return data.coordinates;
        }
      }
    } catch {
      /* fall through */
    }
    return greatCircle(a, b);
  });
  return Promise.all(jobs);
}

export function nearestCity(lat: number, lon: number, maxKm = 120): City | null {
  let best: City | null = null;
  let bestD = maxKm;
  for (const city of CITIES) {
    const d = haversineKm({ lat, lon }, city);
    if (d < bestD) {
      best = city;
      bestD = d;
    }
  }
  return best;
}

export function flagEmoji(code: string) {
  if (!code || code.length !== 2) return "";
  return code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

export function isSamePlace(
  a: { name?: string; country?: string; lat: number; lon: number },
  b: { name?: string; country?: string; lat: number; lon: number }
): boolean {
  const nameA = a.name?.trim().toLowerCase() || "";
  const nameB = b.name?.trim().toLowerCase() || "";
  if (nameA && nameB && nameA !== "pinned place" && nameA === nameB) {
    const countryA = a.country?.trim().toLowerCase() || "";
    const countryB = b.country?.trim().toLowerCase() || "";
    if (!countryA || !countryB || countryA === countryB) return true;
  }
  return haversineKm(a, b) <= 35;
}

/**
 * Counts destinations visited along a route:
 * - Start location (stops[0]) is the departure origin and is not counted as a visited destination.
 * - Any subsequent stop that returns to the start location (e.g. round-trip end) is also excluded.
 * - All legs' distances are still counted separately in full.
 */
export function countVisitedPlaces(
  stops: { name?: string; country?: string; lat: number; lon: number }[]
): number {
  if (stops.length <= 1) return stops.length;
  const start = stops[0];
  let visited = 0;
  for (let i = 1; i < stops.length; i++) {
    if (!isSamePlace(start, stops[i])) {
      visited++;
    }
  }
  return visited;
}

