import { geoGraticule, geoOrthographic, geoPath, type GeoProjection } from "d3-geo";
import { flagEmoji, pathKm, pointAlong, slicePath } from "./geo";
import { THEMES, transportMeta, type Project, type Style, type ThemeId, type Transport } from "./types";
import type { CountryShape } from "./world";

export type Frame = {
  camera: { lon: number; lat: number; factor: number };
  revealed: [number, number][][];
  full: [number, number][][];
  head: [number, number] | null;
  headBearing: number;
  transport: Transport | null;
  icon: string | null;
  dashed: boolean;
  labelIndexes: number[];
  activeStopIndex: number;
  legProgress: number | null;
  legIndex: number | null;
  legDistances: (number | null)[];
  photoStop: number | null;
  photoU: number;
  distanceKm: number | null;
  showUnderlay: number;
};

type Seg = { type: "intro" | "dwell" | "leg" | "outro"; index: number; dur: number; start: number };

function smooth(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function quinticInOut(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2;
}

function zoomFor(km: number) {
  if (km > 7000) return 0.52;
  if (km > 3500) return 0.72;
  if (km > 1500) return 0.98;
  if (km > 500) return 1.32;
  return 1.68;
}

function fitFactor(stops: Project["stops"]) {
  if (stops.length <= 1) return 1.25;
  let lat = 0;
  let lon = 0;
  stops.forEach((s) => {
    lat += s.lat;
    lon += s.lon;
  });
  const c = { lat: lat / stops.length, lon: lon / stops.length };
  let maxKm = 400;
  stops.forEach((s) => {
    const km = pathKm([
      [c.lon, c.lat],
      [s.lon, s.lat],
    ]);
    maxKm = Math.max(maxKm, km);
  });
  return Math.max(0.45, Math.min(1.5, zoomFor(maxKm * 2.05)));
}

function centroid(stops: Project["stops"]) {
  if (!stops.length) return { lon: 10, lat: 20 };
  let x = 0;
  let y = 0;
  let z = 0;
  stops.forEach((s) => {
    const φ = (s.lat * Math.PI) / 180;
    const λ = (s.lon * Math.PI) / 180;
    x += Math.cos(φ) * Math.cos(λ);
    y += Math.cos(φ) * Math.sin(λ);
    z += Math.sin(φ);
  });
  const lon = (Math.atan2(y, x) * 180) / Math.PI;
  const hyp = Math.sqrt(x * x + y * y);
  const lat = (Math.atan2(z, hyp) * 180) / Math.PI;
  return { lon, lat };
}

function lerpAngle(a: number, b: number, t: number) {
  let delta = b - a;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  let value = a + delta * t;
  if (value > 180) value -= 360;
  if (value < -180) value += 360;
  return value;
}

function buildSegs(project: Project, paths: [number, number][][]) {
  const speed = project.style.speed || 1;
  const segs: Seg[] = [];
  let cursor = 0;
  const push = (type: Seg["type"], index: number, dur: number) => {
    segs.push({ type, index, dur, start: cursor });
    cursor += dur;
  };
  if (!project.stops.length) {
    push("intro", 0, 8);
    return { segs, total: cursor };
  }
  push("intro", 0, (project.style.startZoom ? 1.35 : 0.25) / speed);
  push("dwell", 0, dwellOf(project, 0) / speed);
  project.legs.forEach((_, index) => {
    const km = pathKm(paths[index] ?? []);
    const dur = Math.min(4.6, Math.max(1.55, (km || 500) / 1100)) / speed;
    push("leg", index, dur);
    push("dwell", index + 1, dwellOf(project, index + 1) / speed);
  });
  push("outro", project.stops.length - 1, (project.style.endZoom || project.style.showFullRouteAtEnd ? 1.75 : 0.4) / speed);
  return { segs, total: cursor };
}

function dwellOf(project: Project, index: number) {
  const stop = project.stops[index];
  if (!stop) return 0.65;
  const photos = stop.photos.length;
  return Math.max(stop.dwellSec || 1, photos ? 0.9 + photos * 0.7 : 0.85);
}

export function animationDuration(project: Project, paths: [number, number][][]) {
  return buildSegs(project, paths).total;
}

export function frameAt(project: Project, paths: [number, number][][], time: number): Frame {
  const { segs, total } = buildSegs(project, paths);
  const t = Math.max(0, Math.min(time, Math.max(total - 0.001, 0)));
  const seg = segs.find((item) => t < item.start + item.dur) ?? segs[segs.length - 1];
  const rawU = seg.dur === 0 ? 1 : (t - seg.start) / seg.dur;
  const stops = project.stops;
  const fit = { ...centroid(stops), factor: fitFactor(stops) };
  const full = paths.filter((path) => path.length > 1);

  const empty: Frame = {
    camera: { lon: ((time * 14) % 360) - 180, lat: 18, factor: 0.46 },
    revealed: [],
    full: [],
    head: null,
    headBearing: 0,
    transport: null,
    icon: null,
    dashed: false,
    labelIndexes: [],
    activeStopIndex: 0,
    legProgress: null,
    legIndex: null,
    legDistances: stops.map(() => null),
    photoStop: null,
    photoU: 0,
    distanceKm: null,
    showUnderlay: 0.14,
  };
  if (!stops.length || !seg) return empty;

  const legKms = project.legs.map((_, idx) => pathKm(paths[idx] ?? []));

  const close = (index: number, km = 700) => ({
    lon: stops[index].lon,
    lat: stops[index].lat,
    factor: Math.max(zoomFor(km), 0.72),
  });

  if (seg.type === "intro") {
    const km = legKms[0] || 900;
    const dest = close(0, km);
    const e = quinticInOut(rawU);
    const startFactor = Math.min(0.45, fit.factor * 0.82);
    return {
      ...empty,
      camera: {
        lon: lerpAngle(stops[0].lon - 22, dest.lon, e),
        lat: stops[0].lat * 0.45 + dest.lat * 0.55 * e + stops[0].lat * 0.45 * (1 - e),
        factor: startFactor + (dest.factor - startFactor) * e,
      },
      full,
      labelIndexes: project.style.labels === "always" ? stops.map((_, i) => i) : [0],
      activeStopIndex: 0,
      showUnderlay: 0.1 * e,
      head: [stops[0].lon, stops[0].lat],
    };
  }

  if (seg.type === "outro") {
    const lastLegKm = legKms[legKms.length - 1] || 800;
    const from = close(seg.index, lastLegKm);
    const to = project.style.showFullRouteAtEnd || project.style.endZoom ? fit : from;
    const e = quinticInOut(rawU);
    const dists = stops.map((_, i) => (i === 0 ? null : legKms[i - 1] || null));
    return {
      ...empty,
      camera: {
        lon: lerpAngle(from.lon, to.lon, e),
        lat: from.lat + (to.lat - from.lat) * e,
        factor: from.factor + (to.factor - from.factor) * e,
      },
      revealed: full,
      full,
      labelIndexes: indexesFor(project.style, stops.length, stops.length - 1, "outro"),
      activeStopIndex: seg.index,
      legDistances: project.style.units === "none" ? stops.map(() => null) : dists,
      head: [stops[seg.index].lon, stops[seg.index].lat],
      showUnderlay: 0.16,
    };
  }

  if (seg.type === "dwell") {
    const prevKm = seg.index > 0 ? legKms[seg.index - 1] : legKms[0];
    const nextKm = seg.index < legKms.length ? legKms[seg.index] : prevKm;
    const baseCam = close(seg.index, Math.min(prevKm || 800, nextKm || 800));
    // Subtle cinematic push-in during dwell
    const dwellBoost = 1 + 0.05 * Math.sin(rawU * Math.PI);
    const dists = stops.map((_, i) => (i > 0 && i <= seg.index ? legKms[i - 1] || null : null));
    return {
      ...empty,
      camera: { ...baseCam, factor: baseCam.factor * dwellBoost },
      revealed: full.slice(0, seg.index),
      full,
      head: [stops[seg.index].lon, stops[seg.index].lat],
      labelIndexes: indexesFor(project.style, stops.length, seg.index, "dwell"),
      activeStopIndex: seg.index,
      legDistances: project.style.units === "none" ? stops.map(() => null) : dists,
      photoStop: stops[seg.index].photos.length ? seg.index : null,
      photoU: rawU,
      showUnderlay: 0.15,
    };
  }

  // Leg flight / travel phase with cinematic ease-in-out
  const path: [number, number][] = paths[seg.index] ?? [];
  const km = legKms[seg.index] || pathKm(path);
  const u = smooth(rawU);
  const head: [number, number] = path.length ? pointAlong(path, u) : [stops[seg.index].lon, stops[seg.index].lat];
  const aheadPt: [number, number] = path.length
    ? pointAlong(path, Math.min(1, u + 0.025))
    : [stops[Math.min(stops.length - 1, seg.index + 1)].lon, stops[Math.min(stops.length - 1, seg.index + 1)].lat];
  const behindPt: [number, number] = path.length ? pointAlong(path, Math.max(0, u - 0.025)) : head;

  const dLon = lerpAngle(behindPt[0], aheadPt[0], 1) - behindPt[0];
  const dLat = aheadPt[1] - behindPt[1];
  const headBearing = Math.atan2(dLon * Math.cos((head[1] * Math.PI) / 180), dLat);

  // Camera zoom arcs out slightly at mid-flight and zooms in as approaching destination
  const startFactor = close(seg.index, km || 800).factor;
  const endFactor = close(seg.index + 1, km || 800).factor;
  const midDip = Math.sin(u * Math.PI) * Math.min(0.28, (km || 600) / 12000);
  const camFactor = Math.max(0.44, startFactor + (endFactor - startFactor) * u - midDip);

  const transport = project.legs[seg.index]?.transport ?? "plane";
  const meta = transportMeta(transport);
  const curDist = km * u;
  const dists = stops.map((_, i) => {
    if (i === 0) return null;
    if (i < seg.index + 1) return legKms[i - 1] || null;
    if (i === seg.index + 1) return curDist;
    return null;
  });

  return {
    camera: { lon: head[0], lat: head[1], factor: camFactor },
    revealed: [...full.slice(0, seg.index), slicePath(path, u)],
    full,
    head,
    headBearing,
    transport,
    icon: meta.kind === "draw" && transport !== "dot" ? null : meta.icon,
    dashed: transport === "dot",
    labelIndexes: indexesFor(project.style, stops.length, seg.index + 1, "leg"),
    activeStopIndex: u > 0.55 ? seg.index + 1 : seg.index,
    legProgress: u,
    legIndex: seg.index,
    legDistances: project.style.units === "none" ? stops.map(() => null) : dists,
    photoStop: null,
    photoU: 0,
    distanceKm: project.style.units === "none" ? null : curDist,
    showUnderlay: 0.14,
  };
}

function indexesFor(style: Style, count: number, active: number, phase: string) {
  if (style.labels === "always") return Array.from({ length: count }, (_, i) => i);
  if (style.labels === "current") return [Math.max(0, Math.min(count - 1, active))];
  const max = phase === "outro" ? count - 1 : active;
  return Array.from({ length: count }, (_, i) => i).filter((i) => i <= max);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawStars(ctx: CanvasRenderingContext2D, w: number, h: number, time = 0) {
  let s = 42;
  for (let i = 0; i < 85; i++) {
    s = (s * 16807) % 2147483647;
    const x = (s % 1000) / 1000;
    s = (s * 16807) % 2147483647;
    const y = (s % 1000) / 1000;
    const twinkle = 0.18 + 0.22 * Math.sin(time * 1.4 + i * 1.7);
    const radius = i % 11 === 0 ? 1.25 : i % 3 === 0 ? 0.9 : 0.6;
    ctx.beginPath();
    ctx.arc(x * w, y * h, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${twinkle})`;
    ctx.fill();
  }
}

// Biome & topographic relief patches (lon, lat, angularRadiusDeg, innerColor, outerColor)
const BIOME_PATCHES: [number, number, number, string, string][] = [
  // Sahara & Arabian Desert (warm arid ochre/sand)
  [12, 23, 24, "rgba(194, 154, 102, 0.78)", "rgba(194, 154, 102, 0)"],
  [28, 24, 18, "rgba(189, 148, 96, 0.72)", "rgba(189, 148, 96, 0)"],
  [46, 23, 16, "rgba(186, 144, 92, 0.75)", "rgba(186, 144, 92, 0)"],
  // Central Asia & Gobi arid steppes
  [64, 41, 18, "rgba(168, 138, 94, 0.58)", "rgba(168, 138, 94, 0)"],
  [98, 42, 20, "rgba(172, 142, 98, 0.62)", "rgba(172, 142, 98, 0)"],
  // Himalayas & Tibetan Plateau (high-altitude snow & alpine rock)
  [84, 31, 13, "rgba(226, 232, 240, 0.62)", "rgba(148, 163, 184, 0)"],
  [76, 35, 9, "rgba(241, 245, 249, 0.58)", "rgba(241, 245, 249, 0)"],
  // Tropical India, SE Asia & Indonesia (lush deep emerald)
  [78, 17, 14, "rgba(34, 84, 42, 0.65)", "rgba(34, 84, 42, 0)"],
  [102, 14, 18, "rgba(28, 78, 38, 0.72)", "rgba(28, 78, 38, 0)"],
  [114, 0, 18, "rgba(25, 75, 36, 0.72)", "rgba(25, 75, 36, 0)"],
  // European forests & plains (temperate rich green)
  [10, 50, 18, "rgba(42, 88, 44, 0.68)", "rgba(42, 88, 44, 0)"],
  [26, 54, 18, "rgba(38, 82, 40, 0.65)", "rgba(38, 82, 40, 0)"],
  // Alps & Scandinavian mountains
  [10, 46.5, 5.5, "rgba(226, 232, 240, 0.46)", "rgba(226, 232, 240, 0)"],
  [14, 64, 11, "rgba(203, 213, 225, 0.42)", "rgba(203, 213, 225, 0)"],
  // Congo & Equatorial Africa rainforest
  [22, 0, 18, "rgba(26, 74, 34, 0.74)", "rgba(26, 74, 34, 0)"],
  // Kalahari / Namib
  [20, -24, 14, "rgba(178, 136, 86, 0.58)", "rgba(178, 136, 86, 0)"],
  // Australian Outback
  [134, -25, 18, "rgba(184, 122, 74, 0.74)", "rgba(184, 122, 74, 0)"],
  // Amazon Basin
  [-62, -6, 22, "rgba(24, 76, 35, 0.78)", "rgba(24, 76, 35, 0)"],
  // Andes & Rockies
  [-70, -22, 14, "rgba(180, 164, 142, 0.52)", "rgba(180, 164, 142, 0)"],
  [-112, 38, 16, "rgba(176, 142, 98, 0.58)", "rgba(176, 142, 98, 0)"],
  // Eastern North America forests
  [-82, 38, 18, "rgba(38, 86, 42, 0.66)", "rgba(38, 86, 42, 0)"],
  // Greenland & Arctic ice
  [-42, 72, 16, "rgba(241, 245, 249, 0.82)", "rgba(241, 245, 249, 0)"],
];

export function drawSatelliteBiomeShading(
  ctx: CanvasRenderingContext2D,
  projection: GeoProjection,
  globeRadius: number,
  theme: ThemeId
) {
  if (theme === "paper" || theme === "night") return;
  const intensity = theme === "satellite" || theme === "earth" ? 1 : 0.55;
  ctx.save();
  ctx.globalAlpha = intensity;
  for (const [lon, lat, degRadius, innerColor, outerColor] of BIOME_PATCHES) {
    const center = projection([lon, lat]);
    if (!center) continue;
    const r = Math.max(18, (degRadius * Math.PI / 180) * globeRadius);
    const grad = ctx.createRadialGradient(center[0], center[1], r * 0.08, center[0], center[1], r);
    grad.addColorStop(0, innerColor);
    grad.addColorStop(1, outerColor);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(center[0], center[1], r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function draw3DAirplane(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  bearingRad: number,
  size: number,
  accentColor: string
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(bearingRad);

  // Soft ground/cloud drop shadow offset beneath the aircraft
  ctx.save();
  ctx.translate(size * 0.14, size * 0.22);
  drawJetSilhouette(ctx, size * 0.95);
  ctx.fillStyle = "rgba(0, 0, 0, 0.48)";
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = size * 0.35;
  ctx.fill();
  ctx.restore();

  // Subtle blue contrail / thruster glow behind tail
  const trailGrad = ctx.createLinearGradient(0, size * 0.35, 0, size * 1.45);
  trailGrad.addColorStop(0, accentColor);
  trailGrad.addColorStop(1, "rgba(56, 189, 248, 0)");
  ctx.strokeStyle = trailGrad;
  ctx.lineWidth = Math.max(2, size * 0.12);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, size * 0.42);
  ctx.lineTo(0, size * 1.25);
  ctx.stroke();

  // Main 3D White Commercial Jet Wing & Tail Body
  drawJetSilhouette(ctx, size);
  const wingGrad = ctx.createLinearGradient(-size * 0.85, 0, size * 0.85, 0);
  wingGrad.addColorStop(0, "#dbeafe");
  wingGrad.addColorStop(0.48, "#ffffff");
  wingGrad.addColorStop(0.52, "#f8fafc");
  wingGrad.addColorStop(1, "#cbd5e1");
  ctx.fillStyle = wingGrad;
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = size * 0.25;
  ctx.fill();
  ctx.lineWidth = Math.max(0.8, size * 0.03);
  ctx.strokeStyle = "rgba(148, 163, 184, 0.55)";
  ctx.stroke();

  // Central cylindrical fuselage highlight for 3D depth
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.88);
  ctx.bezierCurveTo(size * 0.13, -size * 0.62, size * 0.13, size * 0.32, 0, size * 0.78);
  ctx.bezierCurveTo(-size * 0.13, size * 0.32, -size * 0.13, -size * 0.62, 0, -size * 0.88);
  ctx.closePath();
  const fuseGrad = ctx.createLinearGradient(-size * 0.13, 0, size * 0.13, 0);
  fuseGrad.addColorStop(0, "#f1f5f9");
  fuseGrad.addColorStop(0.4, "#ffffff");
  fuseGrad.addColorStop(1, "#cbd5e1");
  ctx.fillStyle = fuseGrad;
  ctx.fill();

  // Cockpit windshield visor
  ctx.beginPath();
  ctx.arc(0, -size * 0.64, size * 0.065, Math.PI * 1.1, Math.PI * 1.9);
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = Math.max(1.2, size * 0.045);
  ctx.stroke();

  ctx.restore();
}

function drawJetSilhouette(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath();
  // Nose cone (pointing -Y = North when bearing = 0)
  ctx.moveTo(0, -s * 0.9);
  // Forward right fuselage
  ctx.quadraticCurveTo(s * 0.12, -s * 0.72, s * 0.12, -s * 0.28);
  // Swept right main wing leading edge
  ctx.lineTo(s * 0.88, s * 0.08);
  // Right winglet tip
  ctx.lineTo(s * 0.88, s * 0.2);
  // Right wing trailing edge
  ctx.lineTo(s * 0.11, s * 0.06);
  // Rear right fuselage
  ctx.lineTo(s * 0.08, s * 0.5);
  // Swept right horizontal stabilizer (tailplane)
  ctx.lineTo(s * 0.36, s * 0.7);
  ctx.lineTo(s * 0.36, s * 0.78);
  ctx.lineTo(s * 0.05, s * 0.68);
  // Tail cone
  ctx.lineTo(0, s * 0.82);
  // Left horizontal stabilizer
  ctx.lineTo(-s * 0.05, s * 0.68);
  ctx.lineTo(-s * 0.36, s * 0.78);
  ctx.lineTo(-s * 0.36, s * 0.7);
  // Rear left fuselage
  ctx.lineTo(-s * 0.08, s * 0.5);
  // Left wing trailing edge
  ctx.lineTo(-s * 0.11, s * 0.06);
  // Left winglet tip
  ctx.lineTo(-s * 0.88, s * 0.2);
  // Left wing leading edge
  ctx.lineTo(-s * 0.88, s * 0.08);
  // Forward left fuselage
  ctx.lineTo(-s * 0.12, -s * 0.28);
  ctx.quadraticCurveTo(-s * 0.12, -s * 0.72, 0, -s * 0.9);
  ctx.closePath();
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  countries: CountryShape[],
  project: Project,
  paths: [number, number][][],
  images: Record<string, HTMLImageElement[]>,
  time: number
) {
  const { w, h } = { w: ctx.canvas.width, h: ctx.canvas.height };
  const palette = THEMES[project.style.theme] ?? THEMES.earth;
  const frame = frameAt(project, paths, time);
  const bg = project.style.background || palette.bg;
  const line = project.style.lineColor || palette.line;
  const label = project.style.labelColor || palette.labelColor;
  const isSatelliteLook = project.style.theme === "earth" || project.style.theme === "satellite";

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  if (palette.stars) drawStars(ctx, w, h, time);

  const cx = w / 2;
  const cy = h / 2 + h * 0.02;
  const globeRadius = frame.camera.factor * Math.min(w, h);

  const projection = geoOrthographic()
    .precision(0.35)
    .rotate([-frame.camera.lon, -frame.camera.lat])
    .translate([cx, cy])
    .scale(globeRadius);
  const path = geoPath(projection, ctx);

  // Crisp atmospheric horizon halo around the 3D sphere
  if (palette.stars) {
    const corona = ctx.createRadialGradient(cx, cy, globeRadius * 0.94, cx, cy, globeRadius * 1.14);
    corona.addColorStop(0, "rgba(96, 165, 250, 0.26)");
    corona.addColorStop(0.45, "rgba(37, 99, 235, 0.09)");
    corona.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = corona;
    ctx.beginPath();
    ctx.arc(cx, cy, globeRadius * 1.14, 0, Math.PI * 2);
    ctx.fill();
  }

  // 1. Deep Bathymetric Ocean Sphere
  ctx.beginPath();
  path({ type: "Sphere" } as never);
  ctx.fillStyle = palette.ocean;
  ctx.fill();

  if (palette.stars) {
    ctx.save();
    ctx.beginPath();
    path({ type: "Sphere" } as never);
    ctx.clip();
    const oceanLight = ctx.createRadialGradient(
      cx - globeRadius * 0.28,
      cy - globeRadius * 0.28,
      globeRadius * 0.04,
      cx,
      cy,
      globeRadius * 1.04
    );
    oceanLight.addColorStop(0, isSatelliteLook ? "rgba(30, 88, 158, 0.55)" : "rgba(56, 189, 248, 0.22)");
    oceanLight.addColorStop(0.55, isSatelliteLook ? "rgba(12, 42, 84, 0.25)" : "rgba(14, 165, 233, 0.05)");
    oceanLight.addColorStop(1, "rgba(2, 6, 18, 0.65)");
    ctx.fillStyle = oceanLight;
    ctx.fillRect(cx - globeRadius - 4, cy - globeRadius - 4, globeRadius * 2 + 8, globeRadius * 2 + 8);
    ctx.restore();
  }

  // 2. Shallow Coastal Shelf Bathymetry Glow around landmasses
  if (isSatelliteLook) {
    ctx.save();
    ctx.beginPath();
    path({ type: "Sphere" } as never);
    ctx.clip();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    countries.forEach((country) => {
      ctx.beginPath();
      path(country.feature as never);
      ctx.strokeStyle = "rgba(56, 189, 248, 0.14)";
      ctx.lineWidth = Math.max(4, globeRadius * 0.018);
      ctx.stroke();
    });
    ctx.restore();
  }

  const visited = new Set(
    project.stops
      .filter((_, index) => frame.labelIndexes.includes(index))
      .map((stop) => stop.code)
      .filter(Boolean)
  );
  const activeCountryCode = project.stops[frame.activeStopIndex]?.code || "";
  if (!project.style.highlightCountries) visited.clear();

  // 3. Landmasses Base Fill + Multi-Biome Satellite Terrain Shading
  ctx.save();
  ctx.beginPath();
  countries.forEach((country) => {
    path(country.feature as never);
  });
  ctx.fillStyle = palette.land;
  ctx.fill();

  // Clip to all land polygons and paint realistic satellite biomes (forests, deserts, snow peaks)
  ctx.clip();
  drawSatelliteBiomeShading(ctx, projection, globeRadius, project.style.theme);

  // Directional spherical sunlight & relief shadow over landmasses
  if (palette.stars) {
    const landLight = ctx.createRadialGradient(
      cx - globeRadius * 0.35,
      cy - globeRadius * 0.35,
      globeRadius * 0.08,
      cx + globeRadius * 0.15,
      cy + globeRadius * 0.15,
      globeRadius * 1.1
    );
    landLight.addColorStop(0, "rgba(255, 255, 255, 0.12)");
    landLight.addColorStop(0.6, "rgba(0, 0, 0, 0)");
    landLight.addColorStop(1, "rgba(2, 6, 23, 0.48)");
    ctx.fillStyle = landLight;
    ctx.fillRect(cx - globeRadius - 4, cy - globeRadius - 4, globeRadius * 2 + 8, globeRadius * 2 + 8);
  }
  ctx.restore();

  // 4. Country Borders + Visited / Active Country Crisp White Border & Subtle Tint (mult.dev style)
  const highlightedCountries: CountryShape[] = [];
  countries.forEach((country) => {
    const hot = Boolean(country.code && visited.has(country.code));
    if (hot) {
      highlightedCountries.push(country);
    }
    ctx.beginPath();
    path(country.feature as never);
    ctx.lineWidth = Math.max(0.55, w / 1350);
    ctx.strokeStyle = palette.border;
    ctx.stroke();
  });

  // Draw highlighted (visited/active) countries on top with translucent tint & crisp white outline
  highlightedCountries.forEach((country) => {
    const isCurrent = country.code === activeCountryCode;
    ctx.save();
    ctx.beginPath();
    path(country.feature as never);
    ctx.fillStyle = isSatelliteLook
      ? isCurrent
        ? "rgba(56, 189, 248, 0.16)"
        : "rgba(56, 189, 248, 0.09)"
      : palette.landHi;
    ctx.fill();

    ctx.shadowColor = "rgba(255, 255, 255, 0.65)";
    ctx.shadowBlur = isCurrent ? 6 : 3;
    ctx.lineWidth = Math.max(1.25, w / 620);
    ctx.strokeStyle = isCurrent ? "rgba(255, 255, 255, 0.96)" : "rgba(255, 255, 255, 0.78)";
    ctx.stroke();
    ctx.restore();
  });

  // Subtle graticule grid
  ctx.beginPath();
  path(geoGraticule()());
  ctx.strokeStyle = palette.stars ? "rgba(255,255,255,0.035)" : "rgba(30,40,50,0.06)";
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // 5. 3D Spherical Limb Shadow & Atmospheric Rim Glow
  if (palette.stars) {
    ctx.save();
    ctx.beginPath();
    path({ type: "Sphere" } as never);
    ctx.clip();
    const rim = ctx.createRadialGradient(cx, cy, globeRadius * 0.76, cx, cy, globeRadius);
    rim.addColorStop(0, "rgba(0, 0, 0, 0)");
    rim.addColorStop(0.78, "rgba(2, 6, 20, 0.22)");
    rim.addColorStop(0.95, "rgba(15, 23, 42, 0.48)");
    rim.addColorStop(1, "rgba(147, 197, 253, 0.42)");
    ctx.fillStyle = rim;
    ctx.fillRect(cx - globeRadius - 2, cy - globeRadius - 2, globeRadius * 2 + 4, globeRadius * 2 + 4);
    ctx.restore();
  }

  ctx.beginPath();
  path({ type: "Sphere" } as never);
  ctx.strokeStyle = palette.stars ? "rgba(147, 197, 253, 0.42)" : "rgba(40,50,60,0.28)";
  ctx.lineWidth = Math.max(1.2, w / 680);
  ctx.stroke();

  // 6. Vibrant Electric Blue Route Path with Outer Glow
  const strokeRoute = (lines: [number, number][][], alpha: number, width: number, dash: boolean, glow: boolean) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.setLineDash(dash ? [2, Math.max(8, width * 2.6)] : []);

    if (glow && !dash) {
      ctx.save();
      ctx.strokeStyle = line;
      ctx.lineWidth = width * 2.2;
      ctx.globalAlpha = alpha * 0.26;
      ctx.shadowColor = line;
      ctx.shadowBlur = Math.max(10, w / 95);
      lines.forEach((coords) => {
        if (coords.length < 2) return;
        ctx.beginPath();
        path({ type: "LineString", coordinates: coords });
        ctx.stroke();
      });
      ctx.restore();
    }

    ctx.lineWidth = width;
    ctx.strokeStyle = line;
    ctx.shadowColor = line;
    ctx.shadowBlur = dash ? 0 : Math.max(4, w / 190);
    lines.forEach((coords) => {
      if (coords.length < 2) return;
      ctx.beginPath();
      path({ type: "LineString", coordinates: coords });
      ctx.stroke();
    });
    ctx.restore();
  };

  strokeRoute(frame.full, frame.showUnderlay, Math.max(1.5, w / 520), false, false);
  strokeRoute(frame.revealed, 1, Math.max(3.4, w / 220), frame.dashed, true);

  // 7. Stop Waypoint Nodes + Concentric Target Rings on Active Stop
  const reachedMaxIndex = frame.legIndex != null ? frame.legIndex + 1 : frame.activeStopIndex;
  project.stops.forEach((stop, idx) => {
    const xy = projection([stop.lon, stop.lat]);
    if (!xy) return;
    const isReached = idx <= reachedMaxIndex || project.style.labels === "always";
    if (!isReached && frame.showUnderlay <= 0.05) return;

    const isActive = idx === frame.activeStopIndex;
    const r = Math.max(4.5, w / 195);

    if (isActive) {
      // Concentric target ring (mult.dev style)
      const ringRadius = r * (3.1 + 0.25 * Math.sin(time * 3.2));
      ctx.save();
      ctx.beginPath();
      ctx.arc(xy[0], xy[1], ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.52)";
      ctx.lineWidth = Math.max(1.1, w / 680);
      ctx.stroke();
      ctx.restore();
    }

    // Soft cyan/blue ambient glow around waypoint dot
    ctx.save();
    ctx.beginPath();
    ctx.arc(xy[0], xy[1], r * 1.9, 0, Math.PI * 2);
    ctx.fillStyle = isReached ? "rgba(56, 189, 248, 0.28)" : "rgba(255, 255, 255, 0.12)";
    ctx.fill();
    ctx.restore();

    // Solid vibrant blue circular waypoint dot
    ctx.save();
    ctx.beginPath();
    ctx.arc(xy[0], xy[1], isActive ? r * 1.15 : r, 0, Math.PI * 2);
    ctx.fillStyle = isReached ? line : "rgba(255, 255, 255, 0.85)";
    ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.lineWidth = Math.max(1.3, w / 640);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctx.stroke();
    ctx.restore();
  });

  // 8. Moving 3D Airplane / Vehicle Model along the active trajectory
  if (frame.head && frame.icon && frame.legIndex != null) {
    const xy = projection(frame.head);
    if (xy) {
      // Compute screen-space tangent angle so the 3D airplane points accurately along the projected curve
      const pathCoords = paths[frame.legIndex] ?? [];
      const u = frame.legProgress ?? 0.5;
      const p1 = projection(pointAlong(pathCoords, Math.max(0, u - 0.02)));
      const p2 = projection(pointAlong(pathCoords, Math.min(1, u + 0.02)));
      const screenAngle =
        p1 && p2 && Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) > 0.5
          ? Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) + Math.PI / 2
          : frame.headBearing;

      if (frame.transport === "plane") {
        draw3DAirplane(ctx, xy[0], xy[1], screenAngle, Math.max(18, w / 34), line);
      } else {
        // Clean badge with transport icon for land/sea vehicles
        const badgeR = Math.max(13, w / 52);
        ctx.save();
        ctx.beginPath();
        ctx.arc(xy[0], xy[1], badgeR, 0, Math.PI * 2);
        ctx.fillStyle = line;
        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
        ctx.font = `${Math.round(badgeR * 1.15)}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(frame.icon, xy[0], xy[1] + 1);
        ctx.restore();
      }
    }
  }

  // 9. Floating Glassmorphic City & Country Callout Cards + "+XXXX km" Distance Counter
  const taken: { x: number; y: number; w: number; h: number }[] = [];
  frame.labelIndexes.forEach((index) => {
    const stop = project.stops[index];
    const xy = projection([stop.lon, stop.lat]);
    if (!xy) return;

    const isActive = index === frame.activeStopIndex;
    const flag = project.style.showCountryFlags && stop.code ? flagEmoji(stop.code) : "";
    const primary = `${stop.emoji ? `${stop.emoji} ` : ""}${stop.name}`;
    const secondary = [flag, stop.country].filter(Boolean).join("  ");

    const titleFont = Math.round(Math.max(14, w / 46) * (isActive ? 1.06 : 0.94));
    const subFont = Math.round(titleFont * 0.72);

    ctx.font = `700 ${titleFont}px Inter, system-ui, sans-serif`;
    const primaryW = ctx.measureText(primary).width;
    ctx.font = `500 ${subFont}px Inter, system-ui, sans-serif`;
    const secondaryW = secondary ? ctx.measureText(secondary).width : 0;

    const padX = Math.max(14, w / 58);
    const padY = Math.max(9, w / 92);
    const cardW = Math.max(primaryW, secondaryW) + padX * 2;
    const cardH = secondary ? titleFont + subFont + padY * 2.1 : titleFont + padY * 1.8;

    const pinOffset = Math.max(14, w / 56);
    const cardX = xy[0] - cardW / 2;
    const cardY = xy[1] - cardH - pinOffset;

    const rect = { x: cardX - 4, y: cardY - 4, w: cardW + 8, h: cardH + 24 };
    if (project.style.optimizeLabels && !isActive && taken.some((box) => intersects(box, rect))) return;
    taken.push(rect);

    // Translucent dark charcoal glassmorphic pill card (mult.dev style)
    ctx.save();
    ctx.fillStyle = palette.stars ? "rgba(18, 22, 30, 0.76)" : "rgba(255, 255, 255, 0.92)";
    ctx.shadowColor = "rgba(0, 0, 0, 0.52)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 4;
    roundRect(ctx, cardX, cardY, cardW, cardH, Math.max(9, w / 80));
    ctx.fill();
    ctx.strokeStyle = palette.stars
      ? isActive
        ? "rgba(255, 255, 255, 0.24)"
        : "rgba(255, 255, 255, 0.12)"
      : "rgba(15, 23, 42, 0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // City name (bold white sans-serif)
    ctx.save();
    ctx.fillStyle = label;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${titleFont}px Inter, system-ui, sans-serif`;
    const titleY = secondary ? cardY + padY + titleFont * 0.48 : cardY + cardH / 2;
    ctx.fillText(primary, xy[0], titleY);

    // Flag + Country subtitle
    if (secondary) {
      ctx.font = `500 ${subFont}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = palette.stars ? "rgba(241, 245, 249, 0.9)" : "rgba(30, 41, 59, 0.85)";
      const subY = cardY + cardH - padY - subFont * 0.42;
      ctx.fillText(secondary, xy[0], subY);
    }
    ctx.restore();

    // "+XXXX km" Distance Counter below the waypoint marker (mult.dev style)
    const stopDistKm = frame.legDistances[index];
    if (stopDistKm != null && stopDistKm >= 1) {
      const val = project.style.units === "mi" ? Math.round(stopDistKm * 0.621371) : Math.round(stopDistKm);
      const unitLabel = project.style.units === "mi" ? "mi" : "km";
      const distText = `+${val} ${unitLabel}`;
      const distFont = Math.round(Math.max(12, w / 56));
      ctx.save();
      ctx.font = `700 ${distFont}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
      ctx.shadowBlur = 8;
      ctx.fillStyle = isActive ? "rgba(255, 255, 255, 0.96)" : "rgba(226, 232, 240, 0.78)";
      ctx.fillText(distText, xy[0], xy[1] + Math.max(13, w / 54));
      ctx.restore();
    }
  });

  // 10. Stop Photo Polaroid Overlay during pause
  if (frame.photoStop != null) {
    const stop = project.stops[frame.photoStop];
    const imgs = images[stop.id] ?? [];
    const img = imgs[Math.min(imgs.length - 1, Math.floor(frame.photoU * Math.max(imgs.length, 1)))];
    const xy = projection([stop.lon, stop.lat]);
    if (img && xy) {
      const pw = Math.min(w * 0.28, 360);
      const ph = pw * 0.72;
      const x = Math.min(w - pw - 24, Math.max(24, xy[0] + 22));
      const y = Math.min(h - ph - 80, Math.max(70, xy[1] - ph / 2));
      ctx.save();
      ctx.fillStyle = "rgba(10, 14, 24, 0.72)";
      ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
      ctx.shadowBlur = 18;
      roundRect(ctx, x - 8, y - 8, pw + 16, ph + 16, 16);
      ctx.fill();
      ctx.beginPath();
      roundRect(ctx, x, y, pw, ph, 12);
      ctx.clip();
      ctx.drawImage(img, x, y, pw, ph);
      ctx.restore();
    }
  }

  // Optional Video Title
  if (project.title) {
    const size = Math.max(20, w / 32);
    ctx.save();
    ctx.font = `700 ${size}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = label;
    ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
    ctx.shadowBlur = 10;
    ctx.fillText(project.title, w / 2, Math.max(18, h * 0.035));
    ctx.restore();
  }

  // Optional Watermark in Bottom-Right Corner
  if (project.style.showLogo) {
    const size = Math.max(14, w / 52);
    ctx.save();
    ctx.font = `700 ${size}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = label;
    ctx.globalAlpha = 0.82;
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = 6;
    ctx.fillText("∞ Meridian", w - 22, h - 18);
    ctx.restore();
  }
}

function intersects(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
