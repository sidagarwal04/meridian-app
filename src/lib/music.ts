import type { MusicId, Transport } from "./types";

export const TRACKS: { id: MusicId; label: string; icon: string; bpm: string; blurb: string }[] = [
  {
    id: "ambient",
    label: "Sunlit Horizon (Default)",
    icon: "☀️",
    bpm: "118 BPM",
    blurb: "Upbeat indie-pop travel groove with punchy drums, warm bass & bright synth plucks",
  },
  {
    id: "tropical",
    label: "Tropical Island Hop",
    icon: "🏝️",
    bpm: "116 BPM",
    blurb: "Bouncy marimba & steel-drum island melody with a sunny four-on-the-floor beat",
  },
  {
    id: "funk",
    label: "Disco Funk Strut",
    icon: "🕺",
    bpm: "120 BPM",
    blurb: "Groovy slap-bassline, crisp handclaps & brassy funk stabs for high-energy reels",
  },
  {
    id: "synthwave",
    label: "Turbo Neon Rush",
    icon: "🏎️",
    bpm: "126 BPM",
    blurb: "Driving 80s synthwave arpeggios, gated snare & pumping octave bass",
  },
  {
    id: "arcade",
    label: "8-Bit World Tour",
    icon: "🕹️",
    bpm: "136 BPM",
    blurb: "Hyper-fun retro video-game chiptune lead with fast arcade coins & drums",
  },
  {
    id: "folk",
    label: "Whistling Roadtrip",
    icon: "🚐",
    bpm: "114 BPM",
    blurb: "Feel-good acoustic strum, upbeat tambourine & a catchy whistled hook",
  },
  {
    id: "lofi",
    label: "Passport Stamp Groove",
    icon: "🧋",
    bpm: "94 BPM",
    blurb: "Bouncy hip-hop boom-bap beat, warm Rhodes keys & jazzy vlog melody",
  },
  {
    id: "cinematic",
    label: "Odyssey Blockbuster",
    icon: "🥁",
    bpm: "112 BPM",
    blurb: "Epic stadium adventure drums, heroic brass anthem & soaring strings",
  },
  {
    id: "none",
    label: "No background music",
    icon: "🔇",
    bpm: "SFX Only",
    blurb: "Only transport sound effects (or silent export if SFX is turned off)",
  },
];

type Handle = { stop: () => void; dest: MediaStreamAudioDestinationNode };

export type AudioSession = {
  dest: MediaStreamAudioDestinationNode;
  triggerIntro: (durationSec?: number) => void;
  triggerLeg: (transport: Transport, durationSec?: number) => void;
  triggerArrival: (hasPhotos?: boolean) => void;
  stopLeg: () => void;
  stop: () => void;
};

let shared: AudioContext | null = null;
let noiseBufferCache: AudioBuffer | null = null;
let pinkNoiseBufferCache: AudioBuffer | null = null;
let dotLoopBufferCache: AudioBuffer | null = null;
let trainLoopBufferCache: AudioBuffer | null = null;
let bikeLoopBufferCache: AudioBuffer | null = null;
let walkLoopBufferCache: AudioBuffer | null = null;
const grooveBufferCache = new Map<string, AudioBuffer>();
const grooveRenderPromises = new Map<string, Promise<AudioBuffer | null>>();
let activePreviewStop: (() => void) | null = null;
let unlockBound = false;

function ctx() {
  if (!shared) {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    try {
      // "playback" latencyHint allocates a larger hardware buffer on mobile browsers,
      // preventing audio underruns/stuttering while the 3D WebGL/2D canvas renders at 60fps.
      shared = new AudioCtx({ latencyHint: "playback" });
    } catch {
      shared = new AudioCtx();
    }
  }
  if (!unlockBound && typeof window !== "undefined") {
    unlockBound = true;
    const resumeOnGesture = () => {
      if (shared && shared.state === "suspended") {
        shared.resume().catch(() => {});
      }
    };
    window.addEventListener("pointerdown", resumeOnGesture, { passive: true });
    window.addEventListener("touchstart", resumeOnGesture, { passive: true });
    window.addEventListener("touchend", resumeOnGesture, { passive: true });
    window.addEventListener("click", resumeOnGesture, { passive: true });
    window.addEventListener("keydown", resumeOnGesture, { passive: true });
  }
  return shared;
}

/**
 * Call synchronously inside user click handlers (Preview, Export, 3D Globe, etc.)
 * so browser autoplay policies unlock the shared AudioContext immediately.
 */
export function unlockAudio() {
  if (typeof window === "undefined") return;
  try {
    const audio = ctx();
    if (audio.state === "suspended") {
      audio.resume().catch(() => {});
    }
    // Pre-warm default background soundtrack buffer off-thread so playback starts with zero lag
    void getOrRenderGrooveBuffer(audio, "ambient");
  } catch {
    /* ignore */
  }
}

function getWhiteNoiseBuffer(audio: BaseAudioContext): AudioBuffer {
  if (noiseBufferCache && noiseBufferCache.sampleRate === audio.sampleRate) {
    return noiseBufferCache;
  }
  const length = audio.sampleRate * 4;
  const buf = audio.createBuffer(1, length, audio.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBufferCache = buf;
  return buf;
}

function getPinkNoiseBuffer(audio: BaseAudioContext): AudioBuffer {
  if (pinkNoiseBufferCache && pinkNoiseBufferCache.sampleRate === audio.sampleRate) {
    return pinkNoiseBufferCache;
  }
  const length = audio.sampleRate * 4;
  const buf = audio.createBuffer(1, length, audio.sampleRate);
  const data = buf.getChannelData(0);
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.045;
    b6 = white * 0.115926;
  }
  pinkNoiseBufferCache = buf;
  return buf;
}

function getDotPopLoopBuffer(audio: BaseAudioContext): AudioBuffer {
  if (dotLoopBufferCache && dotLoopBufferCache.sampleRate === audio.sampleRate) {
    return dotLoopBufferCache;
  }
  const sr = audio.sampleRate;
  const stepInterval = 0.13;
  const loopDur = stepInterval * 4;
  const len = Math.round(sr * loopDur);
  const buf = audio.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  for (let step = 0; step < 4; step++) {
    const startSample = Math.round(step * stepInterval * sr);
    const popSamples = Math.round(0.062 * sr);
    const f0 = 580 + step * 75;
    const f1 = f0 * 0.48;
    let phase = 0;
    for (let i = 0; i < popSamples && startSample + i < len; i++) {
      const u = i / popSamples;
      const freq = f0 * Math.pow(f1 / f0, u);
      phase += (2 * Math.PI * freq) / sr;
      const env = u < 0.13 ? (u / 0.13) * 0.075 : 0.075 * Math.pow(0.01, (u - 0.13) / 0.87);
      data[startSample + i] += Math.sin(phase) * env;
    }
  }
  dotLoopBufferCache = buf;
  return buf;
}

