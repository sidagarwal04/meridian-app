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
        fetch("/countries-110m.json").then((res) => res.json() as Promise<{ objects: { countries: unknown } }>),
        fetch("/country-meta.json").then((res) => res.json() as Promise<Record<string, { name: string; code: string }>>),
      ]);
      const { feature } = await import("topojson-client");
      const collection = feature(topo as never, topo.objects.countries as never) as unknown as {
        features: { id?: string | number }[];
      };
      return collection.features.map((item) => {
        const id = String(Number(item.id));
        const info = meta[id];
        return {
          id,
          name: info?.name ?? "",
          code: info?.code ?? "",
          feature: item,
        };
      });
    })();
  }
  return cache;
}
