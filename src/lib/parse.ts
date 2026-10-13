import type { Transport } from "./types";

const WORD: { id: Transport; re: RegExp }[] = [
  { id: "plane", re: /plane|flight|fly|air/i },
  { id: "helicopter", re: /heli/i },
  { id: "train", re: /train|rail/i },
  { id: "boat", re: /boat|ferry|sail|ship|sea/i },
  { id: "car", re: /car|drive|driving|road/i },
  { id: "bus", re: /bus|coach/i },
  { id: "bike", re: /bike|cycl/i },
  { id: "walk", re: /walk|hike|foot/i },
  { id: "motorcycle", re: /motor|moto/i },
  { id: "tuktuk", re: /tuk/i },
  { id: "camper", re: /camper|van|rv/i },
];

function transportFrom(text: string): Transport | undefined {
  for (const item of WORD) if (item.re.test(text)) return item.id;
  return undefined;
}

export function parseItinerary(text: string): { name: string; via?: Transport }[] {
  const raw = text.trim();
  if (!raw) return [];
  const lines = raw
    .split(/\n|→|->|—/)
    .map((line) => line.trim())
    .filter(Boolean);
  const stops: { name: string; via?: Transport }[] = [];
  for (const line of lines) {
    const to = line.match(/^(?:then\s+)?(.+?)\s+to\s+(.+)$/i);
    const by = line.match(/^(.+?)\s+by\s+(.+)$/i);
    const verb = line.match(/^(flight|fly|plane|train|drive|car|bus|boat|ferry|walk|hike|bike|cycle)\s+(?:to\s+)?(.+)$/i);
    if (verb) {
      stops.push({ name: cleanPlace(verb[2]), via: transportFrom(verb[1]) });
      continue;
    }
    if (by && !/^from\b/i.test(line)) {
      const via = transportFrom(by[2]);
      const left = by[1].replace(/^(from|via)\s+/i, "");
      if (/^from\b/i.test(by[1]) || stops.length === 0) {
        const parts = left.split(/\s+to\s+/i);
        if (parts.length === 2) {
          stops.push({ name: cleanPlace(parts[0]) });
          stops.push({ name: cleanPlace(parts[1]), via });
        } else stops.push({ name: cleanPlace(left), via: stops.length ? via : undefined });
      } else stops.push({ name: cleanPlace(left), via });
      continue;
    }
    if (to && transportFrom(to[1])) {
      stops.push({ name: cleanPlace(to[2]), via: transportFrom(to[1]) });
      continue;
    }
    const chunks = line.split(/,/).map((c) => c.trim()).filter(Boolean);
    if (chunks.length > 1) {
      chunks.forEach((chunk, index) => {
        const inner = chunk.match(/^(.+?)\s+by\s+(.+)$/i);
        if (inner) stops.push({ name: cleanPlace(inner[1]), via: transportFrom(inner[2]) });
        else stops.push({ name: cleanPlace(chunk), via: index === 0 && stops.length === 0 ? undefined : stops.length || index ? "plane" : undefined });
      });
      continue;
    }
    stops.push({ name: cleanPlace(line) });
  }
  return stops.filter((s) => s.name.length > 1);
}

function cleanPlace(value: string) {
  return value.replace(/^to\s+/i, "").replace(/[.]/g, "").trim();
}

export function parseGpx(xml: string) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  return [...doc.querySelectorAll("trkpt, rtept, wpt")].map((el) => ({
    lat: Number(el.getAttribute("lat")),
    lon: Number(el.getAttribute("lon")),
    name: el.querySelector("name")?.textContent?.trim() || "",
  })).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
}

export function parseKml(xml: string) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const points: { lat: number; lon: number; name: string }[] = [];
  doc.querySelectorAll("Point coordinates").forEach((el) => {
    const [lon, lat] = (el.textContent || "").trim().split(",").map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lon)) points.push({ lat, lon, name: "" });
  });
  if (points.length >= 2) return points;
  doc.querySelectorAll("coordinates").forEach((el) => {
    (el.textContent || "")
      .trim()
      .split(/\s+/)
      .forEach((pair) => {
        const [lon, lat] = pair.split(",").map(Number);
        if (Number.isFinite(lat) && Number.isFinite(lon)) points.push({ lat, lon, name: "" });
      });
  });
  return points;
}

export function parseGeoJson(text: string) {
  const json = JSON.parse(text) as { type?: string; features?: { geometry?: { type?: string; coordinates?: unknown } }[]; geometry?: { type?: string; coordinates?: unknown }; coordinates?: unknown };
  const points: { lat: number; lon: number; name: string }[] = [];
  const take = (type: string | undefined, coordinates: unknown) => {
    if (!type || !coordinates) return;
    if (type === "Point") {
      const [lon, lat] = coordinates as number[];
      points.push({ lat, lon, name: "" });
    } else if (type === "LineString" || type === "MultiPoint") {
      (coordinates as number[][]).forEach(([lon, lat]) => points.push({ lat, lon, name: "" }));
    } else if (type === "MultiLineString") {
      (coordinates as number[][][]).forEach((line) => line.forEach(([lon, lat]) => points.push({ lat, lon, name: "" })));
    }
  };
  if (json.type === "FeatureCollection") json.features?.forEach((f) => take(f.geometry?.type, f.geometry?.coordinates));
  else if (json.type === "Feature") take(json.geometry?.type, json.geometry?.coordinates);
  else take(json.type, json.coordinates);
  return points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
}

export function simplifyTrack<T>(points: T[], max = 24): T[] {
  if (points.length <= max) return points;
  const out: T[] = [];
  const step = (points.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]);
  return out;
}

export function placesFromGoogleUrl(raw: string): string[] | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!/google\./i.test(url.hostname) && !/goo\.gl|maps\.app/i.test(url.hostname)) return null;
  const dir = url.pathname.split("/dir/")[1];
  if (dir) {
    return dir
      .split("/")
      .map((part) => decodeURIComponent(part).replace(/\+/g, " "))
      .filter((part) => part && !part.startsWith("@") && !part.startsWith("data=") && part !== "am=t");
  }
  const place = url.pathname.split("/place/")[1];
  if (place) return [decodeURIComponent(place.split("/")[0]).replace(/\+/g, " ")];
  const q = url.searchParams.get("q");
  if (q) return [q];
  return null;
}