function getTrainClackLoopBuffer(audio: BaseAudioContext): AudioBuffer {
  if (trainLoopBufferCache && trainLoopBufferCache.sampleRate === audio.sampleRate) {
    return trainLoopBufferCache;
  }
  const sr = audio.sampleRate;
  const pairPeriod = 0.34;
  const len = Math.round(sr * pairPeriod);
  const buf = audio.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  const hits = [
    { offset: 0.05, peak: 0.18 },
    { offset: 0.135, peak: 0.14 },
  ];
  for (const hit of hits) {
    const startSample = Math.round(hit.offset * sr);
    const hitSamples = Math.round(0.042 * sr);
    for (let i = 0; i < hitSamples && startSample + i < len; i++) {
      const u = i / hitSamples;
      const env = u < 0.12 ? (u / 0.12) * hit.peak : hit.peak * Math.pow(0.008, (u - 0.12) / 0.88);
      const tone = Math.sin((2 * Math.PI * 980 * i) / sr) * 0.55;
      const noise = (Math.random() * 2 - 1) * 0.45;
      data[startSample + i] += (tone + noise) * env;
    }
  }
  trainLoopBufferCache = buf;
  return buf;
}

function getBikeClickLoopBuffer(audio: BaseAudioContext): AudioBuffer {
  if (bikeLoopBufferCache && bikeLoopBufferCache.sampleRate === audio.sampleRate) {
    return bikeLoopBufferCache;
  }
  const sr = audio.sampleRate;
  const clickPeriod = 0.075;
  const loopDur = clickPeriod * 2;
  const len = Math.round(sr * loopDur);
  const buf = audio.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  for (let c = 0; c < 2; c++) {
    const startSample = Math.round(c * clickPeriod * sr);
    const clickSamples = Math.round(0.016 * sr);
    const freq = 2600 + c * 200;
    for (let i = 0; i < clickSamples && startSample + i < len; i++) {
      const u = i / clickSamples;
      const env = u < 0.15 ? (u / 0.15) * 0.022 : 0.022 * Math.pow(0.02, (u - 0.15) / 0.85);
      data[startSample + i] += Math.sin((2 * Math.PI * freq * i) / sr) * env;
    }
  }
  bikeLoopBufferCache = buf;
  return buf;
}

function getWalkStepLoopBuffer(audio: BaseAudioContext): AudioBuffer {
  if (walkLoopBufferCache && walkLoopBufferCache.sampleRate === audio.sampleRate) {
    return walkLoopBufferCache;
  }
  const sr = audio.sampleRate;
  const stepPeriod = 0.25;
  const loopDur = stepPeriod * 2;
  const len = Math.round(sr * loopDur);
  const buf = audio.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  const pink = getPinkNoiseBuffer(audio).getChannelData(0);
  for (let s = 0; s < 2; s++) {
    const startSample = Math.round((s * stepPeriod + 0.02) * sr);
    const stepSamples = Math.round(0.078 * sr);
    const f0 = s === 0 ? 135 : 122;
    let phase = 0;
    for (let i = 0; i < stepSamples && startSample + i < len; i++) {
      const u = i / stepSamples;
      const freq = f0 * Math.pow(48 / f0, u);
      phase += (2 * Math.PI * freq) / sr;
      const thudEnv = u < 0.12 ? (u / 0.12) * 0.09 : 0.09 * Math.pow(0.01, (u - 0.12) / 0.88);
      const crunchEnv = u > 0.1 ? Math.sin(((u - 0.1) / 0.9) * Math.PI) * 0.18 : 0;
      const pinkSample = pink[(startSample + i) % pink.length];
      data[startSample + i] += Math.sin(phase) * thudEnv + pinkSample * crunchEnv;
    }
  }
  walkLoopBufferCache = buf;
  return buf;
}

function tone(
  audio: AudioContext,
  dest: AudioNode,
  freq: number,
  type: OscillatorType,
  gain: number,
  attack = 0.4,
  when = 0
) {
  const osc = audio.createOscillator();
  const g = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, audio.currentTime + when);
  g.gain.linearRampToValueAtTime(gain, audio.currentTime + when + attack);
  osc.connect(g);
  g.connect(dest);
  osc.start(audio.currentTime + when);
  return { osc, g };
}

/**
 * Synthesizes a realistic, distinct stock sound effect for a specific mode of transport
 * over `durationSec` seconds, connected to `target`.
 */
