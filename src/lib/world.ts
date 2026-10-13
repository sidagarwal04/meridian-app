import { preloadEarthTexture } from "./globeShader";

export type CountryShape = {
  id: string;
  name: string;
  code: string;
  feature: unknown;
};

let cache: Promise<CountryShape[]> | null = null;

export function loadCountries() {
  if (!cache) {
    cache = (async () => {
      const [topo, meta] = await Promise.all([
        fetch("/countries-50m.json?v=ind2")
          .then((res) => (res.ok ? res.json() : fetch("/countries-110m.json?v=ind2").then((r) => r.json())))
          .catch(() => fetch("/countries-110m.json?v=ind2").then((r) => r.json())) as Promise<{
          objects: { countries: unknown };
        }>,
        fetch("/country-meta.json").then((res) => res.json() as Promise<Record<string, { name: string; code: string }>>),
        preloadEarthTexture(),
      ]);
      const { feature } = await import("topojson-client");
      const collection = feature(topo as never, topo.objects.countries as never) as unknown as {
        features: { id?: string | number; properties?: { name?: string } }[];
      };
      return collection.features.map((item) => {
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
    })();
  }
  return cache;
}
