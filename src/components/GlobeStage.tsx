"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { buildPaths } from "@/lib/geo";
import { createAudioSession, unlockAudio, type AudioSession } from "@/lib/music";
import { animationDuration, buildSegs, drawFrame } from "@/lib/render";
import { frameSize, legAllowed, presentStyle, type ExportFormat, type Project } from "@/lib/types";
import { loadCountries, type CountryShape } from "@/lib/world";

export type GlobeHandle = {
  play: () => void;
  pause: () => void;
  record: (format?: ExportFormat) => Promise<Blob>;
};

type PlayMode = "auto" | "loop" | "manual" | "freeze-end" | "idle";

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
  const [pathsReady, setPathsReady] = useState(false);
  const [imagesReady, setImagesReady] = useState(false);

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
  const photoKey = shown.stops.map((stop) => `${stop.id}:${stop.photos.length}:${stop.photos.map((p) => p.slice(-24)).join(",")}`).join("|");
  const pixels = size ?? frameSize(shown.style, pro);
  const duration = animationDuration(shown, paths);
  const ready = pathsReady && imagesReady;

  // Live refs so requestAnimationFrame and audio callbacks never read stale closures
  const shownRef = useRef(shown);
  const pathsRef = useRef(paths);
  const countriesRef = useRef(countries);
  const imagesRef = useRef(images);
  const durationRef = useRef(duration);
  const playModeRef = useRef(play);
  const enableAudioRef = useRef(enableAudio);

  shownRef.current = shown;
  pathsRef.current = paths;
  countriesRef.current = countries;
  imagesRef.current = images;
  durationRef.current = duration;
  playModeRef.current = play;
  enableAudioRef.current = enableAudio;

  useEffect(() => {
    let cancel = false;
    loadCountries().then((data) => {
      if (!cancel) {
        countriesRef.current = data;
        setCountries(data);
      }
    });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    let cancel = false;
    setPathsReady(false);
    buildPaths(
      shown.stops,
      shown.legs.map((leg) => leg.transport),
      pro
    ).then((next) => {
      if (cancel) return;
      pathsRef.current = next;
      setPaths(next);
      setPathsReady(true);
    });
    return () => {
      cancel = true;
    };
    // signature already covers coordinates and transport
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, pro]);

  useEffect(() => {
    let cancel = false;
    const totalPhotos = shown.stops.reduce((sum, s) => sum + (s.photos?.length || 0), 0);
    if (totalPhotos === 0) {
      imagesRef.current = {};
      setImages({});
      setImagesReady(true);
      return;
    }

    setImagesReady(false);
    const next: Record<string, HTMLImageElement[]> = {};
    const tasks: Promise<void>[] = [];

    shown.stops.forEach((stop) => {
      const stopPhotos = stop.photos ?? [];
      const loadedForStop: (HTMLImageElement | null)[] = new Array(stopPhotos.length).fill(null);
      next[stop.id] = [];

      stopPhotos.forEach((src, idx) => {
        if (!src) return;
        tasks.push(
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              loadedForStop[idx] = img;
              next[stop.id] = loadedForStop.filter((item): item is HTMLImageElement => item !== null);
              imagesRef.current = { ...imagesRef.current, [stop.id]: next[stop.id] };
              resolve();
            };
            img.onerror = () => resolve();
            img.src = src;
          })
        );
      });
    });

    Promise.all(tasks).then(() => {
      if (cancel) return;
      imagesRef.current = { ...next };
      setImages({ ...next });
      setImagesReady(true);
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
    const curShown = shownRef.current;
    const curPaths = pathsRef.current;
    if (!session || !curShown.stops.length) return;
    const { segs, total } = buildSegs(curShown, curPaths);
    const t = Math.max(0, Math.min(time, Math.max(total - 0.001, 0)));
    const seg = segs.find((item) => t < item.start + item.dur) ?? segs[segs.length - 1];
    if (!seg) return;
    const key = `${seg.type}:${seg.index}`;
    if (key === lastSegKeyRef.current) return;
    lastSegKeyRef.current = key;
    const remaining = Math.max(0.4, seg.dur - (t - seg.start));

    if (seg.type === "intro") {
      session.triggerIntro(remaining);
    } else if (seg.type === "leg") {
      const transport = curShown.legs[seg.index]?.transport ?? "plane";
      session.triggerLeg(transport, remaining);
    } else if (seg.type === "dwell") {
      const stop = curShown.stops[seg.index];
      const hasPhotos = Boolean(stop && stop.photos && stop.photos.length > 0);
      session.triggerArrival(hasPhotos);
    } else {
      session.stopLeg();
    }
  };

  const paint = (time: number, audioSession: AudioSession | null = liveAudioRef.current) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const curCountries = countriesRef.current;
    const curShown = shownRef.current;
    const curPaths = pathsRef.current;
    const curImages = imagesRef.current;
    const curDuration = durationRef.current;
    if (!canvas || !ctx || !curCountries) return;
    drawFrame(ctx, curCountries, curShown, curPaths, curImages, time);
    if (playing.current || recording.current) {
      syncAudioAtTime(audioSession, time);
    }
    onTimeRef.current?.(Math.min(time, curDuration), curDuration);
  };

  const startLiveAudioIfEnabled = () => {
    stopLiveAudio();
    if (!enableAudioRef.current) return;
    unlockAudio();
    const curShown = shownRef.current;
    createAudioSession({
      music: curShown.style.music,
      soundEffects: curShown.style.soundEffects ?? true,
    }).then((session) => {
      if (!playing.current || recording.current || !enableAudioRef.current) {
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
    const curDuration = durationRef.current;
    paint(time);
    if (time < curDuration) {
      raf.current = requestAnimationFrame(step(id));
      return;
    }
    playing.current = false;
    if (playModeRef.current === "loop") {
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
    unlockAudio();
    const id = ++playId.current;
    cancelAnimationFrame(raf.current);
    lastSegKeyRef.current = "";
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
      lastSegKeyRef.current = "";
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
    record: async (requestedFormat?: ExportFormat) => {
      const canvas = canvasRef.current;
      if (!canvas || !countriesRef.current) throw new Error("Canvas is not ready");
      unlockAudio();
      await document.fonts.ready;
      const id = ++playId.current;
      cancelAnimationFrame(raf.current);
      playing.current = false;
      stopLiveAudio();
      recording.current = true;
      const curShown = shownRef.current;
      const curPaths = pathsRef.current;
      const format: ExportFormat = requestedFormat ?? curShown.style.format ?? "mp4";
      const total = Math.max(animationDuration(curShown, curPaths), 0.4);

      if (format === "gif") {
        try {
          const gifFps = 10;
          const maxSide = 480;
          const scale = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
          const gw = Math.max(2, Math.round(canvas.width * scale));
          const gh = Math.max(2, Math.round(canvas.height * scale));
          const scratch = document.createElement("canvas");
          scratch.width = gw;
          scratch.height = gh;
          const sctx = scratch.getContext("2d", { willReadFrequently: true });
          if (!sctx) throw new Error("Scratch canvas unavailable");

          const frameCount = Math.max(2, Math.min(180, Math.ceil(total * gifFps)));
          const delayCs = Math.max(2, Math.round(100 / gifFps));
          const frames: Uint8Array[] = [];

          for (let i = 0; i < frameCount; i++) {
            if (playId.current !== id) break;
            const t = (i / Math.max(1, frameCount - 1)) * total;
            paint(t, null);
            sctx.drawImage(canvas, 0, 0, gw, gh);
            const rgba = sctx.getImageData(0, 0, gw, gh).data;
            const indexed = new Uint8Array(gw * gh);
            for (let p = 0, j = 0; p < rgba.length; p += 4, j++) {
              const r = rgba[p] >> 5;
              const g = rgba[p + 1] >> 5;
              const b = rgba[p + 2] >> 6;
              indexed[j] = (r << 5) | (g << 2) | b;
            }
            frames.push(indexed);
            await new Promise((r) => setTimeout(r, 0));
          }
          return encodeGif89a(gw, gh, frames, delayCs);
        } finally {
          recording.current = false;
        }
      }

      const fps = curShown.style.fps;
      const stream = canvas.captureStream(fps);
      const audioSession = await createAudioSession({
        music: curShown.style.music,
        soundEffects: curShown.style.soundEffects ?? true,
      });
      audioSession?.dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      const candidates =
        format === "mp4" || format === "mov"
          ? [
              "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
              "video/mp4;codecs=avc1,mp4a.40.2",
              "video/mp4;codecs=avc1,opus",
              "video/mp4;codecs=h264,aac",
              "video/mp4;codecs=h264",
              "video/mp4;codecs=avc1",
              "video/mp4",
              "video/webm;codecs=h264,opus",
              "video/webm;codecs=vp9,opus",
              "video/webm",
            ]
          : format === "mkv"
          ? [
              "video/x-matroska;codecs=avc1,opus",
              "video/x-matroska",
              "video/webm;codecs=vp9,opus",
              "video/webm;codecs=vp8,opus",
              "video/webm",
            ]
          : [
              "video/webm;codecs=vp9,opus",
              "video/webm;codecs=vp8,opus",
              "video/webm",
              "video/mp4",
            ];
      const mimeType = candidates.find((item) => MediaRecorder.isTypeSupported(item)) ?? "";
      const outputMime =
        format === "mp4"
          ? "video/mp4"
          : format === "mov"
          ? "video/quicktime"
          : format === "mkv"
          ? "video/x-matroska"
          : mimeType || "video/webm";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 7_000_000 } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      const done = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: outputMime }));
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
          setTimeout(() => resolve(new Blob(chunks, { type: outputMime })), 1200)
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

function encodeGif89a(width: number, height: number, frames: Uint8Array[], delayCs: number): Blob {
  const bytes: number[] = [];
  const push16 = (val: number) => {
    bytes.push(val & 0xff, (val >> 8) & 0xff);
  };

  // Header "GIF89a"
  bytes.push(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);
  // Logical Screen Descriptor (Global Color Table 256 colors: 0xF7)
  push16(width);
  push16(height);
  bytes.push(0xf7, 0x00, 0x00);

  // Global Color Table (RGB 3-3-2)
  for (let i = 0; i < 256; i++) {
    const r = Math.round((((i >> 5) & 7) * 255) / 7);
    const g = Math.round((((i >> 2) & 7) * 255) / 7);
    const b = Math.round(((i & 3) * 255) / 3);
    bytes.push(r, g, b);
  }

  // Netscape 2.0 Application Extension for infinite looping
  bytes.push(0x21, 0xff, 0x0b, 0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30, 0x03, 0x01, 0x00, 0x00, 0x00);

  for (const frame of frames) {
    // Graphic Control Extension
    bytes.push(0x21, 0xf9, 0x04, 0x00);
    push16(delayCs);
    bytes.push(0x00, 0x00);

    // Image Descriptor
    bytes.push(0x2c, 0x00, 0x00, 0x00, 0x00);
    push16(width);
    push16(height);
    bytes.push(0x00);

    // LZW Minimum Code Size = 8
    bytes.push(8);

    const stream: number[] = [];
    let bitBuf = 0;
    let bitCount = 0;
    const emit9 = (code: number) => {
      bitBuf |= code << bitCount;
      bitCount += 9;
      while (bitCount >= 8) {
        stream.push(bitBuf & 0xff);
        bitBuf >>= 8;
        bitCount -= 8;
      }
    };

    emit9(256); // Clear code
    let countSinceClear = 0;
    for (let i = 0; i < frame.length; i++) {
      emit9(frame[i]);
      countSinceClear++;
      if (countSinceClear >= 250) {
        emit9(256);
        countSinceClear = 0;
      }
    }
    emit9(257); // EOI code
    if (bitCount > 0) {
      stream.push(bitBuf & 0xff);
    }

    for (let offset = 0; offset < stream.length; offset += 255) {
      const len = Math.min(255, stream.length - offset);
      bytes.push(len);
      for (let k = 0; k < len; k++) {
        bytes.push(stream[offset + k]);
      }
    }
    bytes.push(0x00); // Block terminator
  }

  bytes.push(0x3b); // Trailer
  return new Blob([new Uint8Array(bytes)], { type: "image/gif" });
}
