import { geoGraticule, geoOrthographic, geoPath } from "d3-geo";
import { flagEmoji, pathKm, pointAlong, slicePath } from "./geo";
import { THEMES, transportMeta, type Project, type Style } from "./types";
import type { CountryShape } from "./world";

export type Frame = {
  camera: { lon: number; lat: number; factor: number };
  revealed: [number, number][][];
  full: [number, number][][];
  head: [number, number] | null;
  icon: string | null;
  dashed: boolean;
  labelIndexes: number[];
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

function zoomFor(km: number) {
  if (km > 7000) return 0.46;
  if (km > 3000) return 0.66;
  if (km > 1200) return 0.92;
  if (km > 400) return 1.2;
  return 1.5;
}

function fitFactor(stops: Project["stops"]) {
  if (stops.length <= 1) return 1.15;
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
  return Math.max(0.4, Math.min(1.45, zoomFor(maxKm * 2.1)));
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
  push("intro", 0, (project.style.startZoom ? 1.25 : 0.2) / speed);
  push("dwell", 0, dwellOf(project, 0) / speed);
  project.legs.forEach((_, index) => {
    const km = pathKm(paths[index] ?? []);
    const dur = Math.min(4.6, Math.max(1.45, (km || 500) / 1100)) / speed;
    push("leg", index, dur);
    push("dwell", index + 1, dwellOf(project, index + 1) / speed);
  });
  push("outro", project.stops.length - 1, (project.style.endZoom || project.style.showFullRouteAtEnd ? 1.7 : 0.35) / speed);
  return { segs, total: cursor };
}

function dwellOf(project: Project, index: number) {
  const stop = project.stops[index];
  if (!stop) return 0.6;
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
  const u = seg.dur === 0 ? 1 : (t - seg.start) / seg.dur;
  const stops = project.stops;
  const fit = { ...centroid(stops), factor: fitFactor(stops) };
  const full = paths.filter((path) => path.length > 1);
  const empty: Frame = {
    camera: { lon: ((time * 14) % 360) - 180, lat: 18, factor: 0.42 },
    revealed: [],
    full: [],
    head: null,
    icon: null,
    dashed: false,
    labelIndexes: [],
    photoStop: null,
    photoU: 0,
    distanceKm: null,
    showUnderlay: 0.35,
  };
  if (!stops.length || !seg) return empty;

  const close = (index: number, km = 700) => ({
    lon: stops[index].lon,
    lat: stops[index].lat,
    factor: zoomFor(km),
  });

  if (seg.type === "intro") {
    const km = pathKm(paths[0] ?? []);
    const dest = close(0, km || 900);
    const e = smooth(u);
    return {
      ...empty,
      camera: {
        lon: lerpAngle(fit.lon, dest.lon, e),
        lat: fit.lat + (dest.lat - fit.lat) * e,
        factor: fit.factor + (dest.factor - fit.factor) * e,
      },
      full,
      labelIndexes: project.style.labels === "always" ? stops.map((_, i) => i) : [0],
      showUnderlay: 0.15 + 0.2 * e,
      head: [stops[0].lon, stops[0].lat],
    };
  }

  if (seg.type === "outro") {
    const from = close(seg.index, pathKm(paths[paths.length - 1] ?? []) || 800);
    const to = project.style.showFullRouteAtEnd || project.style.endZoom ? fit : from;
    const e = smooth(u);
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
      head: [stops[seg.index].lon, stops[seg.index].lat],
      showUnderlay: 0.2,
    };
  }

  if (seg.type === "dwell") {
    const km = pathKm(paths[Math.max(0, seg.index - 1)] ?? paths[0] ?? []);
    return {
      ...empty,
      camera: close(seg.index, km || 800),
      revealed: full.slice(0, seg.index),
      full,
      head: [stops[seg.index].lon, stops[seg.index].lat],
      labelIndexes: indexesFor(project.style, stops.length, seg.index, "dwell"),
      photoStop: stops[seg.index].photos.length ? seg.index : null,
      photoU: u,
      showUnderlay: 0.28,
    };
  }

  const path: [number, number][] = paths[seg.index] ?? [];
  const km = pathKm(path);
  const head: [number, number] = path.length ? pointAlong(path, u) : [stops[seg.index].lon, stops[seg.index].lat];
  const transport = project.legs[seg.index]?.transport ?? "plane";
  const meta = transportMeta(transport);
  return {
    camera: { lon: head[0], lat: head[1], factor: zoomFor(km || 800) },
    revealed: [...full.slice(0, seg.index), slicePath(path, u)],
    full,
    head,
    icon: meta.kind === "draw" && transport !== "dot" ? null : meta.icon,
    dashed: transport === "dot",
    labelIndexes: indexesFor(project.style, stops.length, seg.index + 1, "leg"),
    photoStop: null,
    photoU: 0,
    distanceKm: project.style.units === "none" ? null : km * u,
    showUnderlay: 0.22,
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

function drawStars(ctx: CanvasRenderingContext2D, w: number, h: number) {
  let s = 42;
  for (let i = 0; i < 60; i++) {
    s = (s * 16807) % 2147483647;
    const x = (s % 1000) / 1000;
    s = (s * 16807) % 2147483647;
    const y = (s % 1000) / 1000;
    ctx.fillStyle = `rgba(255,255,255,${0.25 + (i % 5) * 0.1})`;
    ctx.fillRect(x * w, y * h, i % 4 === 0 ? 1.6 : 1, i % 4 === 0 ? 1.6 : 1);
  }
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
  const palette = THEMES[project.style.theme];
  const frame = frameAt(project, paths, time);
  const bg = project.style.background || palette.bg;
  const line = project.style.lineColor || palette.line;
  const label = project.style.labelColor || palette.labelColor;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  if (palette.stars) drawStars(ctx, w, h);

  const projection = geoOrthographic()
    .precision(0.4)
    .rotate([-frame.camera.lon, -frame.camera.lat])
    .translate([w / 2, h / 2 + h * 0.02])
    .scale(frame.camera.factor * Math.min(w, h));
  const path = geoPath(projection, ctx);

  ctx.beginPath();
  path({ type: "Sphere" } as never);
  ctx.fillStyle = palette.ocean;
  ctx.fill();

  const visited = new Set(
    project.stops
      .filter((_, index) => frame.labelIndexes.includes(index))
      .map((stop) => stop.code)
      .filter(Boolean)
  );
  if (!project.style.highlightCountries) visited.clear();

  countries.forEach((country) => {
    ctx.beginPath();
    path(country.feature as never);
    const hot = country.code && visited.has(country.code);
    ctx.fillStyle = hot ? palette.landHi : palette.land;
    ctx.fill();
    ctx.lineWidth = Math.max(0.4, w / 1800);
    ctx.strokeStyle = palette.border;
    ctx.stroke();
  });

  ctx.beginPath();
  path(geoGraticule()());
  ctx.strokeStyle = palette.stars ? "rgba(255,255,255,0.08)" : "rgba(30,40,50,0.08)";
  ctx.lineWidth = 0.6;
  ctx.stroke();

  ctx.beginPath();
  path({ type: "Sphere" } as never);
  ctx.strokeStyle = palette.stars ? "rgba(255,255,255,0.35)" : "rgba(40,50,60,0.28)";
  ctx.lineWidth = Math.max(1.2, w / 700);
  ctx.stroke();

  const strokeRoute = (lines: [number, number][][], alpha: number, width: number, dash: boolean) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = line;
    ctx.setLineDash(dash ? [2, Math.max(8, width * 3)] : []);
    ctx.shadowColor = line;
    ctx.shadowBlur = dash ? 0 : Math.max(6, w / 160);
    lines.forEach((coords) => {
      if (coords.length < 2) return;
      ctx.beginPath();
      path({ type: "LineString", coordinates: coords });
      ctx.stroke();
    });
    ctx.restore();
  };

  strokeRoute(frame.full, frame.showUnderlay, Math.max(1.5, w / 520), false);
  strokeRoute(frame.revealed, 1, Math.max(2.4, w / 340), frame.dashed);

  project.stops.forEach((stop) => {
    const xy = projection([stop.lon, stop.lat]);
    if (!xy) return;
    ctx.beginPath();
    ctx.arc(xy[0], xy[1], Math.max(3.5, w / 280), 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = line;
    ctx.stroke();
  });

  if (frame.head && frame.icon) {
    const xy = projection(frame.head);
    if (xy) {
      ctx.font = `${Math.round(Math.max(18, w / 28))}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(frame.icon, xy[0], xy[1] - 4);
      if (frame.distanceKm != null) {
        const unit = project.style.units === "mi" ? `${Math.round(frame.distanceKm * 0.621371)} mi` : `${Math.round(frame.distanceKm)} km`;
        pill(ctx, unit, xy[0], xy[1] + Math.max(22, w / 40), label, bg, Math.max(12, w / 70));
      }
    }
  }

  const taken: { x: number; y: number; w: number; h: number }[] = [];
  frame.labelIndexes.forEach((index) => {
    const stop = project.stops[index];
    const xy = projection([stop.lon, stop.lat]);
    if (!xy) return;
    const flag = project.style.showCountryFlags && stop.code ? flagEmoji(stop.code) : "";
    const primary = `${stop.emoji ? `${stop.emoji} ` : ""}${stop.name}`;
    const secondary = [flag, stop.country].filter(Boolean).join(" ");
    const font = Math.max(13, w / 62);
    ctx.font = `600 ${font}px Inter, sans-serif`;
    const width = Math.max(ctx.measureText(primary).width, secondary ? ctx.measureText(secondary).width * 0.82 : 0) + 18;
    const height = secondary ? font * 2.5 : font * 1.7;
    const x = xy[0] - width / 2;
    const y = xy[1] - height - Math.max(12, w / 80);
    const rect = { x, y, w: width, h: height };
    if (project.style.optimizeLabels && taken.some((box) => intersects(box, rect))) return;
    taken.push(rect);
    ctx.fillStyle = palette.stars ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.82)";
    roundRect(ctx, x, y, width, height, 8);
    ctx.fill();
    ctx.fillStyle = label;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(primary, xy[0], y + (secondary ? height * 0.36 : height / 2));
    if (secondary) {
      ctx.font = `500 ${font * 0.78}px Inter, sans-serif`;
      ctx.globalAlpha = 0.85;
      ctx.fillText(secondary, xy[0], y + height * 0.72);
      ctx.globalAlpha = 1;
    }
  });

  if (frame.photoStop != null) {
    const stop = project.stops[frame.photoStop];
    const imgs = images[stop.id] ?? [];
    const img = imgs[Math.min(imgs.length - 1, Math.floor(frame.photoU * Math.max(imgs.length, 1)))];
    const xy = projection([stop.lon, stop.lat]);
    if (img && xy) {
      const pw = Math.min(w * 0.28, 360);
      const ph = pw * 0.72;
      const x = Math.min(w - pw - 24, Math.max(24, xy[0] + 18));
      const y = Math.min(h - ph - 80, Math.max(70, xy[1] - ph / 2));
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      roundRect(ctx, x - 8, y - 8, pw + 16, ph + 16, 16);
      ctx.fill();
      ctx.beginPath();
      roundRect(ctx, x, y, pw, ph, 12);
      ctx.clip();
      ctx.drawImage(img, x, y, pw, ph);
      ctx.restore();
    }
  }

  if (project.title) {
    const size = Math.max(22, w / 28);
    ctx.font = `700 ${size}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = label;
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 8;
    ctx.fillText(project.title, w / 2, Math.max(18, h * 0.035));
    ctx.shadowBlur = 0;
  }

  if (project.style.showLogo) {
    const size = Math.max(14, w / 54);
    ctx.font = `650 ${size}px Inter, sans-serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = label;
    ctx.globalAlpha = 0.85;
    ctx.fillText("Meridian", w - 22, h - 18);
    ctx.globalAlpha = 1;
  }
}

function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, bg: string, font: number) {
  ctx.font = `600 ${font}px Inter, sans-serif`;
  const width = ctx.measureText(text).width + 14;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  roundRect(ctx, x - width / 2, y - font, width, font + 8, 8);
  ctx.fill();
  ctx.fillStyle = color || "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y - 2);
  void bg;
}

function intersects(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
