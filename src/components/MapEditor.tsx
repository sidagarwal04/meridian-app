"use client";

import { geoGraticule, geoNaturalEarth1, geoOrthographic, geoPath, type GeoProjection } from "d3-geo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { countVisitedPlaces, flagEmoji, greatCircle, haversineKm } from "@/lib/geo";
import { drawShaderGlobe } from "@/lib/globeShader";
import { drawSatelliteBiomeShading } from "@/lib/render";
import { THEMES, transportMeta, type Leg, type Stop, type ThemeId } from "@/lib/types";
import { loadCountries, type CountryShape } from "@/lib/world";

function isValidCoord(lat: number, lon: number) {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 85.5 && Math.abs(lon) <= 180;
}

export function MapEditor({
  stops,
  legs = [],
  theme,
  color,
  onPick,
  onRemove,
  onMove,
  onUpdateStop,
  onClearAll,
}: {
  stops: Stop[];
  legs?: Leg[];
  theme: ThemeId;
  color: string;
  onPick: (lat: number, lon: number) => void;
  onRemove?: (index: number) => void;
  onMove?: (fromIndex: number, toIndex: number) => void;
  onUpdateStop?: (index: number, patch: { lat: number; lon: number }) => void;
  onClearAll?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const projectionRef = useRef<GeoProjection | null>(null);
  const [countries, setCountries] = useState<CountryShape[] | null>(null);
  const [stopImages, setStopImages] = useState<Record<string, HTMLImageElement[]>>({});

  // Camera state: projView defaults to "globe" (3D Tilted Satellite Globe like the reference video!)
  const [projView, setProjView] = useState<"globe" | "flat">("globe");
  const [zoom, setZoom] = useState(1.35);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [globeCenter, setGlobeCenter] = useState<{ lon: number; lat: number }>({ lon: 8, lat: 46 });
  const sphereBoundsRef = useRef<{ cx: number; cy: number; r: number } | null>(null);
  const [clickMode, setClickMode] = useState<"add" | "pan">("add");
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [hoveredStopId, setHoveredStopId] = useState<string | null>(null);
  const [cursorCoord, setCursorCoord] = useState<{ lat: number; lon: number } | null>(null);
  const [dragChipIndex, setDragChipIndex] = useState<number | null>(null);
  const [dropChipIndex, setDropChipIndex] = useState<number | null>(null);

  const validStops = useMemo(
    () => stops.filter((s) => isValidCoord(s.lat, s.lon)),
    [stops]
  );

  // Track pointer interactions to distinguish click vs pan/orbit vs pin-drag
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
    startLon: number;
    startLat: number;
    draggingStopIndex: number | null;
  }>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    startLon: 8,
    startLat: 46,
    draggingStopIndex: null,
  });

  useEffect(() => {
    let cancel = false;
    loadCountries().then((data) => {
      if (!cancel) setCountries(data);
    });
    return () => {
      cancel = true;
    };
  }, []);

  const photoSignature = useMemo(
    () => stops.map((s) => `${s.id}:${s.photos?.length || 0}:${(s.photos ?? []).map((p) => p.slice(-20)).join(",")}`).join("|"),
    [stops]
  );

  useEffect(() => {
    let cancel = false;
    const next: Record<string, HTMLImageElement[]> = {};
    const tasks: Promise<void>[] = [];
    stops.forEach((stop) => {
      const photos = stop.photos ?? [];
      if (!photos.length) return;
      const ordered: (HTMLImageElement | null)[] = new Array(photos.length).fill(null);
      photos.forEach((src, i) => {
        if (!src) return;
        tasks.push(
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              ordered[i] = img;
              next[stop.id] = ordered.filter((x): x is HTMLImageElement => x !== null);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = src;
          })
        );
      });
    });
    Promise.all(tasks).then(() => {
      if (!cancel) setStopImages({ ...next });
    });
    return () => {
      cancel = true;
    };
  }, [photoSignature, stops]);

  const clampPan = useCallback((x: number, y: number, z: number, width: number, height: number) => {
    const maxX = Math.max(80, (width * (z - 0.6)) / 2);
    const maxY = Math.max(60, (height * (z - 0.6)) / 2);
    return {
      x: Number.isFinite(x) ? Math.max(-maxX, Math.min(maxX, x)) : 0,
      y: Number.isFinite(y) ? Math.max(-maxY, Math.min(maxY, y)) : 0,
    };
  }, []);

  const fitRoute = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const width = Math.max(320, wrap.clientWidth);
    const height = Math.max(240, wrap.clientHeight);
    if (!validStops.length) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setGlobeCenter({ lon: 10, lat: 30 });
      return;
    }

    // Compute spherical centroid of validStops for 3D Globe view
    let sx = 0,
      sy = 0,
      sz = 0;
    validStops.forEach((s) => {
      const phi = (s.lat * Math.PI) / 180;
      const lam = (s.lon * Math.PI) / 180;
      sx += Math.cos(phi) * Math.cos(lam);
      sy += Math.cos(phi) * Math.sin(lam);
      sz += Math.sin(phi);
    });
    const cLon = (Math.atan2(sy, sx) * 180) / Math.PI;
    const cLat = (Math.atan2(sz, Math.hypot(sx, sy)) * 180) / Math.PI;
    setGlobeCenter({ lon: cLon, lat: Math.max(-72, Math.min(72, cLat)) });

    let maxKm = 300;
    validStops.forEach((s) => {
      maxKm = Math.max(maxKm, haversineKm({ lat: cLat, lon: cLon }, s));
    });

    const baseScale = Math.min(width / 5.1, height / 2.75);
    const baseProj = geoNaturalEarth1()
      .scale(baseScale)
      .translate([width / 2, height / 2]);

    const pts = validStops
      .map((s) => baseProj([s.lon, s.lat]))
      .filter((p): p is [number, number] => Boolean(p && Number.isFinite(p[0]) && Number.isFinite(p[1])));

    if (!pts.length) {
      setZoom(1.2);
      setPan({ x: 0, y: 0 });
      return;
    }

    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const spanX = Math.max(maxX - minX, 90);
    const spanY = Math.max(maxY - minY, 70);

    const flatZoom = Math.max(1, Math.min(2.8, Math.min((width * 0.62) / spanX, (height * 0.58) / spanY)));
    const globeZoom =
      maxKm > 4200 ? 0.95 : maxKm > 2200 ? 1.25 : maxKm > 1000 ? 1.65 : maxKm > 450 ? 2.1 : 2.55;
    const targetZoom = projView === "globe" ? globeZoom : flatZoom;
    const rawPanX = (width / 2 - cx) * flatZoom;
    const rawPanY = (height / 2 - cy) * flatZoom;

    setZoom(targetZoom);
    setPan(projView === "globe" ? { x: 0, y: 0 } : clampPan(rawPanX, rawPanY, flatZoom, width, height));
  }, [validStops, clampPan, projView]);

  const resetWorld = useCallback(() => {
    setZoom(0.95);
    setPan({ x: 0, y: 0 });
    setSelectedStopId(null);
  }, []);

  // Frame the initial route once on mount when countries load
  const initialFramed = useRef(false);
  useEffect(() => {
    if (!countries || initialFramed.current) return;
    initialFramed.current = true;
    fitRoute();
  }, [countries, fitRoute]);

  // Clear selection if stop was removed
  useEffect(() => {
    if (selectedStopId && !stops.some((s) => s.id === selectedStopId)) {
      setSelectedStopId(null);
    }
  }, [stops, selectedStopId]);

  // Helper to find if a canvas coordinate [mx, my] is on an existing stop pin
  const findStopAtPoint = useCallback(
    (mx: number, my: number): number => {
      const projection = projectionRef.current;
      if (!projection) return -1;
      for (let i = stops.length - 1; i >= 0; i--) {
        const stop = stops[i];
        if (!isValidCoord(stop.lat, stop.lon)) continue;
        const xy = projection([stop.lon, stop.lat]);
        if (!xy) continue;
        if (Math.hypot(mx - xy[0], my - xy[1]) <= 16) {
          return i;
        }
      }
      return -1;
    },
    [stops]
  );

  // Strict coordinate inversion that rejects clicks outside the 3D globe or 2D sphere oval
  const invertInsideSphere = useCallback((mx: number, my: number): { lat: number; lon: number } | null => {
    const projection = projectionRef.current;
    if (!projection?.invert) return null;
    if (sphereBoundsRef.current) {
      const { cx, cy, r } = sphereBoundsRef.current;
      if (Math.hypot(mx - cx, my - cy) > r - 1) return null;
    }
    const coord = projection.invert([mx, my]);
    if (!coord) return null;
    const [lon, lat] = coord;
    if (!isValidCoord(lat, lon)) return null;
    const reprojected = projection([lon, lat]);
    if (!reprojected || !Number.isFinite(reprojected[0]) || !Number.isFinite(reprojected[1])) return null;
    if (Math.hypot(reprojected[0] - mx, reprojected[1] - my) > 3.5) return null;
    return {
      lat: Math.max(-85, Math.min(85, Number(lat.toFixed(4)))),
      lon: Math.max(-180, Math.min(180, Number(lon.toFixed(4)))),
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !countries) return;

    const paint = () => {
      const width = Math.max(320, wrap.clientWidth);
      const height = Math.max(240, wrap.clientHeight);
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

      const palette = THEMES[theme] ?? THEMES.earth;
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, width, height);

      // Subtle starfield in 3D space backdrop
      if (palette.stars) {
        let seed = 42;
        for (let i = 0; i < 65; i++) {
          seed = (seed * 16807) % 2147483647;
          const sx = ((seed % 1000) / 1000) * width;
          seed = (seed * 16807) % 2147483647;
          const sy = ((seed % 1000) / 1000) * height;
          ctx.beginPath();
          ctx.arc(sx, sy, i % 5 === 0 ? 1.1 : 0.65, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.26)";
          ctx.fill();
        }
      }

      const safeZoom = Number.isFinite(zoom) ? Math.max(0.75, Math.min(6, zoom)) : 1;
      let projection: GeoProjection;
      let shaderRendered = false;

      if (projView === "globe") {
        const minDim = Math.min(width, height);
        const effFactor = 0.56 * (safeZoom <= 1.2 ? safeZoom : 1.2 + Math.pow(safeZoom - 1.2, 0.78) * 0.9);
        const globeRadius = effFactor * minDim;
        const zoomBlend = Math.max(0, Math.min(1, (effFactor - 0.52) / 0.65));

        const desiredLimbPx = Math.min(height * 0.38, minDim * 0.40);
        const sinTilt = Math.max(0.34, Math.min(0.86, 1 - desiredLimbPx / globeRadius));
        const tiltDeg = 18 * (1 - zoomBlend) + ((Math.asin(sinTilt) * 180) / Math.PI) * zoomBlend;
        const rollDeg = -4 * (1 - zoomBlend) + -12.5 * zoomBlend;

        const rotation: [number, number, number] = [-globeCenter.lon, -globeCenter.lat + tiltDeg, rollDeg];
        const tempProj = geoOrthographic()
          .precision(0.3)
          .rotate(rotation)
          .translate([0, 0])
          .scale(globeRadius);
        const off = tempProj([globeCenter.lon, globeCenter.lat]) ?? [0, 0];
        const cx = width * (0.5 + 0.02 * zoomBlend) - off[0];
        const cy = height * (0.51 + 0.05 * zoomBlend) - off[1];

        sphereBoundsRef.current = { cx, cy, r: globeRadius };
        projection = geoOrthographic()
          .precision(0.3)
          .rotate(rotation)
          .translate([cx, cy])
          .scale(globeRadius);

        shaderRendered = drawShaderGlobe(ctx, {
          w: width,
          h: height,
          cx,
          cy,
          scale: globeRadius,
          rotation,
          theme,
          projMode: "globe",
          time: 0,
        });
      } else {
        sphereBoundsRef.current = null;
        const baseScale = Math.min(width / 5.1, height / 2.75);
        const clampedPan = clampPan(pan.x, pan.y, safeZoom, width, height);
        const cx = width / 2 + clampedPan.x;
        const cy = height / 2 + clampedPan.y;
        const scale = baseScale * safeZoom;

        projection = geoNaturalEarth1()
          .scale(scale)
          .translate([cx, cy]);

        shaderRendered = drawShaderGlobe(ctx, {
          w: width,
          h: height,
          cx,
          cy,
          scale,
          rotation: [0, 0, 0],
          theme,
          projMode: "naturalEarth1",
          time: 0,
        });
      }

      projectionRef.current = projection;
      const path = geoPath(projection, ctx);
      const visitedCodes = new Set(validStops.map((s) => s.code).filter(Boolean));
      const isSatelliteLook = theme === "earth";

      if (!shaderRendered) {
        // Fallback 2D canvas fill while WebGL texture loads
        ctx.save();
        ctx.beginPath();
        path({ type: "Sphere" } as never);
        ctx.fillStyle = palette.ocean;
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        countries.forEach((country) => {
          path(country.feature as never);
        });
        ctx.fillStyle = palette.land;
        ctx.fill();
        ctx.clip();
        drawSatelliteBiomeShading(ctx, projection, Math.min(width, height) * safeZoom, theme);
        ctx.restore();
      }

      // Country borders + crisp glowing white outlines on visited countries
      const hotCountries: CountryShape[] = [];
      countries.forEach((country) => {
        const isVisited = Boolean(country.code && visitedCodes.has(country.code));
        if (isVisited) hotCountries.push(country);
        ctx.beginPath();
        path(country.feature as never);
        ctx.lineWidth = 0.6;
        ctx.strokeStyle = palette.border;
        ctx.stroke();
      });

      hotCountries.forEach((country) => {
        ctx.save();
        ctx.beginPath();
        path(country.feature as never);
        ctx.fillStyle = isSatelliteLook ? "rgba(125, 211, 252, 0.12)" : palette.landHi;
        ctx.fill();
        ctx.shadowColor = "rgba(255, 255, 255, 0.72)";
        ctx.shadowBlur = 6;
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.94)";
        ctx.stroke();
        ctx.restore();
      });

      // Graticule
      ctx.beginPath();
      path(geoGraticule()());
      ctx.strokeStyle = palette.stars ? "rgba(255,255,255,0.035)" : "rgba(30,40,50,0.06)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Sphere outer atmospheric rim
      ctx.save();
      ctx.beginPath();
      path({ type: "Sphere" } as never);
      ctx.strokeStyle = palette.stars ? "rgba(125, 211, 252, 0.48)" : "rgba(71, 85, 105, 0.35)";
      ctx.lineWidth = 1.5;
      if (palette.stars && projView === "globe") {
        ctx.shadowColor = "rgba(56, 189, 248, 0.6)";
        ctx.shadowBlur = 10;
      }
      ctx.stroke();
      ctx.restore();

      // Draw curved great-circle route arcs between valid stops
      if (validStops.length > 1) {
        for (let i = 0; i < validStops.length - 1; i++) {
          const a = validStops[i];
          const b = validStops[i + 1];
          const arcCoords = greatCircle(a, b, 48);

          // Outer glow
          ctx.save();
          ctx.beginPath();
          path({
            type: "LineString",
            coordinates: arcCoords,
          });
          ctx.strokeStyle = color || palette.line;
          ctx.lineWidth = 5;
          ctx.globalAlpha = 0.25;
          ctx.lineCap = "round";
          ctx.stroke();
          ctx.restore();

          // Main route line
          ctx.save();
          ctx.beginPath();
          path({
            type: "LineString",
            coordinates: arcCoords,
          });
          ctx.strokeStyle = color || palette.line;
          ctx.lineWidth = 2.6;
          ctx.lineCap = "round";
          if (legs[i]?.transport === "dot") {
            ctx.setLineDash([3, 7]);
          }
          ctx.stroke();
          ctx.restore();

          // Midpoint transport icon badge
          const mid = arcCoords[Math.floor(arcCoords.length / 2)];
          const midXY = mid ? projection(mid) : null;
          const distPx = (() => {
            const pA = projection([a.lon, a.lat]);
            const pB = projection([b.lon, b.lat]);
            return pA && pB ? Math.hypot(pA[0] - pB[0], pA[1] - pB[1]) : 0;
          })();
          if (midXY && distPx > 68) {
            const meta = transportMeta(legs[i]?.transport ?? "plane");
            if (meta.kind !== "draw") {
              ctx.save();
              ctx.beginPath();
              ctx.arc(midXY[0], midXY[1], 10, 0, Math.PI * 2);
              ctx.fillStyle = "rgba(15, 23, 42, 0.86)";
              ctx.fill();
              ctx.lineWidth = 1;
              ctx.strokeStyle = "rgba(255,255,255,0.28)";
              ctx.stroke();
              ctx.font = "11px sans-serif";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(meta.icon, midXY[0], midXY[1] + 0.5);
              ctx.restore();
            }
          }
        }
      }

      // Draw Stop Pins & City Labels
      stops.forEach((stop, index) => {
        if (!isValidCoord(stop.lat, stop.lon)) return;
        const xy = projection([stop.lon, stop.lat]);
        if (!xy) return;
        const isSelected = stop.id === selectedStopId;
        const isHovered = stop.id === hoveredStopId;
        const radius = isSelected ? 14 : isHovered ? 13 : 11.5;

        // Selection halo
        if (isSelected || isHovered) {
          ctx.beginPath();
          ctx.arc(xy[0], xy[1], radius + 5, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? "rgba(56, 189, 248, 0.32)" : "rgba(255, 255, 255, 0.18)";
          ctx.fill();
        }

        // Pin circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(xy[0], xy[1], radius, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? "#0ea5e9" : index === 0 ? "#10b981" : index === stops.length - 1 ? "#6366f1" : "#2563eb";
        ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.lineWidth = isSelected ? 2.5 : 2;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
        ctx.restore();

        // Pin number
        ctx.fillStyle = "#ffffff";
        ctx.font = "700 11.5px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(index + 1), xy[0], xy[1] + 0.5);

        // Pin label pill
        const labelText = stop.name;
        ctx.font = "600 11.5px Inter, sans-serif";
        const textWidth = ctx.measureText(labelText).width;
        const pillW = textWidth + 14;
        const pillH = 20;
        const pillX = xy[0] - pillW / 2;
        const pillY = xy[1] - radius - pillH - 5;

        ctx.save();
        ctx.fillStyle = isSelected ? "rgba(14, 165, 233, 0.95)" : "rgba(15, 23, 42, 0.85)";
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, 6);
        ctx.fill();
        ctx.strokeStyle = isSelected ? "#ffffff" : "rgba(255,255,255,0.18)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#f8fafc";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(labelText, xy[0], pillY + pillH / 2 + 0.5);
        ctx.restore();

        // Floating Mini Polaroid Thumbnails on 2D Map if stop has photos (renders all photos side-by-side)
        const imgs = stopImages[stop.id] ?? [];
        if (imgs.length > 0) {
          const shownImgs = imgs.slice(0, 6);
          const thumbW = isSelected || isHovered ? 50 : 42;
          const thumbH = isSelected || isHovered ? 40 : 33;
          const gap = 6;
          const startX = xy[0] + radius + 8;
          const ty = xy[1] - thumbH / 2;

          shownImgs.forEach((img, pIdx) => {
            const tx = startX + pIdx * (thumbW + gap);
            ctx.save();
            ctx.fillStyle = "#f8fafc";
            ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
            ctx.shadowBlur = 9;
            ctx.beginPath();
            ctx.roundRect(tx - 2.5, ty - 2.5, thumbW + 5, thumbH + 5, 5.5);
            ctx.fill();

            ctx.beginPath();
            ctx.roundRect(tx, ty, thumbW, thumbH, 4);
            ctx.clip();
            const iw = img.naturalWidth || img.width || 1;
            const ih = img.naturalHeight || img.height || 1;
            const sc = Math.max(thumbW / iw, thumbH / ih);
            const sw = thumbW / sc;
            const sh = thumbH / sc;
            ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, tx, ty, thumbW, thumbH);
            ctx.restore();
          });

          if (imgs.length > shownImgs.length) {
            const lastX = startX + (shownImgs.length - 1) * (thumbW + gap);
            ctx.save();
            ctx.fillStyle = "#0ea5e9";
            ctx.beginPath();
            ctx.roundRect(lastX + thumbW - 12, ty - 6, 20, 14, 7);
            ctx.fill();
            ctx.fillStyle = "#ffffff";
            ctx.font = "700 9.5px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(`+${imgs.length - shownImgs.length}`, lastX + thumbW - 2, ty + 1);
            ctx.restore();
          }
        }
      });
    };

    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [countries, stops, validStops, legs, theme, color, zoom, pan, projView, globeCenter, selectedStopId, hoveredStopId, stopImages, clampPan]);

  const selectedIndex = useMemo(
    () => (selectedStopId ? stops.findIndex((s) => s.id === selectedStopId) : -1),
    [stops, selectedStopId]
  );
  const selectedStop = selectedIndex >= 0 ? stops[selectedIndex] : null;

  const selectedPinPosition = useMemo(() => {
    if (!selectedStop || !projectionRef.current || !isValidCoord(selectedStop.lat, selectedStop.lon)) return null;
    const xy = projectionRef.current([selectedStop.lon, selectedStop.lat]);
    return xy ? { x: xy[0], y: xy[1] } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStop, zoom, pan, projView, globeCenter, countries]);

  const totalKm = useMemo(() => {
    let km = 0;
    for (let i = 1; i < validStops.length; i++) {
      km += haversineKm(validStops[i - 1], validStops[i]);
    }
    return Math.round(km);
  }, [validStops]);

  const adjustZoom = (factor: number) => {
    const wrap = wrapRef.current;
    const width = wrap?.clientWidth || 640;
    const height = wrap?.clientHeight || 480;
    setZoom((prev) => {
      const next = Math.max(0.75, Math.min(5.5, Number((prev * factor).toFixed(2))));
      setPan((p) => clampPan(p.x, p.y, next, width, height));
      return next;
    });
  };

  return (
    <div
      ref={wrapRef}
      className={`map-editor ${clickMode === "pan" ? "mode-pan" : "mode-add"}`}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest(".map-ui-overlay")) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = event.clientX - rect.left;
        const my = event.clientY - rect.top;
        const hitStopIdx = findStopAtPoint(mx, my);

        dragRef.current = {
          active: true,
          moved: false,
          startX: event.clientX,
          startY: event.clientY,
          startPanX: pan.x,
          startPanY: pan.y,
          startLon: globeCenter.lon,
          startLat: globeCenter.lat,
          draggingStopIndex: hitStopIdx >= 0 ? hitStopIdx : null,
        };
      }}
      onPointerMove={(event) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = event.clientX - rect.left;
        const my = event.clientY - rect.top;

        if (!dragRef.current.active) {
          const hitIdx = findStopAtPoint(mx, my);
          setHoveredStopId(hitIdx >= 0 ? stops[hitIdx].id : null);
          const coord = invertInsideSphere(mx, my);
          setCursorCoord(coord);
          return;
        }

        const dx = event.clientX - dragRef.current.startX;
        const dy = event.clientY - dragRef.current.startY;
        if (Math.hypot(dx, dy) > 5) {
          dragRef.current.moved = true;
        }
        if (!dragRef.current.moved) return;

        // If dragging a stop pin and onUpdateStop is provided, reposition the pin live
        if (dragRef.current.draggingStopIndex !== null && onUpdateStop) {
          const coord = invertInsideSphere(mx, my);
          if (coord) {
            onUpdateStop(dragRef.current.draggingStopIndex, coord);
          }
          return;
        }

        if (projView === "globe") {
          const degPerPx = 0.24 / Math.max(0.7, zoom);
          let nextLon = dragRef.current.startLon - dx * degPerPx;
          while (nextLon > 180) nextLon -= 360;
          while (nextLon < -180) nextLon += 360;
          const nextLat = Math.max(-75, Math.min(75, dragRef.current.startLat + dy * degPerPx));
          setGlobeCenter({ lon: nextLon, lat: nextLat });
          return;
        }

        // Otherwise pan the 2D map smoothly
        const wrap = wrapRef.current;
        const width = wrap?.clientWidth || 640;
        const height = wrap?.clientHeight || 480;
        setPan(
          clampPan(
            dragRef.current.startPanX + dx,
            dragRef.current.startPanY + dy,
            zoom,
            width,
            height
          )
        );
      }}
      onPointerUp={(event) => {
        if ((event.target as HTMLElement).closest(".map-ui-overlay")) return;
        const wasDragging = dragRef.current.active;
        const moved = dragRef.current.moved;
        const hitStopIdx = dragRef.current.draggingStopIndex;
        dragRef.current.active = false;
        dragRef.current.draggingStopIndex = null;

        if (!wasDragging || moved) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = event.clientX - rect.left;
        const my = event.clientY - rect.top;

        // Clicking an existing pin selects/toggles it instead of adding a duplicate pin!
        if (hitStopIdx !== null && hitStopIdx >= 0) {
          const clickedStop = stops[hitStopIdx];
          setSelectedStopId((prev) => (prev === clickedStop.id ? null : clickedStop.id));
          return;
        }

        if (selectedStopId) {
          setSelectedStopId(null);
        }

        if (clickMode !== "add") return;

        const coord = invertInsideSphere(mx, my);
        if (!coord) return;
        onPick(coord.lat, coord.lon);
      }}
      onPointerLeave={() => {
        dragRef.current.active = false;
        setHoveredStopId(null);
        setCursorCoord(null);
      }}
      onWheel={(event) => {
        if ((event.target as HTMLElement).closest(".map-ui-overlay")) return;
        event.preventDefault();
        const factor = event.deltaY < 0 ? 1.14 : 0.88;
        adjustZoom(factor);
      }}
    >
      <canvas ref={canvasRef} className="editor-canvas" />

      {/* Top-Left Map Mode & Stats Bar */}
      <div className="map-ui-overlay map-toolbar-left">
        <div className="map-mode-switch" role="group" aria-label="Map interaction mode">
          <button
            type="button"
            className={clickMode === "add" ? "active" : ""}
            onClick={() => setClickMode("add")}
            title="Click anywhere on the globe to drop a new stop, or drag to orbit"
          >
            <span>＋</span> Click to add stop
          </button>
          <button
            type="button"
            className={clickMode === "pan" ? "active" : ""}
            onClick={() => setClickMode("pan")}
            title="Orbit/pan and inspect pins without adding new stops on click"
          >
            <span>✋</span> Orbit / Select
          </button>
        </div>
        <div className="map-stats-pill">
          <span>
            {countVisitedPlaces(stops)} {countVisitedPlaces(stops) === 1 ? "place" : "places"}
          </span>
          {totalKm > 0 ? <span>· {totalKm.toLocaleString()} km</span> : null}
          {cursorCoord ? (
            <span className="map-coord-readout">
              · {cursorCoord.lat.toFixed(1)}°, {cursorCoord.lon.toFixed(1)}°
            </span>
          ) : null}
        </div>
      </div>

      {/* Top-Right Camera Controls */}
      <div className="map-ui-overlay map-toolbar-right">
        <button
          type="button"
          className="map-ctrl-btn text"
          onClick={() => setProjView((v) => (v === "globe" ? "flat" : "globe"))}
          title="Switch between 3D Tilted Horizon Globe and 2D Flat Map"
        >
          {projView === "globe" ? "🌍 3D Horizon" : "🗺 2D Flat"}
        </button>
        <button type="button" className="map-ctrl-btn" onClick={() => adjustZoom(1.25)} title="Zoom in">
          ＋
        </button>
        <button type="button" className="map-ctrl-btn" onClick={() => adjustZoom(0.8)} title="Zoom out">
          －
        </button>
        <button type="button" className="map-ctrl-btn text" onClick={fitRoute} title="Center and fit current route">
          ⊡ Fit route
        </button>
        <button type="button" className="map-ctrl-btn text" onClick={resetWorld} title="Reset to full world map">
          🌐 World view
        </button>
      </div>

      {/* Floating Popover when a Pin on the Map is Selected */}
      {selectedStop && selectedIndex >= 0 ? (
        <div
          className="map-ui-overlay map-pin-popover"
          style={
            selectedPinPosition
              ? {
                  left: `${Math.max(120, Math.min(Math.max(120, (wrapRef.current?.clientWidth || 360) - 120), selectedPinPosition.x))}px`,
                  top: `${Math.max(76, Math.min(Math.max(76, (wrapRef.current?.clientHeight || 320) - 16), selectedPinPosition.y - 44))}px`,
                }
              : undefined
          }
        >
          <div className="map-pin-popover-head">
            <span className="idx">{selectedIndex + 1}</span>
            <div>
              <strong>
                {selectedStop.code ? `${flagEmoji(selectedStop.code)} ` : ""}
                {selectedStop.name}
              </strong>
              {selectedStop.country ? <small>{selectedStop.country}</small> : null}
            </div>
            <button
              type="button"
              className="popover-close"
              aria-label="Close pin menu"
              onClick={() => setSelectedStopId(null)}
            >
              ×
            </button>
          </div>
          {selectedStop.photos && selectedStop.photos.length > 0 ? (
            <div className="map-pin-popover-photos">
              {selectedStop.photos.map((src, pIdx) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src.slice(-24) + pIdx} src={src} alt={`${selectedStop.name} photo ${pIdx + 1}`} />
              ))}
            </div>
          ) : null}
          <div className="map-pin-popover-actions">
            {onMove ? (
              <>
                <button
                  type="button"
                  disabled={selectedIndex === 0}
                  onClick={() => onMove(selectedIndex, selectedIndex - 1)}
                  title="Move stop earlier in route"
                >
                  ← Earlier
                </button>
                <button
                  type="button"
                  disabled={selectedIndex === stops.length - 1}
                  onClick={() => onMove(selectedIndex, selectedIndex + 1)}
                  title="Move stop later in route"
                >
                  Later →
                </button>
              </>
            ) : null}
            {onRemove ? (
              <button
                type="button"
                className="danger"
                onClick={() => {
                  onRemove(selectedIndex);
                  setSelectedStopId(null);
                }}
                title="Remove this stop from route"
              >
                🗑 Remove
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Bottom Interactive Route Timeline Strip on the Map */}
      <div className="map-ui-overlay map-bottom-bar">
        {stops.length > 0 ? (
          <>
            <div className="map-route-chips" role="list" aria-label="Route places order">
              {stops.map((stop, index) => (
                <div
                  key={stop.id}
                  role="listitem"
                  draggable={Boolean(onMove)}
                  onDragStart={() => setDragChipIndex(index)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropChipIndex(index);
                  }}
                  onDragLeave={() => setDropChipIndex((curr) => (curr === index ? null : curr))}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragChipIndex !== null && dragChipIndex !== index && onMove) {
                      onMove(dragChipIndex, index);
                    }
                    setDragChipIndex(null);
                    setDropChipIndex(null);
                  }}
                  onDragEnd={() => {
                    setDragChipIndex(null);
                    setDropChipIndex(null);
                  }}
                  className={`map-stop-chip ${selectedStopId === stop.id ? "selected" : ""} ${
                    dropChipIndex === index ? "drop-target" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="chip-select"
                    onClick={() => setSelectedStopId((prev) => (prev === stop.id ? null : stop.id))}
                    title="Click to inspect or drag to reorder"
                  >
                    <span className="chip-num">{index + 1}</span>
                    {stop.photos && stop.photos.length > 0
                      ? stop.photos.map((photoSrc, pIdx) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={photoSrc.slice(-20) + pIdx} src={photoSrc} alt="" className="chip-photo-thumb" />
                        ))
                      : null}
                    <span className="chip-name">
                      {stop.code ? `${flagEmoji(stop.code)} ` : ""}
                      {stop.name}
                    </span>
                  </button>
                  {onMove && stops.length > 1 ? (
                    <div className="chip-order-btns">
                      <button
                        type="button"
                        aria-label={`Move ${stop.name} earlier`}
                        disabled={index === 0}
                        onClick={() => onMove(index, index - 1)}
                        title="Move earlier"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${stop.name} later`}
                        disabled={index === stops.length - 1}
                        onClick={() => onMove(index, index + 1)}
                        title="Move later"
                      >
                        ›
                      </button>
                    </div>
                  ) : null}
                  {onRemove ? (
                    <button
                      type="button"
                      className="chip-remove"
                      aria-label={`Remove ${stop.name}`}
                      onClick={() => onRemove(index)}
                      title={`Remove ${stop.name}`}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="map-bottom-actions">
              {onRemove ? (
                <button
                  type="button"
                  className="map-mini-btn"
                  onClick={() => onRemove(stops.length - 1)}
                  title="Remove the last added stop"
                >
                  ↩ Undo last
                </button>
              ) : null}
              {onClearAll && stops.length > 1 ? (
                <button
                  type="button"
                  className="map-mini-btn danger"
                  onClick={onClearAll}
                  title="Remove all stops"
                >
                  Clear all
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <p className="map-empty-hint">
            No places in route yet — search a city in the sidebar or click anywhere on the globe to drop your first stop.
          </p>
        )}
      </div>
    </div>
  );
}
