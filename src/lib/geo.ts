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

const englishRegionDisplay =
  typeof Intl !== "undefined" && typeof Intl.DisplayNames !== "undefined"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

const LOCAL_COUNTRY_FALLBACKS: Record<string, string> = {
  danmark: "Denmark",
  sverige: "Sweden",
  norge: "Norway",
  suomi: "Finland",
  deutschland: "Germany",
  österreich: "Austria",
  schweiz: "Switzerland",
  suisse: "Switzerland",
  svizzera: "Switzerland",
  italia: "Italy",
  españa: "Spain",
  portugal: "Portugal",
  nederland: "Netherlands",
  belgië: "Belgium",
  belgique: "Belgium",
  polska: "Poland",
  česko: "Czechia",
  "česká republika": "Czechia",
  magyarország: "Hungary",
  hrvatska: "Croatia",
  slovenija: "Slovenia",
  slovensko: "Slovakia",
  românia: "Romania",
  türkiye: "Turkey",
  ελλάδα: "Greece",
  hellas: "Greece",
  ísland: "Iceland",
  éire: "Ireland",
  lietuva: "Lithuania",
  latvija: "Latvia",
  eesti: "Estonia",
};

/**
 * Returns the international English country name for a stop given its ISO alpha-2 code
 * or fallback country string (converting local names like "Danmark" -> "Denmark", "Sverige" -> "Sweden").
 */
export function internationalCountryName(code?: string, rawCountry?: string): string {
  const cleanCode = (code || "").trim().toUpperCase();
  if (cleanCode.length === 2 && englishRegionDisplay) {
    try {
      const resolved = englishRegionDisplay.of(cleanCode);
      if (resolved && resolved !== cleanCode) return resolved;
    } catch {
      /* fall through */
    }
  }
  const trimmed = (rawCountry || "").trim();
  if (!trimmed) return "";
  const mapped = LOCAL_COUNTRY_FALLBACKS[trimmed.toLowerCase()];
  return mapped || trimmed;
}

export function isSamePlace(
  a: { name?: string; country?: string; code?: string; lat: number; lon: number },
  b: { name?: string; country?: string; code?: string; lat: number; lon: number }
): boolean {
  const nameA = a.name?.trim().toLowerCase() || "";
  const nameB = b.name?.trim().toLowerCase() || "";
  if (nameA && nameB && nameA !== "pinned place" && nameA === nameB) {
    const countryA = internationalCountryName(a.code, a.country).toLowerCase();
    const countryB = internationalCountryName(b.code, b.country).toLowerCase();
    if (!countryA || !countryB || countryA === countryB) return true;
  }
  return haversineKm(a, b) <= 15;
}

/**
 * Counts unique cities/places visited along a route:
 * - Start location (stops[0]) is the departure home city and is not counted as a visited destination
 *   (nor when returning to it on a round trip).
 * - Returning via the same city/place is not counted double.
 */
export function countUniqueCities(
  stops: { name?: string; country?: string; code?: string; lat: number; lon: number }[]
): number {
  if (stops.length === 0) return 0;
  if (stops.length === 1) return 1;
  const origin = stops[0];
  const unique: { name?: string; country?: string; code?: string; lat: number; lon: number }[] = [];
  for (let i = 1; i < stops.length; i++) {
    const stop = stops[i];
    if (isSamePlace(origin, stop)) continue;
    if (!unique.some((existing) => isSamePlace(existing, stop))) {
      unique.push(stop);
    }
  }
  return unique.length > 0 ? unique.length : 1;
}

/**
 * Counts unique destination countries visited along a route:
 * - The home country (stops[0]'s country) is excluded if the starting city is the only place
 *   visited in that country (including returning to the starting city at the end).
 * - If you also visit other cities within your home country during the trip, or if the entire trip
 *   is domestic within 1 country, the country is included.
 * - Returning via the same country is not counted double.
 */
export function countUniqueCountries(
  stops: { name?: string; country?: string; code?: string; lat: number; lon: number }[]
): number {
  if (stops.length === 0) return 0;
  const countryKey = (stop: { country?: string; code?: string }) => {
    const code = (stop.code || "").trim().toUpperCase();
    const country = internationalCountryName(code, stop.country).toLowerCase();
    return code || country;
  };

  if (stops.length === 1) return 1;

  const origin = stops[0];
  const destinationCountries = new Set<string>();
  for (let i = 1; i < stops.length; i++) {
    const stop = stops[i];
    if (isSamePlace(origin, stop)) continue;
    const key = countryKey(stop);
    if (key) {
      destinationCountries.add(key);
    }
  }

  if (destinationCountries.size > 0) {
    return destinationCountries.size;
  }

  const originKey = countryKey(origin);
  return originKey ? 1 : 1;
}

/**
 * Formats the route summary string:
 * "# of Countries | # of cities | total distance travelled"
 * e.g. "5 Countries | 10 Cities | 10,000 kms travelled"
 */
export function formatRouteStatsSummary(
  stops: { name?: string; country?: string; code?: string; lat: number; lon: number }[],
  distanceKm: number,
  units: "km" | "mi" | "none" = "km"
): string {
  const countries = countUniqueCountries(stops);
  const cities = countUniqueCities(stops);
  const countryPart = `${countries} ${countries === 1 ? "Country" : "Countries"}`;
  const cityPart = `${cities} ${cities === 1 ? "City" : "Cities"}`;
  if (units === "none") {
    return `${countryPart} | ${cityPart}`;
  }
  const distVal = units === "mi" ? Math.round(distanceKm * 0.621371) : Math.round(distanceKm);
  const unitLabel = units === "mi" ? (distVal === 1 ? "mile" : "miles") : distVal === 1 ? "km" : "kms";
  return `${countryPart} | ${cityPart} | ${distVal.toLocaleString()} ${unitLabel} travelled`;
}

export function countVisitedPlaces(
  stops: { name?: string; country?: string; code?: string; lat: number; lon: number }[]
): number {
  return countUniqueCities(stops);
}

