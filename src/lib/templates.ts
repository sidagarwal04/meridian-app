import { applyTheme, defaultStyle, makeStop, uid, type Project, type Transport } from "./types";

type Seed = { name: string; country: string; code: string; lat: number; lon: number; transport?: Transport };

function projectFrom(title: string, seeds: Seed[], theme: Project["style"]["theme"] = "earth"): Project {
  const stops = seeds.map((seed) => makeStop(seed));
  const legs = seeds.slice(1).map((seed) => ({ transport: seed.transport ?? "plane" }));
  return {
    id: uid("tpl"),
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    stops,
    legs,
    style: { ...applyTheme(defaultStyle(), theme), speed: 1.15 },
  };
}

export const TEMPLATES: { id: string; title: string; blurb: string; project: Project }[] = [
  {
    id: "europe",
    title: "Europe in ten days",
    blurb: "Lisbon to Rome, with trains between the cities in between.",
    project: projectFrom("Europe in ten days", [
      { name: "Lisbon", country: "Portugal", code: "PT", lat: 38.7223, lon: -9.1393 },
      { name: "Madrid", country: "Spain", code: "ES", lat: 40.4168, lon: -3.7038, transport: "train" },
      { name: "Barcelona", country: "Spain", code: "ES", lat: 41.3874, lon: 2.1686, transport: "train" },
      { name: "Paris", country: "France", code: "FR", lat: 48.8566, lon: 2.3522, transport: "plane" },
      { name: "Amsterdam", country: "Netherlands", code: "NL", lat: 52.3676, lon: 4.9041, transport: "train" },
      { name: "Berlin", country: "Germany", code: "DE", lat: 52.52, lon: 13.405, transport: "train" },
      { name: "Prague", country: "Czechia", code: "CZ", lat: 50.0755, lon: 14.4378, transport: "train" },
      { name: "Rome", country: "Italy", code: "IT", lat: 41.9028, lon: 12.4964, transport: "plane" },
    ]),
  },
  {
    id: "japan",
    title: "Japan by rail",
    blurb: "Tokyo south to Hiroshima, one train line at a time.",
    project: projectFrom("Japan by rail", [
      { name: "Tokyo", country: "Japan", code: "JP", lat: 35.6762, lon: 139.6503 },
      { name: "Kyoto", country: "Japan", code: "JP", lat: 35.0116, lon: 135.7681, transport: "train" },
      { name: "Osaka", country: "Japan", code: "JP", lat: 34.6937, lon: 135.5023, transport: "train" },
      { name: "Hiroshima", country: "Japan", code: "JP", lat: 34.3853, lon: 132.4553, transport: "train" },
    ], "paper"),
  },
  {
    id: "west",
    title: "Pacific coast drive",
    blurb: "Los Angeles to Vancouver on the road.",
    project: projectFrom("Pacific coast drive", [
      { name: "Los Angeles", country: "United States", code: "US", lat: 34.0522, lon: -118.2437 },
      { name: "San Francisco", country: "United States", code: "US", lat: 37.7749, lon: -122.4194, transport: "car" },
      { name: "Portland", country: "United States", code: "US", lat: 45.5152, lon: -122.6784, transport: "car" },
      { name: "Seattle", country: "United States", code: "US", lat: 47.6062, lon: -122.3321, transport: "car" },
      { name: "Vancouver", country: "Canada", code: "CA", lat: 49.2827, lon: -123.1207, transport: "car" },
    ], "satellite"),
  },
  {
    id: "sea",
    title: "Mediterranean crossing",
    blurb: "A boat hop from Barcelona across to Athens.",
    project: projectFrom("Mediterranean crossing", [
      { name: "Barcelona", country: "Spain", code: "ES", lat: 41.3874, lon: 2.1686 },
      { name: "Marseille", country: "France", code: "FR", lat: 43.2965, lon: 5.3698, transport: "boat" },
      { name: "Rome", country: "Italy", code: "IT", lat: 41.9028, lon: 12.4964, transport: "boat" },
      { name: "Athens", country: "Greece", code: "GR", lat: 37.9838, lon: 23.7275, transport: "boat" },
      { name: "Santorini", country: "Greece", code: "GR", lat: 36.3932, lon: 25.4615, transport: "boat" },
    ], "eco"),
  },
  {
    id: "world",
    title: "Around the world",
    blurb: "Eight cities, one continuous flight path.",
    project: projectFrom("Around the world", [
      { name: "San Francisco", country: "United States", code: "US", lat: 37.7749, lon: -122.4194 },
      { name: "New York", country: "United States", code: "US", lat: 40.7128, lon: -74.006, transport: "plane" },
      { name: "London", country: "United Kingdom", code: "GB", lat: 51.5074, lon: -0.1278, transport: "plane" },
      { name: "Istanbul", country: "Türkiye", code: "TR", lat: 41.0082, lon: 28.9784, transport: "plane" },
      { name: "Delhi", country: "India", code: "IN", lat: 28.6139, lon: 77.209, transport: "plane" },
      { name: "Bangkok", country: "Thailand", code: "TH", lat: 13.7563, lon: 100.5018, transport: "plane" },
      { name: "Tokyo", country: "Japan", code: "JP", lat: 35.6762, lon: 139.6503, transport: "plane" },
      { name: "Honolulu", country: "United States", code: "US", lat: 21.3069, lon: -157.8583, transport: "plane" },
    ], "night"),
  },
  {
    id: "brazil",
    title: "Brazil coast",
    blurb: "Rio to São Paulo, then south to Buenos Aires.",
    project: projectFrom("Brazil coast", [
      { name: "Rio de Janeiro", country: "Brazil", code: "BR", lat: -22.9068, lon: -43.1729 },
      { name: "Sao Paulo", country: "Brazil", code: "BR", lat: -23.5558, lon: -46.6396, transport: "car" },
      { name: "Buenos Aires", country: "Argentina", code: "AR", lat: -34.6037, lon: -58.3816, transport: "plane" },
    ]),
  },
];

export const HERO_PROJECT: Project = {
  ...projectFrom("World route", [
    { name: "New York", country: "United States", code: "US", lat: 40.7128, lon: -74.006 },
    { name: "London", country: "United Kingdom", code: "GB", lat: 51.5074, lon: -0.1278, transport: "plane" },
    { name: "Paris", country: "France", code: "FR", lat: 48.8566, lon: 2.3522, transport: "plane" },
    { name: "Rome", country: "Italy", code: "IT", lat: 41.9028, lon: 12.4964, transport: "plane" },
    { name: "Istanbul", country: "Türkiye", code: "TR", lat: 41.0082, lon: 28.9784, transport: "plane" },
    { name: "Delhi", country: "India", code: "IN", lat: 28.6139, lon: 77.209, transport: "plane" },
    { name: "Bangkok", country: "Thailand", code: "TH", lat: 13.7563, lon: 100.5018, transport: "plane" },
    { name: "Tokyo", country: "Japan", code: "JP", lat: 35.6762, lon: 139.6503, transport: "plane" },
  ], "earth"),
  style: { ...defaultStyle(), speed: 1.7, showLogo: false, labels: "current" },
};
