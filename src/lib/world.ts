import { preloadEarthTexture } from "./globeShader";

export type CountryShape = {
  id: string;
  name: string;
  code: string;
  feature: unknown;
};

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
        };
      });
      resolvedCountries = list;
      return list;
    })();
  }
  return cache;
}
