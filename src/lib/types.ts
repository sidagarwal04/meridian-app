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
    bg: "#040814",
    ocean: "#0d47a1",
    land: "#388e3c",
    landHi: "#fbbf24",
    border: "rgba(6, 22, 46, 0.55)",
    line: "#38bdf8",
    labelColor: "#ffffff",
    stars: true,
  },
  eco: {
    label: "Eco",
    bg: "#06120e",
    ocean: "#0f5156",
    land: "#2e8b57",
    landHi: "#bef264",
    border: "rgba(6, 28, 20, 0.5)",
    line: "#a3e635",
    labelColor: "#f7fee7",
    stars: true,
  },
  night: {
    label: "Night",
    bg: "#03050c",
    ocean: "#09152b",
    land: "#1e293b",
    landHi: "#6366f1",
    border: "rgba(99, 102, 241, 0.28)",
    line: "#f43f5e",
    labelColor: "#ffffff",
    stars: true,
  },
  paper: {
    label: "Paper",
    bg: "#ede6d6",
    ocean: "#b8d4e8",
    land: "#fbf8f1",
    landHi: "#f59e0b",
    border: "rgba(71, 85, 105, 0.32)",
    line: "#e11d48",
    labelColor: "#0f172a",
    stars: false,
  },
  satellite: {
    label: "Satellite",
    bg: "#03060c",
    ocean: "#082f49",
    land: "#365314",
    landHi: "#eab308",
    border: "rgba(15, 23, 42, 0.5)",
    line: "#facc15",
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