export function playTransportSoundOnNode(
  audio: AudioContext,
  target: AudioNode,
  transport: Transport,
  durationSec = 2.0
): { stop: () => void } {
  const dur = Math.max(0.65, Math.min(6.0, durationSec));
  const now = audio.currentTime;
  const bus = audio.createGain();
  bus.gain.setValueAtTime(0.0001, now);
  bus.gain.linearRampToValueAtTime(0.85, now + Math.min(0.12, dur * 0.12));
  bus.gain.setValueAtTime(0.85, now + Math.max(0.14, dur - 0.25));
  bus.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  bus.connect(target);

  const sources: AudioScheduledSourceNode[] = [];
  const timers: number[] = [];

  const startNoise = (pink = true) => {
    const src = audio.createBufferSource();
    src.buffer = pink ? getPinkNoiseBuffer(audio) : getWhiteNoiseBuffer(audio);
    src.loop = true;
    src.start(now);
    src.stop(now + dur + 0.05);
    sources.push(src);
    return src;
  };

  const startOsc = (type: OscillatorType, freq: number, startOffset = 0, stopOffset = dur) => {
    const osc = audio.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + startOffset);
    osc.start(now + startOffset);
    osc.stop(now + stopOffset + 0.05);
    sources.push(osc);
    return osc;
  };

  if (transport === "plane") {
    // 1. Jet flyby aerodynamic swoosh (Doppler bandpass sweep)
    const rush = startNoise(true);
    const bp = audio.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.setValueAtTime(1.8, now);
    bp.frequency.setValueAtTime(220, now);
    bp.frequency.exponentialRampToValueAtTime(1350, now + dur * 0.42);
    bp.frequency.exponentialRampToValueAtTime(280, now + dur);
    const rushGain = audio.createGain();
    rushGain.gain.setValueAtTime(0.01, now);
    rushGain.gain.linearRampToValueAtTime(0.55, now + dur * 0.38);
    rushGain.gain.exponentialRampToValueAtTime(0.02, now + dur);
    rush.connect(bp);
    bp.connect(rushGain);
    rushGain.connect(bus);

    // 2. Twin-spool jet turbine whine + warm cabin hum
    const turbine = startOsc("sine", 580);
    turbine.frequency.exponentialRampToValueAtTime(1120, now + dur * 0.45);
    turbine.frequency.exponentialRampToValueAtTime(690, now + dur);
    const turbGain = audio.createGain();
    turbGain.gain.setValueAtTime(0.001, now);
    turbGain.gain.linearRampToValueAtTime(0.028, now + dur * 0.35);
    turbGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    turbine.connect(turbGain);
    turbGain.connect(bus);

    const drone = startOsc("sawtooth", 130);
    drone.frequency.exponentialRampToValueAtTime(175, now + dur * 0.45);
    drone.frequency.exponentialRampToValueAtTime(115, now + dur);
    const lp = audio.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 340;
    const droneGain = audio.createGain();
    droneGain.gain.setValueAtTime(0.045, now);
    drone.connect(lp);
    lp.connect(droneGain);
    droneGain.connect(bus);
  } else if (transport === "line") {
    // Crisp, silky cartographic air swoosh + glassy harmonic shimmer
    const swoosh = startNoise(false);
    const bp = audio.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.setValueAtTime(3.2, now);
    bp.frequency.setValueAtTime(280, now);
    bp.frequency.exponentialRampToValueAtTime(2100, now + dur * 0.36);
    bp.frequency.exponentialRampToValueAtTime(340, now + dur);
    const g = audio.createGain();
    g.gain.setValueAtTime(0.005, now);
    g.gain.linearRampToValueAtTime(0.24, now + dur * 0.34);
    g.gain.exponentialRampToValueAtTime(0.004, now + dur);
    swoosh.connect(bp);
    bp.connect(g);
    g.connect(bus);

    const shimmer = startOsc("sine", 523.25);
    shimmer.frequency.exponentialRampToValueAtTime(783.99, now + dur * 0.5);
    const sg = audio.createGain();
    sg.gain.setValueAtTime(0.001, now);
    sg.gain.linearRampToValueAtTime(0.03, now + 0.08);
    sg.gain.exponentialRampToValueAtTime(0.0005, now + dur * 0.75);
    shimmer.connect(sg);
    sg.connect(bus);
  } else if (transport === "dot") {
    // Soft air swoosh + rhythmic dotted marimba/woodblock pops along the path
    const swoosh = startNoise(true);
    const bp = audio.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 2.0;
    bp.frequency.setValueAtTime(350, now);
    bp.frequency.exponentialRampToValueAtTime(1100, now + dur * 0.5);
    bp.frequency.exponentialRampToValueAtTime(400, now + dur);
    const sg = audio.createGain();
    sg.gain.value = 0.16;
    swoosh.connect(bp);
    bp.connect(sg);
    sg.connect(bus);

    const popLoop = audio.createBufferSource();
    popLoop.buffer = getDotPopLoopBuffer(audio);
    popLoop.loop = true;
    popLoop.start(now);
    popLoop.stop(now + dur + 0.02);
    sources.push(popLoop);
    popLoop.connect(bus);
  } else if (transport === "helicopter") {
    // Rhythmic rotor blade chop-chop-chop (12.5 Hz LFO modulating noise & sub-thump) + turbine
    const rotorNoise = startNoise(true);
    const lp = audio.createBiquadFilter();
    lp.type = "bandpass";
    lp.Q.value = 1.6;
    lp.frequency.setValueAtTime(210, now);
    lp.frequency.linearRampToValueAtTime(310, now + dur * 0.5);
    lp.frequency.linearRampToValueAtTime(220, now + dur);

    const chopGain = audio.createGain();
    chopGain.gain.value = 0.25;

    const lfo = startOsc("sine", 12.5);
    const lfoDepth = audio.createGain();
    lfoDepth.gain.value = 0.24;
    lfo.connect(lfoDepth);
    lfoDepth.connect(chopGain.gain);

    rotorNoise.connect(lp);
    lp.connect(chopGain);
    chopGain.connect(bus);

    // Sub-bass blade thump
    const sub = startOsc("triangle", 62);
    const subGain = audio.createGain();
    subGain.gain.value = 0.065;
    const subLfoDepth = audio.createGain();
    subLfoDepth.gain.value = 0.06;
    lfo.connect(subLfoDepth);
    subLfoDepth.connect(subGain.gain);
    sub.connect(subGain);
    subGain.connect(bus);

    // Light turbine whistle
    const whine = startOsc("sine", 940);
    whine.frequency.linearRampToValueAtTime(1080, now + dur * 0.5);
    const wg = audio.createGain();
    wg.gain.value = 0.014;
    whine.connect(wg);
    wg.connect(bus);
  } else if (transport === "train") {
    // 1. Classic two-tone railway horn chord on departure
    const hornDur = Math.min(0.65, dur * 0.42);
    [311.13, 392.0, 466.16].forEach((freq, idx) => {
      const h = startOsc("sawtooth", freq, 0, hornDur);
      const hFilter = audio.createBiquadFilter();
      hFilter.type = "lowpass";
      hFilter.frequency.value = 1150;
      const hg = audio.createGain();
      const peak = idx === 0 ? 0.042 : 0.032;
      hg.gain.setValueAtTime(0.0005, now);
      hg.gain.linearRampToValueAtTime(peak, now + 0.06);
      hg.gain.setValueAtTime(peak, now + hornDur * 0.68);
      hg.gain.exponentialRampToValueAtTime(0.0005, now + hornDur);
      h.connect(hFilter);
      hFilter.connect(hg);
      hg.connect(bus);
    });

    // 2. Continuous steel-on-rail rolling rumble
    const railNoise = startNoise(true);
    const railLp = audio.createBiquadFilter();
    railLp.type = "lowpass";
    railLp.frequency.value = 380;
    const railGain = audio.createGain();
    railGain.gain.value = 0.22;
    railNoise.connect(railLp);
    railLp.connect(railGain);
    railGain.connect(bus);

    // 3. Rhythmic "clack-clack ... clack-clack" track joint hits (single looped buffer)
    const clackLoop = audio.createBufferSource();
    clackLoop.buffer = getTrainClackLoopBuffer(audio);
    clackLoop.loop = true;
    clackLoop.start(now);
    clackLoop.stop(now + dur + 0.02);
    sources.push(clackLoop);
    clackLoop.connect(bus);
  } else if (transport === "boat") {
    // 1. Deep resonant ship foghorn at departure
    const hornDur = Math.min(0.85, dur * 0.48);
    [87.31, 130.81].forEach((freq, i) => {
      const horn = startOsc("sawtooth", freq, 0, hornDur);
      const lp = audio.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 340;
      const hg = audio.createGain();
      const vol = i === 0 ? 0.075 : 0.045;
      hg.gain.setValueAtTime(0.001, now);
      hg.gain.linearRampToValueAtTime(vol, now + 0.12);
      hg.gain.setValueAtTime(vol, now + hornDur * 0.65);
      hg.gain.exponentialRampToValueAtTime(0.0008, now + hornDur);
      horn.connect(lp);
      lp.connect(hg);
      hg.connect(bus);
    });

    // 2. Ocean water waves & hull splash (undulating filtered pink/white noise)
    const water = startNoise(true);
    const waveFilter = audio.createBiquadFilter();
    waveFilter.type = "bandpass";
    waveFilter.Q.value = 1.2;
    waveFilter.frequency.setValueAtTime(320, now);
    waveFilter.frequency.exponentialRampToValueAtTime(880, now + dur * 0.35);
    waveFilter.frequency.exponentialRampToValueAtTime(380, now + dur * 0.68);
    waveFilter.frequency.exponentialRampToValueAtTime(740, now + dur);

    const waveGain = audio.createGain();
    waveGain.gain.setValueAtTime(0.28, now);
    water.connect(waveFilter);
    waveFilter.connect(waveGain);
    waveGain.connect(bus);

    // Foamy bow splash
    const spray = startNoise(false);
    const hp = audio.createBiquadFilter();
    hp.type = "bandpass";
    hp.Q.value = 1.5;
    hp.frequency.setValueAtTime(1400, now);
    hp.frequency.linearRampToValueAtTime(2200, now + dur * 0.45);
    hp.frequency.linearRampToValueAtTime(1200, now + dur);
    const sprayGain = audio.createGain();
    sprayGain.gain.setValueAtTime(0.045, now);
    spray.connect(hp);
    hp.connect(sprayGain);
    sprayGain.connect(bus);
  } else if (transport === "car") {
    // Smooth automotive acceleration with 1st->2nd gear shift + highway road whoosh
    const eng = startOsc("sawtooth", 85);
    const shiftTime = dur * 0.42;
    eng.frequency.exponentialRampToValueAtTime(165, now + shiftTime);
    eng.frequency.setValueAtTime(118, now + shiftTime + 0.04);
    eng.frequency.exponentialRampToValueAtTime(178, now + dur);

    const lp = audio.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 380;
    const eg = audio.createGain();
    eg.gain.value = 0.055;
    eng.connect(lp);
    lp.connect(eg);
    eg.connect(bus);

    // Road tire & wind whoosh
    const road = startNoise(true);
    const bp = audio.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(300, now);
    bp.frequency.exponentialRampToValueAtTime(780, now + dur * 0.5);
    bp.frequency.exponentialRampToValueAtTime(420, now + dur);
    const rg = audio.createGain();
    rg.gain.value = 0.24;
    road.connect(bp);
    bp.connect(rg);
    rg.connect(bus);
  } else if (transport === "bus") {
    // 1. Pneumatic air-brake release ("pssshh") at start
    const airSrc = audio.createBufferSource();
    airSrc.buffer = getWhiteNoiseBuffer(audio);
    airSrc.start(now);
    airSrc.stop(now + 0.22);
    sources.push(airSrc);
    const hp = audio.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2600;
    const ag = audio.createGain();
    ag.gain.setValueAtTime(0.001, now);
    ag.gain.linearRampToValueAtTime(0.09, now + 0.02);
    ag.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    airSrc.connect(hp);
    hp.connect(ag);
    ag.connect(bus);

    // 2. Heavy coach diesel engine rumble
    const diesel = startOsc("sawtooth", 58);
    diesel.frequency.exponentialRampToValueAtTime(98, now + dur * 0.55);
    diesel.frequency.linearRampToValueAtTime(84, now + dur);
    const dlp = audio.createBiquadFilter();
    dlp.type = "lowpass";
    dlp.frequency.value = 260;
    const dg = audio.createGain();
    dg.gain.value = 0.075;
    diesel.connect(dlp);
    dlp.connect(dg);
    dg.connect(bus);

    const road = startNoise(true);
    const rlp = audio.createBiquadFilter();
    rlp.type = "lowpass";
    rlp.frequency.value = 420;
    const rg = audio.createGain();
    rg.gain.value = 0.18;
    road.connect(rlp);
    rlp.connect(rg);
    rg.connect(bus);
  } else if (transport === "motorcycle") {
    // Throaty twin-cylinder throttle rev & upshift
    const rev1 = startOsc("sawtooth", 105);
    const rev2 = startOsc("square", 52.5);
    const shift = dur * 0.36;
    [
      [rev1, 1],
      [rev2, 0.5],
    ].forEach(([osc, mult]) => {
      const o = osc as OscillatorNode;
      const m = mult as number;
      o.frequency.setValueAtTime(105 * m, now);
      o.frequency.exponentialRampToValueAtTime(245 * m, now + shift);
      o.frequency.setValueAtTime(160 * m, now + shift + 0.035);
      o.frequency.exponentialRampToValueAtTime(265 * m, now + dur);
    });

    const bp = audio.createBiquadFilter();
    bp.type = "lowpass";
    bp.frequency.value = 680;
    const mg = audio.createGain();
    mg.gain.value = 0.048;
    rev1.connect(bp);
    rev2.connect(bp);
    bp.connect(mg);
    mg.connect(bus);
  } else if (transport === "tuktuk") {
    // 1. Cheerful double "beep-beep!" horn at departure
    [0.02, 0.15].forEach((tStart) => {
      if (tStart + 0.09 > dur) return;
      [660, 830].forEach((freq) => {
        const horn = startOsc("sawtooth", freq, tStart, tStart + 0.085);
        const bp = audio.createBiquadFilter();
        bp.type = "bandpass";
        bp.Q.value = 3.5;
        bp.frequency.value = 1100;
        const hg = audio.createGain();
        hg.gain.setValueAtTime(0.001, now + tStart);
        hg.gain.linearRampToValueAtTime(0.045, now + tStart + 0.01);
        hg.gain.exponentialRampToValueAtTime(0.001, now + tStart + 0.08);
        horn.connect(bp);
        bp.connect(hg);
        hg.connect(bus);
      });
    });

    // 2. Rapid 2-stroke "put-put-put-put" motor chug
    const motor = startOsc("sawtooth", 145);
    motor.frequency.linearRampToValueAtTime(205, now + dur * 0.6);
    const mlp = audio.createBiquadFilter();
    mlp.type = "bandpass";
    mlp.Q.value = 2.2;
    mlp.frequency.value = 460;
    const chugGain = audio.createGain();
    chugGain.gain.value = 0.045;

    const lfo = startOsc("square", 16);
    const lfoDepth = audio.createGain();
    lfoDepth.gain.value = 0.038;
    lfo.connect(lfoDepth);
    lfoDepth.connect(chugGain.gain);

    motor.connect(mlp);
    mlp.connect(chugGain);
    chugGain.connect(bus);
  } else if (transport === "camper") {
    // Warm vintage boxer van purr + coastal breeze
    const van1 = startOsc("triangle", 76);
    const van2 = startOsc("sawtooth", 152);
    van1.frequency.linearRampToValueAtTime(96, now + dur * 0.5);
    van2.frequency.linearRampToValueAtTime(192, now + dur * 0.5);
    const lp = audio.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 310;
    const vg = audio.createGain();
    vg.gain.value = 0.055;
    van1.connect(lp);
    van2.connect(lp);
    lp.connect(vg);
    vg.connect(bus);

    const breeze = startNoise(true);
    const bp = audio.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.5;
    bp.frequency.setValueAtTime(340, now);
    bp.frequency.linearRampToValueAtTime(640, now + dur * 0.5);
    bp.frequency.linearRampToValueAtTime(380, now + dur);
    const bg = audio.createGain();
    bg.gain.value = 0.2;
    breeze.connect(bp);
    bp.connect(bg);
    bg.connect(bus);
  } else if (transport === "bike") {
    // 1. Crisp metallic double "ding-ring!" bicycle bell
    [0.01, 0.14].forEach((bellStart, idx) => {
      const bellDur = Math.min(0.65, dur - bellStart);
      if (bellDur <= 0.05) return;
      [1567.98, 3135.96, 4186.01].forEach((freq, pIdx) => {
        const bell = startOsc("sine", freq, bellStart, bellStart + bellDur);
        const bg = audio.createGain();
        const peak = (pIdx === 0 ? 0.065 : pIdx === 1 ? 0.03 : 0.015) * (idx === 1 ? 1.15 : 0.9);
        bg.gain.setValueAtTime(0.0005, now + bellStart);
        bg.gain.linearRampToValueAtTime(peak, now + bellStart + 0.006);
        bg.gain.exponentialRampToValueAtTime(0.0004, now + bellStart + bellDur);
        bell.connect(bg);
        bg.connect(bus);
      });
    });

    // 2. Rapid light freewheel hub ratcheting clicks ("tick-tick-tick") via single looped buffer
    const clickLoop = audio.createBufferSource();
    clickLoop.buffer = getBikeClickLoopBuffer(audio);
    clickLoop.loop = true;
    clickLoop.start(now);
    clickLoop.stop(now + dur + 0.02);
    sources.push(clickLoop);
    clickLoop.connect(bus);
  } else if (transport === "walk") {
    // Rhythmic alternating footsteps on trail + soft outdoor breeze via single looped buffer
    const stepLoop = audio.createBufferSource();
    stepLoop.buffer = getWalkStepLoopBuffer(audio);
    stepLoop.loop = true;
    stepLoop.start(now);
    stepLoop.stop(now + dur + 0.02);
    sources.push(stepLoop);
    stepLoop.connect(bus);
  }

  return {
    stop: () => {
      timers.forEach((timer) => window.clearInterval(timer));
      const t = audio.currentTime;
      try {
        bus.gain.cancelScheduledValues(t);
        bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), t);
        bus.gain.linearRampToValueAtTime(0.0001, t + 0.06);
      } catch {
        /* ignore */
      }
      sources.forEach((src) => {
        try {
          src.stop(t + 0.07);
        } catch {
          /* already stopped */
        }
      });
    },
  };
}

