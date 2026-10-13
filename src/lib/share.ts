import { defaultStyle, makeStop, uid, type Project, type Style, type Transport } from "./types";

type Packed = {
  t: string;
  s: [string, string, string, number, number, string][];
  l: Transport[];
  y: Style;
};

export function encodeRoute(project: Project) {
  const data: Packed = {
    t: project.title,
    s: project.stops.map((stop) => [stop.name, stop.country, stop.code, +stop.lat.toFixed(4), +stop.lon.toFixed(4), stop.emoji]),
    l: project.legs.map((leg) => leg.transport),
    y: { ...project.style, music: "none" },
  };
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeRoute(code: string): Project | null {
  try {
    const padded = code.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((code.length + 3) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes)) as Packed;
    if (!data.s?.length) return null;
    const stops = data.s.map(([name, country, codeName, lat, lon, emoji]) =>
      makeStop({ name, country, code: codeName, lat, lon, emoji })
    );
    return {
      id: uid("shared"),
      title: data.t || "Shared route",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      stops,
      legs: stops.slice(1).map((_, index) => ({ transport: data.l?.[index] || "plane" })),
      style: { ...defaultStyle(), ...data.y, music: "none" },
    };
  } catch {
    return null;
  }
}
