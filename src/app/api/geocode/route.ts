const headers = {
  "User-Agent": "Meridian/1.0 (local travel map studio)",
  Accept: "application/json",
  "Accept-Language": "en",
};

const regionNames =
  typeof Intl !== "undefined" && typeof Intl.DisplayNames !== "undefined"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

function resolveEnglishCountry(code: string, fallback: string): string {
  const upper = (code || "").trim().toUpperCase();
  if (upper && upper.length === 2 && regionNames) {
    try {
      const name = regionNames.of(upper);
      if (name && name !== upper) return name;
    } catch {
      /* ignore */
    }
  }
  return fallback || "";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");

  if (lat && lon) {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=en&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
      { headers, next: { revalidate: 86400 } }
    );
    if (!res.ok) return Response.json({ name: "Pinned place", country: "", code: "" });
    const data = await res.json();
    const address = data.address ?? {};
    const code = String(address.country_code || "").toUpperCase();
    return Response.json({
      name: address.city || address.town || address.village || address.hamlet || data.name || "Pinned place",
      country: resolveEnglishCountry(code, address.country || ""),
      code,
      lat: Number(lat),
      lon: Number(lon),
    });
  }

  if (!q || q.trim().length < 2) return Response.json([]);
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&accept-language=en&limit=5&q=${encodeURIComponent(q)}`,
    { headers, next: { revalidate: 86400 } }
  );
  if (!res.ok) return Response.json([]);
  const data = (await res.json()) as {
    name?: string;
    display_name?: string;
    lat: string;
    lon: string;
    address?: { country?: string; country_code?: string };
  }[];
  return Response.json(
    data.map((item) => {
      const code = String(item.address?.country_code || "").toUpperCase();
      return {
        name: item.name || item.display_name?.split(",")[0] || q,
        country: resolveEnglishCountry(code, item.address?.country || ""),
        code,
        lat: Number(item.lat),
        lon: Number(item.lon),
        label: item.display_name || "",
      };
    })
  );
}
