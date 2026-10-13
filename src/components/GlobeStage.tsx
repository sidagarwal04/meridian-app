"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { buildPaths } from "@/lib/geo";
import { createAudioSession, type AudioSession } from "@/lib/music";
import { animationDuration, buildSegs, drawFrame } from "@/lib/render";
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
  enableAudio?: boolean;
  size?: { w: number; h: number };
  className?: string;
  onTime?: (time: number, total: number) => void;
  onEnded?: () => void;
};

export const GlobeStage = forwardRef<GlobeHandle, Props>(function GlobeStage(
  { project, play = "manual", pro = true, enableAudio = false, size, className, onTime, onEnded },
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

  const liveAudioRef = useRef<AudioSession | null>(null);
  const lastSegKeyRef = useRef<string>("");

  const stopLiveAudio = () => {
    liveAudioRef.current?.stop();
    liveAudioRef.current = null;
    lastSegKeyRef.current = "";
  };

  const syncAudioAtTime = (session: AudioSession | null, time: number) => {
    if (!session || !shown.stops.length) return;
    const { segs, total } = buildSegs(shown, paths);
    const t = Math.max(0, Math.min(time, Math.max(total - 0.001, 0)));
    const seg = segs.find((item) => t < item.start + item.dur) ?? segs[segs.length - 1];
    if (!seg) return;
    const key = `${seg.type}:${seg.index}`;
    if (key === lastSegKeyRef.current) return;
    const prevKey = lastSegKeyRef.current;
    lastSegKeyRef.current = key;
    if (seg.type === "leg") {
      const transport = shown.legs[seg.index]?.transport ?? "plane";
      const remaining = Math.max(0.4, seg.dur - (t - seg.start));
      session.triggerLeg(transport, remaining);
    } else if (seg.type === "dwell" && seg.index > 0 && prevKey.startsWith("leg:")) {
      session.triggerArrival();
    } else {
      session.stopLeg();
    }
  };

  const paint = (time: number, audioSession: AudioSession | null = liveAudioRef.current) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !countries) return;
    drawFrame(ctx, countries, shown, paths, images, time);
    if (playing.current || recording.current) {
      syncAudioAtTime(audioSession, time);
    }
    onTimeRef.current?.(Math.min(time, duration), duration);
  };

  const startLiveAudioIfEnabled = () => {
    stopLiveAudio();
    if (!enableAudio) return;
    createAudioSession({
      music: shown.style.music,
      soundEffects: shown.style.soundEffects ?? true,
    }).then((session) => {
      if (!playing.current || recording.current) {
        session?.stop();
        return;
      }
      liveAudioRef.current = session;
      syncAudioAtTime(session, elapsed.current);
    });
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
      lastSegKeyRef.current = "";
      elapsed.current = 0;
      started.current = null;
      playing.current = true;
      raf.current = requestAnimationFrame(step(id));
      return;
    }
    stopLiveAudio();
    onEndedRef.current?.();
  };

  const playNow = () => {
    const id = ++playId.current;
    cancelAnimationFrame(raf.current);
    elapsed.current = 0;
    started.current = null;
    playing.current = true;
    startLiveAudioIfEnabled();
    raf.current = requestAnimationFrame(step(id));
  };

  const pause = () => {
    playing.current = false;
    cancelAnimationFrame(raf.current);
    stopLiveAudio();
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
    stopLiveAudio();
    if (!ready || !countries) return;
    if (play === "freeze-end") {
      paint(Math.max(0, duration - 0.05), null);
      return;
    }
    if (play === "auto" || play === "loop") {
      const id = ++playId.current;
      elapsed.current = 0;
      started.current = null;
      playing.current = true;
      startLiveAudioIfEnabled();
      raf.current = requestAnimationFrame(step(id));
    } else {
      paint(0, null);
    }
    return () => {
      if (recording.current) return;
      playing.current = false;
      cancelAnimationFrame(raf.current);
      stopLiveAudio();
    };
    // Restart only when the route, frame, or look changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, countries, play, enableAudio, signature, pixels.w, pixels.h, photoKey, styleKey]);

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
      stopLiveAudio();
      recording.current = true;
      const total = Math.max(animationDuration(shown, paths), 0.4);
      const fps = shown.style.fps;
      const stream = canvas.captureStream(fps);
      const audioSession = await createAudioSession({
        music: shown.style.music,
        soundEffects: shown.style.soundEffects ?? true,
      });
      audioSession?.dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
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
      lastSegKeyRef.current = "";
      const startedAt = performance.now();
      await new Promise<void>((resolve) => {
        const tick = (now: number) => {
          if (playId.current !== id) return resolve();
          const time = (now - startedAt) / 1000;
          paint(Math.min(time, total), audioSession);
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
      audioSession?.stop();
      lastSegKeyRef.current = "";
      stream.getTracks().forEach((track) => track.stop());
      recording.current = false;
      return blob;
    },
  }));

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      stopLiveAudio();
    },
    []
  );

  return (
    <div className={className ? `stage-wrap ${className}` : "stage-wrap"}>
      <canvas ref={canvasRef} className="stage-canvas" />
      {!ready ? <div className="stage-wait">Tracing the route…</div> : null}
    </div>
  );
});
