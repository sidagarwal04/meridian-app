const headers = {
  "User-Agent": "Meridian/1.0 (local travel map studio)",
  Accept: "application/json",
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const lat = url.searchParams.get("lat");
  const lon = url.searchParams.get("lon");

  if (lat && lon) {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
      { headers, next: { revalidate: 86400 } }
    );
    if (!res.ok) return Response.json({ name: "Pinned place", country: "", code: "" });
    const data = await res.json();
    const address = data.address ?? {};
    return Response.json({
      name: address.city || address.town || address.village || address.hamlet || data.name || "Pinned place",
      country: address.country || "",
      code: String(address.country_code || "").toUpperCase(),
      lat: Number(lat),
      lon: Number(lon),
    });
  }

  if (!q || q.trim().length < 2) return Response.json([]);
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`,
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
    data.map((item) => ({
      name: item.name || item.display_name?.split(",")[0] || q,
      country: item.address?.country || "",
      code: String(item.address?.country_code || "").toUpperCase(),
      lat: Number(item.lat),
      lon: Number(item.lon),
      label: item.display_name || "",
    }))
  );
}
