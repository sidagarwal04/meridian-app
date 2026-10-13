export type Transport =
  | "plane"
  | "line"
  | "dot"
  | "helicopter"
  | "car"
  | "bus"
  | "train"
  | "boat"
  | "motorcycle"
  | "walk"
  | "bike"
  | "tuktuk"
  | "camper";

export type ThemeId = "earth" | "eco" | "night" | "paper" | "cyber";
export type CameraView = "horizon" | "orbit" | "top";
export type Aspect = "16:9" | "9:16" | "1:1";
export type ExportFormat = "mp4" | "mov" | "webm" | "mkv" | "gif";
export type LabelMode = "current" | "visited" | "always";
export type Units = "km" | "mi" | "none";
export type MusicId =
  | "none"
  | "ambient"
  | "synthwave"
  | "cinematic"
  | "folk"
  | "tropical"
  | "funk"
  | "arcade"
  | "lofi";

export type Stop = {
  id: string;
  name: string;
  country: string;
  code: string;
  lat: number;
  lon: number;
  dwellSec: number;
  photos: string[];
  emoji: string;
};

export type Leg = { transport: Transport };

export type Style = {
  theme: ThemeId;
  cameraView?: CameraView;
  background: string;
  lineColor: string;
  labelColor: string;
  highlightCountries: boolean;
  speed: number;
  units: Units;
  startZoom: boolean;
  endZoom: boolean;
  labels: LabelMode;
  optimizeLabels: boolean;
  showLogo: boolean;
  showFullRouteAtEnd: boolean;
  showCountryFlags: boolean;
  music: MusicId;
  musicChosen?: boolean;
  soundEffects: boolean;
  aspect: Aspect;
  format?: ExportFormat;
  fps: 30 | 60;
  resolution: "768" | "1080";
};

export const EXPORT_FORMATS: {
  id: ExportFormat;
  ext: string;
  label: string;
  sub: string;
  mime: string;
}[] = [
  { id: "mp4", ext: "mp4", label: "MP4", sub: "Universal H.264 · Social & Web", mime: "video/mp4" },
  { id: "mov", ext: "mov", label: "MOV", sub: "QuickTime · Apple & Final Cut", mime: "video/quicktime" },
  { id: "webm", ext: "webm", label: "WebM", sub: "VP9 · High Efficiency Web", mime: "video/webm" },
  { id: "mkv", ext: "mkv", label: "MKV", sub: "Matroska · Desktop HD", mime: "video/x-matroska" },
  { id: "gif", ext: "gif", label: "GIF", sub: "Animated Loop · Docs & Chat", mime: "image/gif" },
];

export type Project = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  stops: Stop[];
  legs: Leg[];
  style: Style;
};

export type User = {
  email: string;
  name: string;
  provider: "google";
  image?: string | null;
};

export type Purchase = {
  pack: "pro5" | "pro25" | "pro100";
  videos: number;
  at: number;
  until: number;
};

export type Account = {
  plan: "free" | "pro";
  credits: number;
  proUntil: number | null;
  purchases: Purchase[];
};

export type Limits = {
  pro: boolean;
  maxStops: number;
  maxPhotos: number;
  maxFps: 30 | 60;
  maxRes: "768" | "1080";
  music: boolean;
  gpx: boolean;
  customColors: boolean;
  landSea: boolean;
  logoOptional: boolean;
  credits: number;
};

