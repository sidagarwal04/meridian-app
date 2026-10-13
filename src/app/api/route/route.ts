const ALLOWED = new Set(["driving", "bike", "foot"]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const profile = url.searchParams.get("profile") || "driving";
  const a = url.searchParams.get("a");
  const b = url.searchParams.get("b");
  if (!a || !b || !ALLOWED.has(profile)) return Response.json({ coordinates: [] }, { status: 400 });
  if (!/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(a) || !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(b)) {
    return Response.json({ coordinates: [] }, { status: 400 });
  }
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/${profile}/${a};${b}?overview=full&geometries=geojson`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return Response.json({ coordinates: [] });
    const json = await res.json();
    const coordinates = json.routes?.[0]?.geometry?.coordinates ?? [];
    return Response.json({ coordinates, distance: json.routes?.[0]?.distance ?? 0 });
  } catch {
    return Response.json({ coordinates: [] });
  }
}
