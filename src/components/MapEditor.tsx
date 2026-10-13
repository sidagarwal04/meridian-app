"use client";

import { geoGraticule, geoNaturalEarth1, geoPath, type GeoProjection } from "d3-geo";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flagEmoji, greatCircle, haversineKm } from "@/lib/geo";
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

  // Camera state: zoom = 1 means full world neatly fitted; panX/panY are pixel offsets
  const [zoom, setZoom] = useState(1.25);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
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

  // Track pointer interactions to distinguish click vs pan vs pin-drag
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
    draggingStopIndex: number | null;
  }>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
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
      return;
    }
    const baseScale = Math.min(width / 5.1, height / 2.75);
    const baseProj = geoNaturalEarth1()
      .scale(baseScale)
      .translate([width / 2, height / 2]);

    const pts = validStops
      .map((s) => baseProj([s.lon, s.lat]))
      .filter((p): p is [number, number] => Boolean(p && Number.isFinite(p[0]) && Number.isFinite(p[1])));

    if (!pts.length) {
      setZoom(1);
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

    const targetZoom = Math.max(1, Math.min(2.8, Math.min((width * 0.62) / spanX, (height * 0.58) / spanY)));
    const rawPanX = (width / 2 - cx) * targetZoom;
    const rawPanY = (height / 2 - cy) * targetZoom;

    setZoom(targetZoom);
    setPan(clampPan(rawPanX, rawPanY, targetZoom, width, height));
  }, [validStops, clampPan]);

  const resetWorld = useCallback(() => {
    setZoom(1);
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

  // Strict coordinate inversion that rejects clicks outside the Natural Earth sphere oval
  const invertInsideSphere = useCallback((mx: number, my: number): { lat: number; lon: number } | null => {
    const projection = projectionRef.current;
    if (!projection?.invert) return null;
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

      // Ambient background glow
      const bgGlow = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.05,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.7
      );
      bgGlow.addColorStop(0, "rgba(56, 189, 248, 0.08)");
      bgGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = bgGlow;
      ctx.fillRect(0, 0, width, height);

      const baseScale = Math.min(width / 5.1, height / 2.75);
      const safeZoom = Number.isFinite(zoom) ? Math.max(0.75, Math.min(6, zoom)) : 1;
      const clampedPan = clampPan(pan.x, pan.y, safeZoom, width, height);

      const projection = geoNaturalEarth1()
        .scale(baseScale * safeZoom)
        .translate([width / 2 + clampedPan.x, height / 2 + clampedPan.y]);

      projectionRef.current = projection;
      const path = geoPath(projection, ctx);

      // Draw Ocean Sphere
      ctx.save();
      ctx.beginPath();
      path({ type: "Sphere" } as never);
      ctx.fillStyle = palette.ocean;
      ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
      ctx.shadowBlur = 28;
      ctx.fill();
      ctx.restore();

      // Visited countries set
      const visitedCodes = new Set(validStops.map((s) => s.code).filter(Boolean));
      const isSatelliteLook = theme === "earth" || theme === "satellite";

      // Shallow coastal shelf glow
      if (isSatelliteLook) {
        ctx.save();
        ctx.beginPath();
        path({ type: "Sphere" } as never);
        ctx.clip();
        countries.forEach((country) => {
          ctx.beginPath();
          path(country.feature as never);
          ctx.strokeStyle = "rgba(56, 189, 248, 0.14)";
          ctx.lineWidth = Math.max(3, baseScale * safeZoom * 0.025);
          ctx.stroke();
        });
        ctx.restore();
      }

      // Landmasses base fill + satellite biome terrain shading
      ctx.save();
      ctx.beginPath();
      countries.forEach((country) => {
        path(country.feature as never);
      });
      ctx.fillStyle = palette.land;
      ctx.fill();
      ctx.clip();
      drawSatelliteBiomeShading(ctx, projection, baseScale * safeZoom * 2.2, theme);
      ctx.restore();

      // Country borders + crisp white outlines on visited countries
      const hotCountries: CountryShape[] = [];
      countries.forEach((country) => {
        const isVisited = Boolean(country.code && visitedCodes.has(country.code));
        if (isVisited) hotCountries.push(country);
        ctx.beginPath();
        path(country.feature as never);
        ctx.lineWidth = 0.55;
        ctx.strokeStyle = palette.border;
        ctx.stroke();
      });

      hotCountries.forEach((country) => {
        ctx.save();
        ctx.beginPath();
        path(country.feature as never);
        ctx.fillStyle = palette.landHi;
        ctx.fill();
        ctx.lineWidth = 1.25;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.88)";
        ctx.stroke();
        ctx.restore();
      });

      // Graticule
      ctx.beginPath();
      path(geoGraticule()());
      ctx.strokeStyle = palette.stars ? "rgba(255,255,255,0.08)" : "rgba(30,40,50,0.09)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Sphere outer border rim
      ctx.beginPath();
      path({ type: "Sphere" } as never);
      ctx.strokeStyle = palette.stars ? "rgba(148, 163, 184, 0.32)" : "rgba(71, 85, 105, 0.35)";
      ctx.lineWidth = 1.4;
      ctx.stroke();

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
      });
    };

    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [countries, stops, validStops, legs, theme, color, zoom, pan, selectedStopId, hoveredStopId, clampPan]);

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
  }, [selectedStop, zoom, pan, countries]);

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
      const next = Math.max(0.85, Math.min(5.5, Number((prev * factor).toFixed(2))));
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

        // Otherwise pan the map smoothly
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
            title="Click anywhere on the globe to drop a new stop, or drag to pan"
          >
            <span>＋</span> Click to add stop
          </button>
          <button
            type="button"
            className={clickMode === "pan" ? "active" : ""}
            onClick={() => setClickMode("pan")}
            title="Pan and inspect pins without adding new stops on click"
          >
            <span>✋</span> Pan / Select only
          </button>
        </div>
        <div className="map-stats-pill">
          <span>{stops.length} {stops.length === 1 ? "place" : "places"}</span>
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
                  left: `${Math.max(140, Math.min((wrapRef.current?.clientWidth || 600) - 140, selectedPinPosition.x))}px`,
                  top: `${Math.max(72, selectedPinPosition.y - 52)}px`,
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