export const TRANSPORTS: {
  id: Transport;
  label: string;
  icon: string;
  tier: "free" | "pro";
  kind: "air" | "land" | "sea" | "draw";
  soundLabel: string;
}[] = [
  { id: "plane", label: "Airplane", icon: "✈", tier: "free", kind: "air", soundLabel: "Jet turbine & flyby whoosh" },
  { id: "line", label: "Line", icon: "—", tier: "free", kind: "draw", soundLabel: "Cinematic air swoosh" },
  { id: "dot", label: "Dots", icon: "•", tier: "free", kind: "draw", soundLabel: "Rhythmic pops & swoosh" },
  { id: "helicopter", label: "Helicopter", icon: "🚁", tier: "pro", kind: "air", soundLabel: "Rotor blade chop & turbine" },
  { id: "car", label: "Car", icon: "🚗", tier: "pro", kind: "land", soundLabel: "Highway engine & road whoosh" },
  { id: "bus", label: "Bus", icon: "🚌", tier: "pro", kind: "land", soundLabel: "Coach diesel & air brake" },
  { id: "train", label: "Train", icon: "🚆", tier: "pro", kind: "land", soundLabel: "Rail clackety-clack & horn" },
  { id: "motorcycle", label: "Motorcycle", icon: "🏍", tier: "pro", kind: "land", soundLabel: "Twin-cylinder throttle rev" },
  { id: "tuktuk", label: "Tuk-tuk", icon: "🛺", tier: "pro", kind: "land", soundLabel: "2-stroke put-put & beep-beep" },
  { id: "camper", label: "Camper", icon: "🚐", tier: "pro", kind: "land", soundLabel: "Cruiser van hum & coastal breeze" },
  { id: "bike", label: "Bicycle", icon: "🚲", tier: "pro", kind: "land", soundLabel: "Bicycle bell ding & freewheel" },
  { id: "walk", label: "Walking", icon: "🚶", tier: "pro", kind: "land", soundLabel: "Trail footsteps & breeze" },
  { id: "boat", label: "Boat", icon: "🚢", tier: "pro", kind: "sea", soundLabel: "Ocean waves & ship horn" },
];

export const THEMES: Record<
  ThemeId,
  { label: string; bg: string; ocean: string; land: string; landHi: string; border: string; line: string; labelColor: string; stars: boolean }
> = {
  earth: {
    label: "Earth",
    bg: "#090b10",
    ocean: "#0a1e3c",
    land: "#355e38",
    landHi: "rgba(56, 189, 248, 0.16)",
    border: "rgba(255, 255, 255, 0.28)",
    line: "#1d9bf0",
    labelColor: "#ffffff",
    stars: true,
  },
  eco: {
    label: "Eco",
    bg: "#06120e",
    ocean: "#0f5156",
    land: "#2e8b57",
    landHi: "rgba(163, 230, 53, 0.22)",
    border: "rgba(255, 255, 255, 0.24)",
    line: "#a3e635",
    labelColor: "#f7fee7",
    stars: true,
  },
  night: {
    label: "Night",
    bg: "#03050c",
    ocean: "#09152b",
    land: "#1e293b",
    landHi: "rgba(99, 102, 241, 0.28)",
    border: "rgba(148, 163, 184, 0.26)",
    line: "#f43f5e",
    labelColor: "#ffffff",
    stars: true,
  },
  paper: {
    label: "Paper",
    bg: "#ede6d6",
    ocean: "#b8d4e8",
    land: "#fbf8f1",
    landHi: "rgba(245, 158, 11, 0.25)",
    border: "rgba(71, 85, 105, 0.32)",
    line: "#e11d48",
    labelColor: "#0f172a",
    stars: false,
  },
  cyber: {
    label: "Cyber",
    bg: "#04020b",
    ocean: "#060b1d",
    land: "#0f1730",
    landHi: "rgba(34, 211, 238, 0.24)",
    border: "rgba(34, 211, 238, 0.42)",
    line: "#ff2bd6",
    labelColor: "#f0fdff",
    stars: true,
  },
};

export const PACKS = [
  { id: "pro5" as const, name: "Pro 5", videos: 5, price: "$5.99", detail: "5 HD videos, max 100 places" },
  { id: "pro25" as const, name: "Pro 25", videos: 25, price: "$14.99", detail: "25 HD videos, max 100 places" },
  { id: "pro100" as const, name: "Pro 100", videos: 100, price: "$34.99", detail: "100 HD videos, max 100 places" },
];