/**
 * Subtle cartographic arrival chime when reaching a waypoint stop,
 * plus a crisp polaroid camera shutter click if the stop has photos.
 */
export function playArrivalChimeOnNode(audio: AudioContext, target: AudioNode, hasPhotos = false) {
  const now = audio.currentTime;
  [587.33, 880].forEach((freq, idx) => {
    const start = now + idx * 0.055;
    const osc = audio.createOscillator();
    const g = audio.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.0005, start);
    g.gain.linearRampToValueAtTime(0.042, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0004, start + 0.36);
    osc.connect(g);
    g.connect(target);
    osc.start(start);
    osc.stop(start + 0.38);
  });

  if (hasPhotos) {
    // Polaroid camera shutter double-click ("kachik!")
    [0.14, 0.20].forEach((offset, idx) => {
      const tClick = now + offset;
      const src = audio.createBufferSource();
      src.buffer = getWhiteNoiseBuffer(audio);
      const bp = audio.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 3.2;
      bp.frequency.value = idx === 0 ? 2400 : 1650;
      const g = audio.createGain();
      g.gain.setValueAtTime(0.001, tClick);
      g.gain.linearRampToValueAtTime(idx === 0 ? 0.16 : 0.11, tClick + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0008, tClick + 0.032);
      src.connect(bp);
      bp.connect(g);
      g.connect(target);
      src.start(tClick);
      src.stop(tClick + 0.038);
    });
  }
}

