import type { MusicId, Transport } from "./types";

export const TRACKS: { id: MusicId; label: string; blurb: string }[] = [
  { id: "none", label: "No music", blurb: "Silent background" },
  { id: "ambient", label: "Ambient", blurb: "Slow pads for a wide route" },
  { id: "synthwave", label: "Synthwave", blurb: "Pulse for a fast city hop" },
  { id: "cinematic", label: "Cinematic", blurb: "Low fifths for a long journey" },
  { id: "folk", label: "Folk", blurb: "Soft plucks for a slow trip" },
];

type Handle = { stop: () => void; dest: MediaStreamAudioDestinationNode };

export type AudioSession = {
  dest: MediaStreamAudioDestinationNode;
  triggerLeg: (transport: Transport, durationSec?: number) => void;
  triggerArrival: () => void;
  stopLeg: () => void;
  stop: () => void;
};

let shared: AudioContext | null = null;
let noiseBufferCache: AudioBuffer | null = null;
let pinkNoiseBufferCache: AudioBuffer | null = null;
let activePreviewStop: (() => void) | null = null;

function ctx() {
  if (!shared) shared = new AudioContext();
  return shared;
}

function getWhiteNoiseBuffer(audio: AudioContext): AudioBuffer {
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

function getPinkNoiseBuffer(audio: AudioContext): AudioBuffer {
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

    const stepInterval = 0.13;
    const steps = Math.max(3, Math.floor((dur - 0.1) / stepInterval));
    for (let i = 0; i < steps; i++) {
      const t0 = i * stepInterval;
      const pitch = 580 + (i % 4) * 75;
      const pop = startOsc("sine", pitch, t0, t0 + 0.065);
      pop.frequency.exponentialRampToValueAtTime(pitch * 0.48, now + t0 + 0.06);
      const pg = audio.createGain();
      pg.gain.setValueAtTime(0.001, now + t0);
      pg.gain.linearRampToValueAtTime(0.075, now + t0 + 0.008);
      pg.gain.exponentialRampToValueAtTime(0.0008, now + t0 + 0.062);
      pop.connect(pg);
      pg.connect(bus);
    }
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

    // 3. Rhythmic "clack-clack ... clack-clack" track joint hits
    const pairPeriod = 0.34;
    const pairs = Math.max(2, Math.floor(dur / pairPeriod));
    for (let p = 0; p < pairs; p++) {
      [0, 0.085].forEach((offset, hitIdx) => {
        const tHit = p * pairPeriod + offset + 0.05;
        if (tHit + 0.05 > dur) return;
        const clickSrc = audio.createBufferSource();
        clickSrc.buffer = getWhiteNoiseBuffer(audio);
        clickSrc.start(now + tHit);
        clickSrc.stop(now + tHit + 0.045);
        sources.push(clickSrc);

        const bp = audio.createBiquadFilter();
        bp.type = "bandpass";
        bp.Q.value = 4.2;
        bp.frequency.value = hitIdx === 0 ? 1150 : 920;

        const cg = audio.createGain();
        cg.gain.setValueAtTime(0.001, now + tHit);
        cg.gain.linearRampToValueAtTime(hitIdx === 0 ? 0.22 : 0.17, now + tHit + 0.005);
        cg.gain.exponentialRampToValueAtTime(0.001, now + tHit + 0.042);

        clickSrc.connect(bp);
        bp.connect(cg);
        cg.connect(bus);
      });
    }
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

    // 2. Rapid light freewheel hub ratcheting clicks ("tick-tick-tick")
    const clickPeriod = 0.075;
    const clicks = Math.floor(dur / clickPeriod);
    for (let c = 0; c < clicks; c++) {
      const tClick = c * clickPeriod;
      const tick = startOsc("triangle", 2600 + (c % 2) * 200, tClick, tClick + 0.018);
      const tg = audio.createGain();
      tg.gain.setValueAtTime(0.0005, now + tClick);
      tg.gain.linearRampToValueAtTime(0.022, now + tClick + 0.002);
      tg.gain.exponentialRampToValueAtTime(0.0005, now + tClick + 0.016);
      tick.connect(tg);
      tg.connect(bus);
    }
  } else if (transport === "walk") {
    // Rhythmic alternating footsteps on trail + soft outdoor breeze
    const stepPeriod = 0.25;
    const steps = Math.max(2, Math.floor(dur / stepPeriod));
    for (let s = 0; s < steps; s++) {
      const tStep = s * stepPeriod + 0.02;
      if (tStep + 0.09 > dur) continue;
      const isLeft = s % 2 === 0;

      // Low heel thud
      const thud = startOsc("sine", isLeft ? 135 : 122, tStep, tStep + 0.075);
      thud.frequency.exponentialRampToValueAtTime(48, now + tStep + 0.07);
      const tg = audio.createGain();
      tg.gain.setValueAtTime(0.001, now + tStep);
      tg.gain.linearRampToValueAtTime(0.09, now + tStep + 0.008);
      tg.gain.exponentialRampToValueAtTime(0.001, now + tStep + 0.072);
      thud.connect(tg);
      tg.connect(bus);

      // Crisp gravel/sole crunch
      const crunch = audio.createBufferSource();
      crunch.buffer = getPinkNoiseBuffer(audio);
      crunch.start(now + tStep + 0.01);
      crunch.stop(now + tStep + 0.085);
      sources.push(crunch);

      const bp = audio.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 2.0;
      bp.frequency.value = isLeft ? 1250 : 1420;
      const cg = audio.createGain();
      cg.gain.setValueAtTime(0.001, now + tStep + 0.01);
      cg.gain.linearRampToValueAtTime(0.16, now + tStep + 0.022);
      cg.gain.exponentialRampToValueAtTime(0.001, now + tStep + 0.08);
      crunch.connect(bp);
      bp.connect(cg);
      cg.connect(bus);
    }
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
 * Subtle cartographic arrival chime when reaching a waypoint stop.
 */
export function playArrivalChimeOnNode(audio: AudioContext, target: AudioNode) {
  const now = audio.currentTime;
  [587.33, 880].forEach((freq, idx) => {
    const start = now + idx * 0.055;
    const osc = audio.createOscillator();
    const g = audio.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.0005, start);
    g.gain.linearRampToValueAtTime(0.032, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0004, start + 0.32);
    osc.connect(g);
    g.connect(target);
    osc.start(start);
    osc.stop(start + 0.34);
  });
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

export async function startMusic(id: MusicId): Promise<Handle | null> {
  if (id === "none") return null;
  const session = await createAudioSession({ music: id, soundEffects: false });
  if (!session) return null;
  return { dest: session.dest, stop: session.stop };
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
  if (options.music === "none" && !options.soundEffects) return null;
  const audio = ctx();
  if (audio.state === "suspended") {
    try {
      await audio.resume();
    } catch {
      /* autoplay policy may defer until user gesture */
    }
  }
  const master = audio.createGain();
  master.gain.value = 0.9;
  const dest = audio.createMediaStreamDestination();
  master.connect(audio.destination);
  master.connect(dest);

  const nodes: { osc: OscillatorNode; g: GainNode }[] = [];
  const timers: number[] = [];
  let currentLegHandle: { stop: () => void } | null = null;

  const id = options.music;
  if (id === "ambient") {
    nodes.push(tone(audio, master, 110, "sine", 0.05, 1.2));
    nodes.push(tone(audio, master, 164.81, "sine", 0.03, 1.6));
    nodes.push(tone(audio, master, 220, "triangle", 0.02, 1.8));
  } else if (id === "synthwave") {
    nodes.push(tone(audio, master, 55, "sawtooth", 0.035, 0.2));
    nodes.push(tone(audio, master, 220, "square", 0.012, 0.05));
    const lfo = audio.createOscillator();
    const lfoGain = audio.createGain();
    lfo.frequency.value = 2;
    lfoGain.gain.value = 18;
    lfo.connect(lfoGain);
    lfoGain.connect(nodes[1].osc.frequency);
    lfo.start();
    nodes.push({ osc: lfo, g: lfoGain });
  } else if (id === "cinematic") {
    nodes.push(tone(audio, master, 65.41, "sine", 0.06, 1.4));
    nodes.push(tone(audio, master, 98, "triangle", 0.03, 1.8));
    nodes.push(tone(audio, master, 196, "sine", 0.015, 2));
  } else if (id === "folk") {
    const scale = [261.63, 293.66, 329.63, 392, 440];
    scale.forEach((freq, i) => {
      const osc = audio.createOscillator();
      const g = audio.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      g.gain.value = 0;
      osc.connect(g);
      g.connect(master);
      osc.start();
      const pulse = () => {
        const t = audio.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.03, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      };
      timers.push(window.setInterval(pulse, 700 + i * 180));
      nodes.push({ osc, g });
    });
  }

  return {
    dest,
    triggerLeg: (transport: Transport, durationSec = 2.2) => {
      if (!options.soundEffects) return;
      currentLegHandle?.stop();
      if (audio.state === "suspended") {
        audio.resume().catch(() => {});
      }
      currentLegHandle = playTransportSoundOnNode(audio, master, transport, durationSec);
    },
    triggerArrival: () => {
      if (!options.soundEffects) return;
      currentLegHandle?.stop();
      currentLegHandle = null;
      playArrivalChimeOnNode(audio, master);
    },
    stopLeg: () => {
      currentLegHandle?.stop();
      currentLegHandle = null;
    },
    stop: () => {
      currentLegHandle?.stop();
      currentLegHandle = null;
      timers.forEach((timer) => window.clearInterval(timer));
      const t = audio.currentTime;
      nodes.forEach(({ osc, g }) => {
        try {
          g.gain.cancelScheduledValues(t);
          g.gain.setValueAtTime(g.gain.value, t);
          g.gain.linearRampToValueAtTime(0, t + 0.15);
          osc.stop(t + 0.2);
        } catch {
          /* already stopped */
        }
      });
    },
  };
}