export function uid(prefix = "id") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultStyle(): Style {
  const theme = THEMES.earth;
  return {
    theme: "earth",
    cameraView: "horizon",
    background: theme.bg,
    lineColor: theme.line,
    labelColor: theme.labelColor,
    highlightCountries: true,
    speed: 1,
    units: "km",
    startZoom: true,
    endZoom: true,
    labels: "visited",
    optimizeLabels: true,
    showLogo: true,
    showFullRouteAtEnd: true,
    showCountryFlags: true,
    music: "ambient",
    soundEffects: true,
    aspect: "16:9",
    format: "mp4",
    fps: 30,
    resolution: "768",
  };
}

export function makeStop(partial: Omit<Stop, "id" | "dwellSec" | "photos" | "emoji"> & Partial<Stop>): Stop {
  return {
    id: partial.id ?? uid("stop"),
    name: partial.name,
    country: partial.country,
    code: partial.code,
    lat: partial.lat,
    lon: partial.lon,
    dwellSec: partial.dwellSec ?? 1.1,
    photos: partial.photos ?? [],
    emoji: partial.emoji ?? "",
  };
}

export function starterStops(): Stop[] {
  return [
    makeStop({ name: "Lisbon", country: "Portugal", code: "PT", lat: 38.7223, lon: -9.1393 }),
    makeStop({ name: "Paris", country: "France", code: "FR", lat: 48.8566, lon: 2.3522 }),
    makeStop({ name: "Rome", country: "Italy", code: "IT", lat: 41.9028, lon: 12.4964 }),
  ];
}

export function createProject(title = "My trip"): Project {
  const stops = starterStops();
  return {
    id: uid("vid"),
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    stops,
    legs: stops.slice(1).map(() => ({ transport: "plane" as Transport })),
    style: defaultStyle(),
  };
}

export function transportMeta(id: Transport) {
  return TRANSPORTS.find((t) => t.id === id) ?? TRANSPORTS[0];
}

export function isProAccount(_account: Account | null) {
  return true;
}

export function limitsFor(_account: Account | null): Limits {
  return {
    pro: true,
    maxStops: 100,
    maxPhotos: 100,
    maxFps: 60,
    maxRes: "1080",
    music: true,
    gpx: true,
    customColors: true,
    landSea: true,
    logoOptional: true,
    credits: Number.POSITIVE_INFINITY,
  };
}

export function frameSize(style: Style, pro: boolean) {
  const res = pro && style.resolution === "1080" ? 1080 : 768;
  const fps: 30 | 60 = pro && style.fps === 60 ? 60 : 30;
  if (style.aspect === "9:16") {
    return res === 1080 ? { w: 1080, h: 1920, fps } : { w: 432, h: 768, fps };
  }
  if (style.aspect === "1:1") {
    const side = res === 1080 ? 1080 : 768;
    return { w: side, h: side, fps };
  }
  return res === 1080 ? { w: 1920, h: 1080, fps } : { w: 768, h: 432, fps };
}

export function applyTheme(style: Style, theme: ThemeId): Style {
  const palette = THEMES[theme] ?? THEMES.earth;
  return {
    ...style,
    theme: THEMES[theme] ? theme : "earth",
    background: palette.bg,
    lineColor: palette.line,
    labelColor: palette.labelColor,
  };
}

export function presentStyle(style: Style, pro: boolean): Style {
  const palette = THEMES[style.theme] ?? THEMES.earth;
  return {
    ...style,
    theme: THEMES[style.theme] ? style.theme : "earth",
    background: pro ? style.background : palette.bg,
    lineColor: pro ? style.lineColor : palette.line,
    labelColor: pro ? style.labelColor : palette.labelColor,
    showLogo: pro ? style.showLogo : true,
    music: pro ? style.music : "ambient",
    soundEffects: style.soundEffects ?? true,
    fps: pro && style.fps === 60 ? 60 : 30,
    resolution: pro && style.resolution === "1080" ? "1080" : "768",
    highlightCountries: pro ? style.highlightCountries : true,
  };
}

export function legAllowed(transport: Transport, pro: boolean) {
  const meta = transportMeta(transport);
  return pro || meta.tier === "free";
}
