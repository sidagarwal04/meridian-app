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

export type ThemeId = "earth" | "eco" | "night" | "paper" | "satellite";
export type Aspect = "16:9" | "9:16" | "1:1";
export type LabelMode = "current" | "visited" | "always";
export type Units = "km" | "mi" | "none";
export type MusicId = "none" | "ambient" | "synthwave" | "cinematic" | "folk";

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
  aspect: Aspect;
  fps: 30 | 60;
  resolution: "768" | "1080";
};

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
}[] = [
  { id: "plane", label: "Airplane", icon: "✈", tier: "free", kind: "air" },
  { id: "line", label: "Line", icon: "—", tier: "free", kind: "draw" },
  { id: "dot", label: "Dots", icon: "•", tier: "free", kind: "draw" },
  { id: "helicopter", label: "Helicopter", icon: "🚁", tier: "pro", kind: "air" },
  { id: "car", label: "Car", icon: "🚗", tier: "pro", kind: "land" },
  { id: "bus", label: "Bus", icon: "🚌", tier: "pro", kind: "land" },
  { id: "train", label: "Train", icon: "🚆", tier: "pro", kind: "land" },
  { id: "motorcycle", label: "Motorcycle", icon: "🏍", tier: "pro", kind: "land" },
  { id: "tuktuk", label: "Tuk-tuk", icon: "🛺", tier: "pro", kind: "land" },
  { id: "camper", label: "Camper", icon: "🚐", tier: "pro", kind: "land" },
  { id: "bike", label: "Bicycle", icon: "🚲", tier: "pro", kind: "land" },
  { id: "walk", label: "Walking", icon: "🚶", tier: "pro", kind: "land" },
  { id: "boat", label: "Boat", icon: "🚢", tier: "pro", kind: "sea" },
];

export const THEMES: Record<
  ThemeId,
  { label: string; bg: string; ocean: string; land: string; landHi: string; border: string; line: string; labelColor: string; stars: boolean }
> = {
  earth: {
    label: "Earth",
    bg: "#070b14",
    ocean: "#163e66",
    land: "#7d9a62",
    landHi: "#e2c36b",
    border: "rgba(8, 24, 40, 0.45)",
    line: "#7ee0ff",
    labelColor: "#ffffff",
    stars: true,
  },
  eco: {
    label: "Eco",
    bg: "#101610",
    ocean: "#1a4034",
    land: "#4f8a5b",
    landHi: "#d6e38a",
    border: "rgba(10, 28, 18, 0.45)",
    line: "#d6ff4a",
    labelColor: "#f3ffe8",
    stars: false,
  },
  night: {
    label: "Night",
    bg: "#05060a",
    ocean: "#0c1b33",
    land: "#1a2740",
    landHi: "#274872",
    border: "rgba(120, 160, 220, 0.18)",
    line: "#ff5d73",
    labelColor: "#ffffff",
    stars: true,
  },
  paper: {
    label: "Paper",
    bg: "#e6e0d4",
    ocean: "#d5deea",
    land: "#f7f4ee",
    landHi: "#f0d7a4",
    border: "rgba(90, 100, 110, 0.35)",
    line: "#c4492c",
    labelColor: "#1b1b1b",
    stars: false,
  },
  satellite: {
    label: "Satellite",
    bg: "#05070a",
    ocean: "#0b3058",
    land: "#3e5334",
    landHi: "#8ea35a",
    border: "rgba(20, 30, 16, 0.4)",
    line: "#ffe566",
    labelColor: "#ffffff",
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
    music: "none",
    aspect: "16:9",
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
  const palette = THEMES[theme];
  return {
    ...style,
    theme,
    background: palette.bg,
    lineColor: palette.line,
    labelColor: palette.labelColor,
  };
}

export function presentStyle(style: Style, pro: boolean): Style {
  const palette = THEMES[style.theme];
  return {
    ...style,
    background: pro ? style.background : palette.bg,
    lineColor: pro ? style.lineColor : palette.line,
    labelColor: pro ? style.labelColor : palette.labelColor,
    showLogo: pro ? style.showLogo : true,
    music: pro ? style.music : "none",
    fps: pro && style.fps === 60 ? 60 : 30,
    resolution: pro && style.resolution === "1080" ? "1080" : "768",
    highlightCountries: pro ? style.highlightCountries : true,
  };
}

export function legAllowed(transport: Transport, pro: boolean) {
  const meta = transportMeta(transport);
  return pro || meta.tier === "free";
}