/**
 * Audition a transport's stock sound effect in the browser (e.g., when selecting a transport or clicking Preview in Studio).
 */
export async function playTransportPreview(transport: Transport, durationSec = 1.65): Promise<() => void> {
  try {
    if (activePreviewStop) {
      activePreviewStop();
      activePreviewStop = null;
    }
    const audio = ctx();
    if (audio.state === "suspended") await audio.resume();
    const handle = playTransportSoundOnNode(audio, audio.destination, transport, durationSec);
    activePreviewStop = handle.stop;
    return handle.stop;
  } catch {
    return () => {};
  }
}

/**
 * Audition a background soundtrack briefly when selecting it in the Audio tab.
 */
export async function playMusicPreview(id: MusicId, durationSec = 4.2): Promise<() => void> {
  try {
    if (activePreviewStop) {
      activePreviewStop();
      activePreviewStop = null;
    }
    if (id === "none") return () => {};
    const session = await createAudioSession({ music: id, soundEffects: false });
    if (!session) return () => {};
    const timer = window.setTimeout(() => {
      session.stop();
    }, durationSec * 1000);
    const stopFn = () => {
      window.clearTimeout(timer);
      session.stop();
    };
    activePreviewStop = stopFn;
    return stopFn;
  } catch {
    return () => {};
  }
}

