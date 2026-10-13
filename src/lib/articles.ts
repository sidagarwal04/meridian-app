export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  author: string;
  tags: string[];
  cover: string;
  body: string[];
};

export const TAGS = ["Announcement", "Latest", "Features", "Comparison", "Guide", "FAQ", "How to", "Tutorials"];

export const ARTICLES: Article[] = [
  {
    slug: "create-your-first-map",
    title: "Create your first travel map animation",
    excerpt: "Add cities, pick how you traveled, and export a vertical or horizontal video without a timeline editor.",
    date: "March 5, 2026",
    author: "Meridian",
    tags: ["How to", "Guide", "Tutorials"],
    cover: "linear-gradient(145deg, #12324f, #1f6f78 55%, #e2c36b)",
    body: [
      "Open Create, sign in, and start a video. The studio opens on a world map with a short starter route you can replace.",
      "Search for a city, click the map, or paste a Google Maps directions link. Each stop becomes a point on the globe. Reorder them until the story reads in the order you traveled.",
      "Between two stops, choose a transport icon. Flights draw a great-circle arc. Cars, bikes, and walking follow roads when a public routing service can trace them.",
      "Open Style & Audio to set the globe theme, camera zoom, labels, flags, speed, soundtrack, and aspect ratio. 16:9 suits YouTube and talks. 9:16 suits Reels, Shorts, and TikTok. 1:1 suits a square feed.",
      "Preview plays the animation in the browser. Export Video renders that same animation to MP4, MOV, WebM, MKV, or GIF. Downloads are free.",
    ],
  },
  {
    slug: "customize-the-video",
    title: "Customize the globe, labels, and camera",
    excerpt: "Five globe styles, label modes, a zoom-in open, and a zoom-out that tries to show the whole route.",
    date: "February 12, 2026",
    author: "Meridian",
    tags: ["Features", "Guide"],
    cover: "linear-gradient(160deg, #1b2430, #3d6b4f 50%, #d6ff4a)",
    body: [
      "Earth, Eco, Night, Paper, and Cyber change the ocean, land, and route color. You can also override the background, route, and label colors.",
      "Place labels can show only the current stop, every stop visited so far, or the full list from the first frame. Overlap hiding drops labels that would sit on top of each other.",
      "Starting zoom begins wide and moves onto the first city. Ending zoom, together with Show full route at the end, pulls back so the whole trip fits in frame.",
      "Speed scales every leg and every pause. Distance can read in kilometers, miles, or stay hidden.",
      "Country names and flags sit under the city label. The Meridian mark can be turned off.",
    ],
  },
  {
    slug: "route-types",
    title: "Air, land, and sea routes",
    excerpt: "Straight flight arcs, road traces for cars and bikes, and sea arcs for boats.",
    date: "February 12, 2026",
    author: "Meridian",
    tags: ["Features", "FAQ", "How to"],
    cover: "linear-gradient(150deg, #0c1b33, #163e66 45%, #ff5d73)",
    body: [
      "Airplane, helicopter, train, boat, line, and dots draw a great-circle arc between the two stops. That is the right look for a flight or a ferry when you do not have a track.",
      "Car, bus, motorcycle, tuk-tuk, and camper ask a driving router for the road shape. Bicycle and walking use bike and foot profiles. If the router cannot connect two points — an ocean in between is the usual reason — the leg falls back to an arc.",
      "You can mix modes. Fly into a city, then drive the next leg, then take a boat. Each leg keeps its own icon, and that icon rides the front of the line while the leg is animating.",
      "A dotted leg draws the path without a vehicle. A plain line does the same with a solid stroke.",
    ],
  },
  {
    slug: "import-gpx",
    title: "Import GPX, KML, GeoJSON, or a Maps link",
    excerpt: "Bring a recorded track or a shared directions link in instead of typing every city.",
    date: "October 25, 2025",
    author: "Meridian",
    tags: ["How to", "Tutorials"],
    cover: "linear-gradient(155deg, #142033, #3e5334 50%, #ffe566)",
    body: [
      "GPX tracks from a watch or a phone, KML, and GeoJSON line or point files all parse in the browser.",
      "Long tracks are thinned to a readable number of stops so the animation does not pause on every GPS ping. Names come from the file when they exist, otherwise from the nearest known city.",
      "A Google Maps directions link can be pasted on any plan. Meridian reads the place names out of the /dir/ path and searches them in order.",
      "You can also describe the trip in plain text: one place per line, with phrases like “train to Lyon” or “Barcelona by boat”. The studio geocodes each line and sets the transport on the way in.",
    ],
  },
  {
    slug: "photos-and-music",
    title: "Photos, emoji, soundtracks, and SFX",
    excerpt: "Polaroid photo stacks appear when the camera holds on a stop, with procedural music and vehicle SFX mixed in.",
    date: "April 30, 2026",
    author: "Meridian",
    tags: ["Features", "Announcement"],
    cover: "linear-gradient(150deg, #2a1d38, #8a4b2f 40%, #f0d7a4)",
    body: [
      "Each stop can hold up to 12 photos (up to 100 photos per video). During the pause on that city, polaroid frames fan out beside the point and remain as mini thumbnails along the route.",
      "Add an emoji or custom caption to a stop label — useful for a meal, a hotel, or a trailhead.",
      "Soundtracks are 8 original beat-driven grooves synthesized on your device (Horizon Chill, Sunlit Tropics, Disco Strut, Night Drive 84, 8-Bit Odyssey, Campfire Acoustic, Rainy Window Lo-Fi, and Grand Vista), paired with per-leg transport sound effects for planes, trains, cars, boats, bikes, and footsteps.",
      "Choose a track and toggle transport SFX before export and they are mixed directly into the downloaded video.",
    ],
  },
  {
    slug: "packages",
    title: "Free, with a Google sign-in",
    excerpt: "Sign in with Google. Every export, transport, and style is included.",
    date: "December 5, 2025",
    author: "Meridian",
    tags: ["FAQ", "Comparison"],
    cover: "linear-gradient(160deg, #202124, #1a73e8)",
    body: [
      "Sign in with Google, then create as many videos as you want. Preview and download do not spend a credit.",
      "A route can hold 100 places and 100 photos. Exports can be 1080p at 60 frames per second, with the Meridian mark turned off.",
      "Airplane, road, rail, and sea icons, file import, custom colors, and music are included. Nothing on the pricing page is a paid pack.",
    ],
  },
  {
    slug: "formats",
    title: "What the exported video actually is",
    excerpt: "Export MP4, MOV, WebM, MKV, or animated GIF directly from the 3D globe canvas.",
    date: "October 25, 2025",
    author: "Meridian",
    tags: ["FAQ"],
    cover: "linear-gradient(150deg, #111, #444)",
    body: [
      "Export records the canvas in your chosen format — MP4 (H.264/AAC), QuickTime MOV, WebM (VP9/Opus), Matroska MKV, or animated GIF — ready for YouTube, Instagram Reels, TikTok, Keynote, and web embeds.",
      "Frame size follows the aspect ratio. 768 is 768×432, 432×768, or 768×768. 1080 is 1920×1080, 1080×1920, or 1080×1080.",
      "Rendering time is about the length of the animation, because the recorder captures the globe in real time.",
    ],
  },
  {
    slug: "why-map-animation",
    title: "Why a map animation instead of a timeline edit",
    excerpt: "A route video is easier to follow than a montage when the point is where you went.",
    date: "April 30, 2026",
    author: "Meridian",
    tags: ["Comparison", "Latest"],
    cover: "linear-gradient(145deg, #10243b, #7d9a62)",
    body: [
      "A timeline editor is the right tool when you are cutting interviews and b-roll. It is a slow tool when the story is a list of cities.",
      "Meridian only asks for the places, the way you moved between them, and an optional photo at each pause. The camera, the line, and the labels are derived from that list.",
      "Keep social cuts short: five to ten stops, vertical frame, a title that states the trip. Longer routes still work — they just read better as a full-route zoom at the end than as a minute of every village.",
    ],
  },
];
