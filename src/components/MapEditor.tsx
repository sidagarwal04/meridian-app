"use client";

import { geoGraticule, geoNaturalEarth1, geoPath, type GeoProjection } from "d3-geo";
import { useEffect, useRef, useState } from "react";
import { THEMES, type Stop, type ThemeId } from "@/lib/types";
import { loadCountries, type CountryShape } from "@/lib/world";

export function MapEditor({
  stops,
  theme,
  color,
  onPick,
}: {
  stops: Stop[];
  theme: ThemeId;
  color: string;
  onPick: (lat: number, lon: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const projectionRef = useRef<GeoProjection | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const [countries, setCountries] = useState<CountryShape[] | null>(null);

  useEffect(() => {
    let cancel = false;
    loadCountries().then((data) => {
      if (!cancel) setCountries(data);
    });
    return () => {
      cancel = true;
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
      try {
      const palette = THEMES[theme];
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, width, height);

      const projection = geoNaturalEarth1().translate([width / 2, height / 2]);
      if (!stops.length) {
        projection.scale(Math.min(width, height) / 6.2);
      } else {
        const lons = stops.map((stop) => stop.lon);
        const lats = stops.map((stop) => stop.lat);
        const lon = (Math.min(...lons) + Math.max(...lons)) / 2;
        const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
        const span = Math.max(Math.max(...lons) - Math.min(...lons), Math.max(...lats) - Math.min(...lats), 18);
        projection.center([lon, lat]).scale(Math.min(width, height) / (span / 16 + 1.4));
      }
      projectionRef.current = projection;
      const path = geoPath(projection, ctx);

      ctx.beginPath();
      path({ type: "Sphere" } as never);
      ctx.fillStyle = palette.ocean;
      ctx.fill();

      countries.forEach((country) => {
        ctx.beginPath();
        path(country.feature as never);
        ctx.fillStyle = palette.land;
        ctx.fill();
        ctx.lineWidth = 0.6;
        ctx.strokeStyle = palette.border;
        ctx.stroke();
      });

      ctx.beginPath();
      path(geoGraticule()());
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      if (stops.length > 1) {
        ctx.beginPath();
        path({
          type: "LineString",
          coordinates: stops.map((stop) => [stop.lon, stop.lat]),
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      stops.forEach((stop, index) => {
        const xy = projection([stop.lon, stop.lat]);
        if (!xy) return;
        ctx.beginPath();
        ctx.arc(xy[0], xy[1], 11, 0, Math.PI * 2);
        ctx.fillStyle = "#1a73e8";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = "700 12px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(index + 1), xy[0], xy[1] + 0.5);
      });
      } catch (error) {
        ctx.fillStyle = "#ffb4b4";
        ctx.font = "16px sans-serif";
        ctx.fillText(error instanceof Error ? error.message : "Map failed", 24, 40);
      }
    };

    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [countries, stops, theme, color]);

  return (
    <div
      ref={wrapRef}
      className="map-editor"
      onClick={(event) => {
        const canvas = canvasRef.current;
        const projection = projectionRef.current;
        if (!canvas || !projection?.invert) return;
        const rect = canvas.getBoundingClientRect();
        const coord = projection.invert([event.clientX - rect.left, event.clientY - rect.top]);
        if (!coord || !Number.isFinite(coord[0]) || !Number.isFinite(coord[1])) return;
        onPick(coord[1], coord[0]);
      }}
    >
      <canvas ref={canvasRef} className="editor-canvas" />
    </div>
  );
}