export async function startMusic(id: MusicId): Promise<Handle | null> {
  if (id === "none") return null;
  const session = await createAudioSession({ music: id, soundEffects: false });
  if (!session) return null;
  return { dest: session.dest, stop: session.stop };
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function createGrooveStepScheduler(
  audio: BaseAudioContext,
  musicBus: AudioNode,
  id: MusicId
): { bpm: number; scheduleStep: (step: number, when: number) => void } {
  const whiteBuf = getWhiteNoiseBuffer(audio);

  const playKick = (when: number, vol = 0.24, punch = 155, endFreq = 44, dur = 0.18) => {
    const osc = audio.createOscillator();
    const g = audio.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(punch, when);
    osc.frequency.exponentialRampToValueAtTime(endFreq, when + dur);
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.0008, when + dur + 0.02);
    osc.connect(g);
    g.connect(musicBus);
    osc.start(when);
    osc.stop(when + dur + 0.03);
  };

  const playSnare = (when: number, vol = 0.13, toneHz = 185, decay = 0.13, clap = false) => {
    const noise = audio.createBufferSource();
    noise.buffer = whiteBuf;
    const filter = audio.createBiquadFilter();
    filter.type = clap ? "bandpass" : "highpass";
    filter.frequency.setValueAtTime(clap ? 1350 : 950, when);
    if (clap) filter.Q.setValueAtTime(1.8, when);

    const ng = audio.createGain();
    ng.gain.setValueAtTime(vol, when);
    ng.gain.exponentialRampToValueAtTime(0.0008, when + decay);
    noise.connect(filter);
    filter.connect(ng);
    ng.connect(musicBus);
    noise.start(when);
    noise.stop(when + decay + 0.02);

    if (!clap) {
      const body = audio.createOscillator();
      const bg = audio.createGain();
      body.type = "triangle";
      body.frequency.setValueAtTime(toneHz, when);
      body.frequency.exponentialRampToValueAtTime(85, when + 0.08);
      bg.gain.setValueAtTime(vol * 0.65, when);
      bg.gain.exponentialRampToValueAtTime(0.0008, when + 0.09);
      body.connect(bg);
      bg.connect(musicBus);
      body.start(when);
      body.stop(when + 0.1);
    }
  };

  const playHat = (when: number, vol = 0.045, open = false) => {
    const dur = open ? 0.17 : 0.042;
    const src = audio.createBufferSource();
    src.buffer = whiteBuf;
    const hp = audio.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.setValueAtTime(6800, when);
    const g = audio.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.0005, when + dur);
    src.connect(hp);
    hp.connect(g);
    g.connect(musicBus);
    src.start(when);
    src.stop(when + dur + 0.01);
  };

  const playNote = (
    when: number,
    midi: number,
    type: OscillatorType,
    vol: number,
    dur: number,
    cutoff = 2400,
    detuneCents = 0
  ) => {
    if (midi <= 0) return;
    const freq = midiToFreq(midi);
    const osc = audio.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (detuneCents) osc.detune.setValueAtTime(detuneCents, when);

    const filter = audio.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, when);
    filter.frequency.exponentialRampToValueAtTime(Math.max(240, cutoff * 0.38), when + dur);

    const g = audio.createGain();
    g.gain.setValueAtTime(0.0008, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0006, when + dur);

    osc.connect(filter);
    filter.connect(g);
    g.connect(musicBus);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  };

  const playChord = (when: number, midis: number[], type: OscillatorType, vol: number, dur: number, cutoff = 1800) => {
    midis.forEach((m, i) => playNote(when, m, type, vol, dur, cutoff, (i - 1) * 5));
  };

  let bpm = 118;
  let scheduleStep = (_step: number, _when: number) => {};

  if (id === "ambient") {
    // "Sunlit Horizon" — Upbeat Indie-Pop Travel Groove (C - G - Am - F, 118 BPM)
    bpm = 118;
    const bassRoots = [36, 43, 45, 41]; // C2, G2, A2, F2
    const chords = [
      [60, 64, 67], // C
      [59, 62, 67], // G
      [60, 64, 69], // Am
      [60, 65, 69], // F
    ];
    // Catchy bright kalimba/synth hook across 64 16th-steps
    const leadPattern = [
      72, 0, 76, 0, 79, 0, 76, 72, 74, 0, 79, 0, 83, 0, 79, 0,
      76, 0, 79, 0, 81, 0, 79, 76, 77, 0, 76, 72, 74, 0, 67, 0,
    ];
    scheduleStep = (step, when) => {
      const bar = Math.floor(step / 16) % 4;
      const s = step % 16;
      const root = bassRoots[bar];

      // Four-on-the-floor kick + bouncy syncopated ghost kick
      if (s % 4 === 0 || s === 14) playKick(when, 0.22, 150, 46, 0.16);
      if (s === 4 || s === 12) playSnare(when, 0.12, 190, 0.12, true);
      if (s % 2 === 0) playHat(when, s % 4 === 2 ? 0.055 : 0.03, s % 4 === 2);

      // Driving pop bassline
      if (s === 0 || s === 3 || s === 6 || s === 8 || s === 10 || s === 14) {
        const oct = s === 6 || s === 14 ? 12 : 0;
        playNote(when, root + oct, "sawtooth", 0.085, 0.16, 680);
      }

      // Off-beat sunny chord stabs
      if (s === 2 || s === 6 || s === 10 || s === 14) {
        playChord(when, chords[bar], "triangle", 0.032, 0.18, 2200);
      }

      // Plucky lead melody
      const note = leadPattern[step % 32];
      if (note > 0) {
        playNote(when, note, "triangle", 0.065, 0.2, 3400);
        playNote(when, note + 12, "sine", 0.025, 0.14, 4200);
      }
    };
  } else if (id === "tropical") {
    // "Tropical Island Hop" — Bouncy Marimba & Steel-Drum Sunset House (F - Dm - Bb - C, 116 BPM)
    bpm = 116;
    const bassRoots = [41, 38, 46, 48];
    const marimbaSeq = [
      65, 69, 72, 69, 77, 0, 72, 69, 62, 65, 69, 65, 74, 0, 69, 65,
      70, 74, 77, 74, 81, 0, 77, 74, 72, 76, 79, 76, 84, 79, 76, 72,
    ];
    scheduleStep = (step, when) => {
      const bar = Math.floor(step / 16) % 4;
      const s = step % 16;

      if (s % 4 === 0) playKick(when, 0.21, 140, 45, 0.17);
      // Dembow / tropical rim-clap on 3, 6, 11, 14 & backbeat
      if (s === 4 || s === 12) playSnare(when, 0.1, 220, 0.1, true);
      if (s === 3 || s === 6 || s === 11 || s === 14) playHat(when, 0.05, true);
      else if (s % 2 === 1) playHat(when, 0.028, false);

      // Warm sub-bass bounce
      if (s === 0 || s === 3 || s === 7 || s === 10 || s === 14) {
        playNote(when, bassRoots[bar], "triangle", 0.11, 0.2, 520);
      }

      // Steel-drum / Marimba lead (fundamental + 4th harmonic overtone)
      const mNote = marimbaSeq[step % 32];
      if (mNote > 0) {
        playNote(when, mNote, "sine", 0.075, 0.16, 3600);
        playNote(when, mNote + 19, "triangle", 0.026, 0.08, 4000);
      }
    };
  } else if (id === "funk") {
    // "Disco Funk Strut" — Groovy Slap Bass, Claps & Brassy Stabs (Em7 - A7 - Dmaj7 - B7, 120 BPM)
    bpm = 120;
    const bassLine = [
      40, 0, 52, 40, 0, 43, 45, 47, 45, 0, 57, 45, 0, 49, 52, 54,
      38, 0, 50, 38, 0, 42, 45, 47, 47, 0, 59, 47, 54, 51, 47, 42,
    ];
    const brassChords = [
      [64, 67, 71, 74],
      [64, 69, 73, 76],
      [62, 66, 69, 73],
      [63, 66, 69, 75],
    ];
    scheduleStep = (step, when) => {
      const bar = Math.floor(step / 16) % 4;
      const s = step % 16;

      if (s % 4 === 0) playKick(when, 0.24, 160, 44, 0.16);
      if (s === 4 || s === 12) playSnare(when, 0.14, 200, 0.13, true);
      // Disco open hi-hat on the "&" of every beat
      if (s % 4 === 2) playHat(when, 0.065, true);
      else playHat(when, 0.025, false);

      // Funky octave slap-bass
      const bNote = bassLine[step % 32];
      if (bNote > 0) {
        playNote(when, bNote, "sawtooth", 0.095, 0.13, 1450);
      }

      // Syncopated brassy synth stabs
      if (s === 0 || s === 3 || s === 6 || s === 11 || s === 14) {
        playChord(when, brassChords[bar], "sawtooth", 0.028, 0.14, 2600);
      }
    };
  } else if (id === "synthwave") {
    // "Turbo Neon Rush" — Fast 80s Outrun Arpeggio & Pumping Bass (Am - F - C - G, 126 BPM)
    bpm = 126;
    const roots = [33, 29, 36, 31];
    const arpNotes = [
      [69, 72, 76, 81, 76, 72, 69, 76],
      [65, 69, 72, 77, 72, 69, 65, 72],
      [67, 72, 76, 79, 76, 72, 67, 76],
      [67, 71, 74, 79, 74, 71, 67, 74],
    ];
    scheduleStep = (step, when) => {
      const bar = Math.floor(step / 16) % 4;
      const s = step % 16;

      if (s % 4 === 0) playKick(when, 0.25, 165, 42, 0.17);
      if (s === 4 || s === 12) playSnare(when, 0.15, 175, 0.18, false);
      if (s % 2 === 0) playHat(when, 0.04, s % 4 === 2);

      // Rolling 16th-note octave synth bass
      const bassNote = roots[bar] + (s % 2 === 1 ? 12 : 0);
      playNote(when, bassNote, "sawtooth", 0.08, 0.11, 920);

      // Sparkling 16th-note neon arpeggio
      const arp = arpNotes[bar][s % 8];
      playNote(when, arp, "square", 0.036, 0.12, 2900, 6);
    };
  } else if (id === "arcade") {
    // "8-Bit World Tour" — Hyper-Fun Chiptune Adventure Lead (C - G - Am - F, 136 BPM)
    bpm = 136;
    const bassRoots = [36, 43, 45, 41];
    const chipLead = [
      72, 76, 79, 84, 79, 76, 72, 0, 74, 79, 83, 86, 83, 79, 74, 0,
      76, 81, 84, 88, 84, 81, 76, 0, 77, 81, 84, 89, 88, 84, 79, 76,
    ];
    scheduleStep = (step, when) => {
      const bar = Math.floor(step / 16) % 4;
      const s = step % 16;

      if (s % 4 === 0 || s === 10) playKick(when, 0.2, 180, 52, 0.12);
      if (s === 4 || s === 12) playSnare(when, 0.11, 240, 0.09, false);
      if (s % 2 === 0) playHat(when, 0.035, false);

      // Jumping octave triangle bass
      const bPitch = bassRoots[bar] + (s % 4 >= 2 ? 12 : 0);
      if (s % 2 === 0) playNote(when, bPitch, "triangle", 0.1, 0.1, 1600);

      // Square-wave chiptune melody
      const cNote = chipLead[step % 32];
      if (cNote > 0) {
        playNote(when, cNote, "square", 0.045, 0.1, 3800);
      }
    };
  } else if (id === "folk") {
    // "Whistling Roadtrip" — Feel-Good Acoustic Strum, Tambourine & Whistled Hook (G - C - Em - D, 114 BPM)
    bpm = 114;
    const roots = [43, 48, 40, 38];
    const strumChords = [
      [55, 59, 62, 67],
      [60, 64, 67, 72],
      [55, 59, 64, 67],
      [57, 62, 66, 69],
    ];
    const whistleMelody = [
      79, 0, 81, 83, 79, 0, 74, 0, 76, 0, 79, 76, 72, 0, 0, 0,
      79, 0, 81, 83, 86, 0, 83, 79, 81, 0, 78, 74, 79, 0, 0, 0,
    ];
    scheduleStep = (step, when) => {
      const bar = Math.floor(step / 16) % 4;
      const s = step % 16;

      // Stomp-clap roadtrip rhythm
      if (s === 0 || s === 8) playKick(when, 0.22, 130, 46, 0.17);
      if (s === 4 || s === 12) playSnare(when, 0.12, 210, 0.11, true);
      if (s % 2 === 0) playHat(when, s % 4 === 2 ? 0.05 : 0.025, s % 4 === 2);

      // Alternating country/folk root-fifth bass
      if (s === 0 || s === 8) playNote(when, roots[bar], "triangle", 0.1, 0.22, 600);
      if (s === 4 || s === 12) playNote(when, roots[bar] + 7, "triangle", 0.085, 0.18, 600);

      // Brisk acoustic strum pattern (D - D U - U D U) scheduled on audio clock (zero setTimeout jitter!)
      if ([0, 4, 6, 10, 12, 14].includes(s)) {
        strumChords[bar].forEach((n, idx) => {
          playNote(when + idx * 0.011, n, "triangle", 0.028, 0.16, 2600);
        });
      }

      // Cheerful high whistle hook
      const wNote = whistleMelody[step % 32];
      if (wNote > 0) {
        playNote(when, wNote, "sine", 0.068, 0.24, 3800);
      }
    };
  } else if (id === "lofi") {
    // "Passport Stamp Groove" — Bouncy Boom-Bap Beat, Warm Rhodes Chords & Vlog Melody (94 BPM)
    bpm = 94;
    const roots = [38, 43, 36, 45]; // Dm7 - G7 - Cmaj7 - A7
    const rhodesChords = [
      [62, 65, 69, 72],
      [59, 65, 67, 74],
      [60, 64, 67, 71],
      [61, 64, 69, 72],
    ];
    const lofiHook = [
      74, 0, 72, 69, 0, 65, 69, 72, 71, 0, 67, 62, 0, 0, 67, 71,
      72, 0, 71, 67, 64, 0, 67, 71, 69, 0, 73, 76, 73, 69, 64, 0,
    ];
    scheduleStep = (step, when) => {
      const bar = Math.floor(step / 16) % 4;
      const s = step % 16;

      // Boom-bap swung kick & crisp snare
      if (s === 0 || s === 7 || s === 10) playKick(when, 0.24, 135, 42, 0.19);
      if (s === 4 || s === 12) playSnare(when, 0.13, 180, 0.11, false);
      if (s % 2 === 0) playHat(when, 0.038, s === 14);

      if (s === 0 || s === 7 || s === 10 || s === 14) {
        playNote(when, roots[bar], "sine", 0.12, 0.24, 480);
      }

      if (s === 0 || s === 6 || s === 11) {
        playChord(when, rhodesChords[bar], "sine", 0.036, 0.35, 1600);
      }

      const lNote = lofiHook[step % 32];
      if (lNote > 0) {
        playNote(when, lNote, "triangle", 0.055, 0.22, 2400);
      }
    };
  } else if (id === "cinematic") {
    // "Odyssey Blockbuster" — Driving Stadium Adventure Drums, Brass Anthem & Strings (112 BPM)
    bpm = 112;
    const roots = [38, 46, 41, 48]; // Dm - Bb - F - C
    const anthemLead = [
      62, 0, 69, 0, 74, 0, 72, 69, 70, 0, 65, 0, 74, 0, 72, 0,
      69, 0, 72, 0, 77, 0, 76, 72, 76, 0, 79, 0, 84, 0, 79, 0,
    ];
    scheduleStep = (step, when) => {
      const bar = Math.floor(step / 16) % 4;
      const s = step % 16;

      // Epic taiko / stadium toms & snare march
      if (s === 0 || s === 3 || s === 6 || s === 8 || s === 12) {
        playKick(when, 0.25, 145, 40, 0.2);
      }
      if (s === 4 || s === 12 || s === 15) {
        playSnare(when, 0.14, 165, 0.16, false);
      }
      if (s % 2 === 0) playHat(when, 0.04, s === 14);

      // Spiccato string ostinato on 16th notes
      const ostinato = roots[bar] + 12 + (s % 2 === 0 ? 0 : 7);
      playNote(when, ostinato, "sawtooth", 0.055, 0.12, 1150);

      // Soaring heroic brass melody
      const aNote = anthemLead[step % 32];
      if (aNote > 0) {
        playNote(when, aNote, "sawtooth", 0.06, 0.28, 2400, -4);
        playNote(when, aNote - 12, "sawtooth", 0.045, 0.28, 1800, 4);
      }
    };
  }

  return { bpm, scheduleStep };
}

