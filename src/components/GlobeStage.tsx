"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { buildPaths } from "@/lib/geo";
import { startMusic } from "@/lib/music";
import { animationDuration, drawFrame } from "@/lib/render";
import { frameSize, legAllowed, presentStyle, type Project } from "@/lib/types";
import { loadCountries, type CountryShape } from "@/lib/world";

export type GlobeHandle = {
  play: () => void;
  pause: () => void;
  record: () => Promise<Blob>;
};

type PlayMode = "auto" | "loop" | "manual" | "freeze-end";

type Props = {
  project: Project;
  play?: PlayMode;
  pro?: boolean;
  size?: { w: number; h: number };
  className?: string;
  onTime?: (time: number, total: number) => void;
  onEnded?: () => void;
};

export const GlobeStage = forwardRef<GlobeHandle, Props>(function GlobeStage(
  { project, play = "manual", pro = true, size, className, onTime, onEnded },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [countries, setCountries] = useState<CountryShape[] | null>(null);
  const [paths, setPaths] = useState<[number, number][][]>([]);
  const [images, setImages] = useState<Record<string, HTMLImageElement[]>>({});
  const [ready, setReady] = useState(false);
  const playing = useRef(false);
  const elapsed = useRef(0);
  const started = useRef<number | null>(null);
  const raf = useRef(0);
  const playId = useRef(0);
  const onEndedRef = useRef(onEnded);
  const onTimeRef = useRef(onTime);
  const recording = useRef(false);
  if (!recording.current) onEndedRef.current = onEnded;
  onTimeRef.current = onTime;

  const shown = useMemo(() => {
    const style = presentStyle(project.style, pro);
    const legs = project.legs.map((leg) => ({
      transport: legAllowed(leg.transport, pro) ? leg.transport : ("plane" as const),
    }));
    return { ...project, style, legs };
  }, [project, pro]);

  const signature = `${shown.stops.map((stop) => `${stop.lat.toFixed(3)},${stop.lon.toFixed(3)}`).join("|")}::${shown.legs
    .map((leg) => leg.transport)
    .join(",")}`;
  const photoKey = shown.stops.map((stop) => stop.photos.join("~")).join("|");
  const pixels = size ?? frameSize(shown.style, pro);
  const duration = animationDuration(shown, paths);

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
    let cancel = false;
    setReady(false);
    buildPaths(
      shown.stops,
      shown.legs.map((leg) => leg.transport),
      pro
    ).then((next) => {
      if (cancel) return;
      setPaths(next);
      setReady(true);
    });
    return () => {
      cancel = true;
    };
    // signature already covers coordinates and transport
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, pro]);

  useEffect(() => {
    let cancel = false;
    const next: Record<string, HTMLImageElement[]> = {};
    const tasks: Promise<void>[] = [];
    shown.stops.forEach((stop) => {
      next[stop.id] = [];
      stop.photos.forEach((src) => {
        tasks.push(
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              next[stop.id].push(img);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = src;
          })
        );
      });
    });
    Promise.all(tasks).then(() => {
      if (!cancel) setImages({ ...next });
    });
    return () => {
      cancel = true;
    };
  }, [photoKey, shown.stops]);

  const paint = (time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !countries) return;
    drawFrame(ctx, countries, shown, paths, images, time);
    onTimeRef.current?.(Math.min(time, duration), duration);
  };

  const step = (id: number) => (now: number) => {
    if (playId.current !== id || !playing.current) return;
    if (started.current == null) started.current = now - elapsed.current * 1000;
    const time = (now - started.current) / 1000;
    elapsed.current = time;
    paint(time);
    if (time < duration) {
      raf.current = requestAnimationFrame(step(id));
      return;
    }
    playing.current = false;
    if (play === "loop") {
      elapsed.current = 0;
      started.current = null;
      playing.current = true;
      raf.current = requestAnimationFrame(step(id));
      return;
    }
    onEndedRef.current?.();
  };

  const playNow = () => {
    const id = ++playId.current;
    cancelAnimationFrame(raf.current);
    elapsed.current = 0;
    started.current = null;
    playing.current = true;
    raf.current = requestAnimationFrame(step(id));
  };

  const pause = () => {
    playing.current = false;
    cancelAnimationFrame(raf.current);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = pixels.w;
    canvas.height = pixels.h;
  }, [pixels.w, pixels.h]);

  const styleKey = JSON.stringify(shown.style);

  useEffect(() => {
    if (recording.current) return;
    cancelAnimationFrame(raf.current);
    playing.current = false;
    if (!ready || !countries) return;
    if (play === "freeze-end") {
      paint(Math.max(0, duration - 0.05));
      return;
    }
    if (play === "auto" || play === "loop") {
      const id = ++playId.current;
      elapsed.current = 0;
      started.current = null;
      playing.current = true;
      raf.current = requestAnimationFrame(step(id));
    } else {
      paint(0);
    }
    return () => {
      if (recording.current) return;
      playing.current = false;
      cancelAnimationFrame(raf.current);
    };
    // Restart only when the route, frame, or look changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, countries, play, signature, pixels.w, pixels.h, photoKey, styleKey]);

  useImperativeHandle(ref, () => ({
    play: playNow,
    pause,
    record: async () => {
      const canvas = canvasRef.current;
      if (!canvas || !countries) throw new Error("Canvas is not ready");
      await document.fonts.ready;
      const id = ++playId.current;
      cancelAnimationFrame(raf.current);
      playing.current = false;
      recording.current = true;
      const total = Math.max(animationDuration(shown, paths), 0.4);
      const fps = shown.style.fps;
      const stream = canvas.captureStream(fps);
      const music = shown.style.music === "none" ? null : await startMusic(shown.style.music);
      music?.dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
      const mimeType = candidates.find((item) => MediaRecorder.isTypeSupported(item)) ?? "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 7_000_000 } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      const done = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType || "video/webm" }));
      });
      recorder.start(200);
      const startedAt = performance.now();
      await new Promise<void>((resolve) => {
        const tick = (now: number) => {
          if (playId.current !== id) return resolve();
          const time = (now - startedAt) / 1000;
          paint(Math.min(time, total));
          if (time < total) {
            raf.current = requestAnimationFrame(tick);
            return;
          }
          resolve();
        };
        raf.current = requestAnimationFrame(tick);
      });
      await new Promise((resolve) => setTimeout(resolve, 180));
      if (recorder.state === "recording") recorder.stop();
      const blob = await Promise.race([
        done,
        new Promise<Blob>((resolve) =>
          setTimeout(() => resolve(new Blob(chunks, { type: mimeType || "video/webm" })), 1200)
        ),
      ]);
      music?.stop();
      stream.getTracks().forEach((track) => track.stop());
      recording.current = false;
      return blob;
    },
  }));

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return (
    <div className={className ? `stage-wrap ${className}` : "stage-wrap"}>
      <canvas ref={canvasRef} className="stage-canvas" />
      {!ready ? <div className="stage-wait">Tracing the route…</div> : null}
    </div>
  );
});
