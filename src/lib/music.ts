import type { MusicId } from "./types";

export const TRACKS: { id: MusicId; label: string; blurb: string }[] = [
  { id: "none", label: "No music", blurb: "Silent export" },
  { id: "ambient", label: "Ambient", blurb: "Slow pads for a wide route" },
  { id: "synthwave", label: "Synthwave", blurb: "Pulse for a fast city hop" },
  { id: "cinematic", label: "Cinematic", blurb: "Low fifths for a long journey" },
  { id: "folk", label: "Folk", blurb: "Soft plucks for a slow trip" },
];

type Handle = { stop: () => void; dest: MediaStreamAudioDestinationNode };

let shared: AudioContext | null = null;

function ctx() {
  if (!shared) shared = new AudioContext();
  return shared;
}

function tone(audio: AudioContext, dest: AudioNode, freq: number, type: OscillatorType, gain: number, attack = 0.4, when = 0) {
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

export async function startMusic(id: MusicId): Promise<Handle | null> {
  if (id === "none") return null;
  const audio = ctx();
  if (audio.state === "suspended") await audio.resume();
  const master = audio.createGain();
  master.gain.value = 0.9;
  const dest = audio.createMediaStreamDestination();
  master.connect(audio.destination);
  master.connect(dest);

  const nodes: { osc: OscillatorNode; g: GainNode }[] = [];
  const timers: number[] = [];
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
  } else {
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
    stop: () => {
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