function getBpmForTrack(id: MusicId): number {
  switch (id) {
    case "ambient":
      return 118;
    case "tropical":
      return 116;
    case "funk":
      return 120;
    case "synthwave":
      return 126;
    case "arcade":
      return 136;
    case "folk":
      return 114;
    case "lofi":
      return 94;
    case "cinematic":
      return 112;
    default:
      return 118;
  }
}

/**
 * Pre-renders a 64-step (4-bar) groove loop into a cached AudioBuffer off the main thread
 * using OfflineAudioContext so mobile playback runs on a single hardware-looped AudioBufferSourceNode
 * with zero main-thread timer jitter and zero live oscillator/filter allocations.
 */
async function getOrRenderGrooveBuffer(audio: AudioContext, id: MusicId): Promise<AudioBuffer | null> {
  if (id === "none") return null;
  const cacheKey = `${id}:${audio.sampleRate}`;
  const cached = grooveBufferCache.get(cacheKey);
  if (cached) return cached;

  const inflight = grooveRenderPromises.get(cacheKey);
  if (inflight) return inflight;

  const task = (async (): Promise<AudioBuffer | null> => {
    try {
      const OfflineCtx =
        window.OfflineAudioContext ||
        (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
      if (!OfflineCtx) return null;

      const sr = audio.sampleRate;
      const bpm = getBpmForTrack(id);
      const stepSec = 60 / bpm / 4;
      const preRollSteps = 4;
      const loopSteps = 64;
      const totalSteps = preRollSteps + loopSteps;
      const totalSamples = Math.ceil(totalSteps * stepSec * sr);
      const offline = new OfflineCtx(1, totalSamples, sr);

      const { scheduleStep } = createGrooveStepScheduler(offline, offline.destination, id);
      for (let i = 0; i < totalSteps; i++) {
        const stepIdx = (loopSteps - preRollSteps + i) % loopSteps;
        scheduleStep(stepIdx, i * stepSec);
      }

      const rendered = await offline.startRendering();
      const preRollSamples = Math.round(preRollSteps * stepSec * sr);
      const loopSamples = Math.min(rendered.length - preRollSamples, Math.round(loopSteps * stepSec * sr));
      const loopBuffer = audio.createBuffer(1, loopSamples, sr);
      loopBuffer
        .getChannelData(0)
        .set(rendered.getChannelData(0).subarray(preRollSamples, preRollSamples + loopSamples));

      grooveBufferCache.set(cacheKey, loopBuffer);
      return loopBuffer;
    } catch {
      return null;
    } finally {
      grooveRenderPromises.delete(cacheKey);
    }
  })();

  grooveRenderPromises.set(cacheKey, task);
  return task;
}

/**
 * Starts a lively, beat-driven procedural groove for the given MusicId.
 * Plays from a pre-rendered seamless AudioBuffer loop on the Web Audio thread (or a hardware-clock
 * lookahead scheduler fallback) so mobile 3D canvas rendering never lags or stutters the music.
 */
function startGrooveEngine(
  audio: AudioContext,
  dest: AudioNode,
  id: MusicId,
  preRenderedLoop: AudioBuffer | null
): { stop: () => void } {
  const musicBus = audio.createGain();
  musicBus.gain.setValueAtTime(0.001, audio.currentTime);
  musicBus.gain.linearRampToValueAtTime(0.82, audio.currentTime + 0.12);
  musicBus.connect(dest);

  if (preRenderedLoop) {
    const loopSource = audio.createBufferSource();
    loopSource.buffer = preRenderedLoop;
    loopSource.loop = true;
    loopSource.connect(musicBus);
    loopSource.start(audio.currentTime);

    return {
      stop: () => {
        const t = audio.currentTime;
        try {
          musicBus.gain.cancelScheduledValues(t);
          musicBus.gain.setValueAtTime(Math.max(0.0001, musicBus.gain.value), t);
          musicBus.gain.linearRampToValueAtTime(0.0001, t + 0.12);
          loopSource.stop(t + 0.14);
        } catch {
          /* ignore */
        }
      },
    };
  }

  // Fallback: Web Audio hardware-clock lookahead scheduler (schedules 0.45s ahead on audio.currentTime)
  const { bpm, scheduleStep } = createGrooveStepScheduler(audio, musicBus, id);
  const stepSec = 60 / bpm / 4;
  const LOOKAHEAD_SEC = 0.45;
  let nextStep = 0;
  const startTime = audio.currentTime + 0.02;

  const pumpLookahead = () => {
    const horizon = audio.currentTime + LOOKAHEAD_SEC;
    while (startTime + nextStep * stepSec <= horizon) {
      const when = Math.max(audio.currentTime, startTime + nextStep * stepSec);
      scheduleStep(nextStep, when);
      nextStep++;
    }
  };

  pumpLookahead();
  const timer = window.setInterval(pumpLookahead, 140);

  return {
    stop: () => {
      window.clearInterval(timer);
      const t = audio.currentTime;
      try {
        musicBus.gain.cancelScheduledValues(t);
        musicBus.gain.setValueAtTime(Math.max(0.0001, musicBus.gain.value), t);
        musicBus.gain.linearRampToValueAtTime(0.0001, t + 0.12);
      } catch {
        /* ignore */
      }
    },
  };
}

/**
 * Creates a unified audio session for both live Preview and WebM Video Recording.
 * Mixes background music tracks AND per-leg transport stock sound effects into both
 * speakers (`audio.destination`) and the recording stream (`dest`).
 */
export async function createAudioSession(options: {
  music: MusicId;
  soundEffects: boolean;
}): Promise<AudioSession | null> {
  if (activePreviewStop) {
    activePreviewStop();
    activePreviewStop = null;
  }
  if (options.music === "none" && !options.soundEffects) return null;
  const audio = ctx();
  if (audio.state === "suspended") {
    try {
      await audio.resume();
    } catch {
      /* autoplay policy may defer until user gesture */
    }
  }
  const preRenderedLoop =
    options.music !== "none" ? await getOrRenderGrooveBuffer(audio, options.music) : null;

  const master = audio.createGain();
  master.gain.value = 0.9;
  const dest = audio.createMediaStreamDestination();
  master.connect(audio.destination);
  master.connect(dest);

  let currentLegHandle: { stop: () => void } | null = null;
  const groove =
    options.music !== "none" ? startGrooveEngine(audio, master, options.music, preRenderedLoop) : null;

  return {
    dest,
    triggerIntro: (durationSec = 1.1) => {
      if (!options.soundEffects) return;
      currentLegHandle?.stop();
      if (audio.state === "suspended") {
        audio.resume().catch(() => {});
      }
      currentLegHandle = playTransportSoundOnNode(audio, master, "line", Math.max(0.65, durationSec));
    },
    triggerLeg: (transport: Transport, durationSec = 2.2) => {
      if (!options.soundEffects) return;
      currentLegHandle?.stop();
      if (audio.state === "suspended") {
        audio.resume().catch(() => {});
      }
      currentLegHandle = playTransportSoundOnNode(audio, master, transport, durationSec);
    },
    triggerArrival: (hasPhotos = false) => {
      if (!options.soundEffects) return;
      currentLegHandle?.stop();
      currentLegHandle = null;
      if (audio.state === "suspended") {
        audio.resume().catch(() => {});
      }
      playArrivalChimeOnNode(audio, master, hasPhotos);
    },
    stopLeg: () => {
      currentLegHandle?.stop();
      currentLegHandle = null;
    },
    stop: () => {
      currentLegHandle?.stop();
      currentLegHandle = null;
      groove?.stop();
    },
  };
}
