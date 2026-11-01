import { preloadEarthTexture } from "./globeShader";

export type BBox = [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]

export type CountryShape = {
  id: string;
  name: string;
  code: string;
  feature: unknown;
  bboxes: BBox[];
};

function computeFeatureBBoxes(featureObj: unknown): BBox[] {
  const geom = (featureObj as { geometry?: { type?: string; coordinates?: unknown } })?.geometry;
  if (!geom || !Array.isArray(geom.coordinates)) return [[-180, -90, 180, 90]];
  const boxes: BBox[] = [];

  const ringBBox = (ring: unknown): BBox | null => {
    if (!Array.isArray(ring) || ring.length === 0) return null;
    let minLon = 180;
    let minLat = 90;
    let maxLon = -180;
    let maxLat = -90;
    for (let i = 0; i < ring.length; i++) {
      const pt = ring[i];
      if (!Array.isArray(pt) || typeof pt[0] !== "number" || typeof pt[1] !== "number") continue;
      const lon = pt[0];
      const lat = pt[1];
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    return minLon <= maxLon ? [minLon, minLat, maxLon, maxLat] : null;
  };

  if (geom.type === "Polygon") {
    const outer = ringBBox((geom.coordinates as unknown[])[0]);
    if (outer) boxes.push(outer);
  } else if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates as unknown[]) {
      if (Array.isArray(poly)) {
        const outer = ringBBox(poly[0]);
        if (outer) boxes.push(outer);
      }
    }
  }
  return boxes.length ? boxes : [[-180, -90, 180, 90]];
}

export function isCountryInBounds(
  country: CountryShape,
  minLon: number,
  minLat: number,
  maxLon: number,
  maxLat: number
): boolean {
  for (let i = 0; i < country.bboxes.length; i++) {
    const [bMinLon, bMinLat, bMaxLon, bMaxLat] = country.bboxes[i];
    if (bMaxLat < minLat || bMinLat > maxLat) continue;
    if (bMaxLon - bMinLon > 180) return true;
    if (!(bMaxLon < minLon || bMinLon > maxLon)) return true;
  }
  return false;
}

let cache: Promise<CountryShape[]> | null = null;
let resolvedCountries: CountryShape[] | null = null;

export function getLoadedCountriesSync(): CountryShape[] | null {
  return resolvedCountries;
}

export function loadCountries() {
  if (resolvedCountries) return Promise.resolve(resolvedCountries);
  if (!cache) {
    // Warm WebGL Earth texture in parallel without blocking country geometry resolution
    void preloadEarthTexture();
    cache = (async () => {
      const [topo, meta] = await Promise.all([
        fetch("/countries-50m.json?v=ind2")
          .then((res) => (res.ok ? res.json() : fetch("/countries-110m.json?v=ind2").then((r) => r.json())))
          .catch(() => fetch("/countries-110m.json?v=ind2").then((r) => r.json())) as Promise<{
          objects: { countries: unknown };
        }>,
        fetch("/country-meta.json").then((res) => res.json() as Promise<Record<string, { name: string; code: string }>>),
      ]);
      const { feature } = await import("topojson-client");
      const collection = feature(topo as never, topo.objects.countries as never) as unknown as {
        features: { id?: string | number; properties?: { name?: string } }[];
      };
      const list = collection.features.map((item) => {
        const id = String(Number(item.id));
        const info = meta[id];
        const propName = item.properties?.name ?? "";
        const fallbackCode = propName === "Kosovo" ? "XK" : "";
        return {
          id,
          name: info?.name || propName,
          code: info?.code || fallbackCode,
          feature: item,
          bboxes: computeFeatureBBoxes(item),
        };
      });
      resolvedCountries = list;
      return list;
    })();
  }
  return cache;
}
