# Meridian — Your Odysseys, in Motion

**Live App:** [meridian.meetsid.dev](https://meridian.meetsid.dev/)

Turn any journey into a cinematic 3D globe or 2D map animation ready for sharing or presenting — plot flights, trains, and road trips in seconds.

Plot the places you visited, pick how you traveled between each leg, attach polaroid photos, score the trip with procedural soundtracks and vehicle sound effects, and export high-definition video directly from your browser. Sign in with Google via NextAuth to sync your routes and style settings across devices (powered by Netlify Blobs + IndexedDB + instant in-memory snapshot caching), while keeping personal stop photos private on your local device.

## Features

- **Installable Mobile PWA (Auto-Updating)** — Install Meridian directly to your home screen on mobile via the built-in install banner (captures native Android/Chrome/Edge `beforeinstallprompt` immediately on first visit and provides guided iOS Safari / mobile browser Home Screen steps) with an auto-updating Service Worker (`sw.js`) that activates new deployments automatically.
- **Cross-Device Route Sync & Local Photo Privacy** — Routes, stops, transport modes, and style settings sync across your laptop and mobile devices via your Google account (backed by Netlify Blobs, local IndexedDB offline caching, and instant in-memory/snapshot preloading). Personal photos attached to stops are never uploaded to any server and stay strictly in the browser where they were added.
- **Interactive 2D Route Studio & 3D WebGL Globe** — Plan routes on a fast 2D map editor with country/territory highlighting, drag-and-drop stop ordering, and instant preview on a 3D globe with satellite imagery and topographic relief shading.
- **5 Cartographic Themes & Custom Palettes** — Switch between `Earth` (3D satellite relief), `Eco`, `Night`, `Paper`, and `Cyber`, or customize ocean/backdrop, route line, and callout label hex colors.
- **3 Camera Perspectives** — Choose between `2D Overhead`, `3D Tilted` (cinematic pitch), and `3D Chase Cam` (dynamic heading follow) with configurable intro/outro zooms and animation speed (`0.5×` – `2.5×`).
- **12 Air, Land & Sea Transport Modes** — Combine airplanes, helicopters, high-speed trains, cars, buses, motorcycles, tuk-tuks, camper vans, bicycles, walking, boats, dotted arcs, or clean lines. Driving, cycling, and walking legs automatically trace real road geometry via OSRM with great-circle arc fallback.
- **Polaroid Photo Showcases** — Attach up to 12 photos per stop (up to 100 photos per Meridian) plus custom captions and emojis. Photos fan out as polaroid clusters during camera pauses and remain anchored as mini thumbnails along the route.
- **Procedural Soundtracks & Per-Leg Transport SFX** — Synthesize 8 beat-driven soundtracks (`Horizon Chill`, `Sunlit Tropics`, `Disco Strut`, `Night Drive 84`, `8-Bit Odyssey`, `Campfire Acoustic`, `Rainy Window Lo-Fi`, `Grand Vista`) pre-rendered off-thread via `OfflineAudioContext` for jitter-free mobile playback, plus realistic per-leg vehicle audio (jet turbines, helicopter rotors, rail clatter, engines, sails, footsteps, arrival chimes, and polaroid shutter clicks) using the Web Audio API.
- **Multi-Format Video & GIF Export** — Export in **MP4** (`H.264/AAC`), **MOV** (`QuickTime`), **WebM** (`VP9/Opus`), **MKV** (`Matroska`), or animated **GIF** across **16:9** landscape, **9:16** vertical (Reels / Shorts / TikTok), and **1:1** square at **768p** or **1080p Full HD** and **30 / 60 FPS**.
- **GPX, KML, GeoJSON, Google Maps & Plain-Text Import** — Drop recorded GPS tracks, paste a Google Maps `/dir/` URL, or describe an itinerary in plain text (e.g., `"Paris to Lyon by train -> Marseille by car"`).
- **Self-Contained Shareable Route Links** — Share any route via `/r/[code]` URLs that encode stops, transport legs, and styling directly in the link.
- **Private Admin Telemetry Dashboard** — Built-in `/admin` analytics dashboard (restricted to configured `ADMIN_EMAILS`) tracking sign-ins, saved Meridians, transport mode breakdown, theme popularity, and top corridors.
- **10 Languages** — Localized UI in English, Spanish, French, German, Portuguese, Japanese, Chinese, Korean, Hindi, and Arabic (with RTL layout support).

## Local Setup

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local
```

Configure `.env.local`:

```ini
NEXTAUTH_URL=http://localhost:3456
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Optional: connect localhost directly to your live production Netlify Blobs store
NETLIFY_SITE_ID=
NETLIFY_AUTH_TOKEN=

# Optional: comma-separated list of admin emails allowed to view /admin telemetry
ADMIN_EMAILS=sidaxy@gmail.com
```

1. **Google OAuth (`NEXTAUTH_*` & `GOOGLE_*`)**:
   - `NEXTAUTH_SECRET` can be any long random string (e.g., `openssl rand -base64 32`).
   - In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an OAuth 2.0 Client ID of type **Web application** and add `http://localhost:3456/api/auth/callback/google` (and `https://meridian.meetsid.dev/api/auth/callback/google` for production) to **Authorized redirect URIs**.
2. **Cross-Device Storage (`@netlify/blobs`)**:
   - **On Netlify (Production)**: Zero configuration is required. Netlify automatically provisions and injects the `meridian-projects` Netlify Blobs store context at runtime.
   - **On Localhost**: By default, if `NETLIFY_SITE_ID` and `NETLIFY_AUTH_TOKEN` are left blank, the dev server stores cloud-synced projects in a local `.data/cloud-projects.json` fallback file. If you want `localhost:3456` to sync directly with your live production Netlify Blobs store, add your Netlify **Project ID / Site ID** (`NETLIFY_SITE_ID`) and a **Personal Access Token** (`NETLIFY_AUTH_TOKEN`) to `.env.local`.
3. **Admin Telemetry (`ADMIN_EMAILS`)**:
   - Optional comma-separated list of Google account emails authorized to access `/admin` and `/api/admin/stats` (defaults to `sidaxy@gmail.com`).

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3456](http://localhost:3456).

## Scripts

- `npm run dev` — Start the development server on port `3456`
- `npm run build` — Build the production Next.js application
- `npm start` — Start the production server on port `3456`

## Data & Attribution

Country boundaries and land topology come from [Natural Earth](https://www.naturalearthdata.com/) via `world-atlas`. Satellite relief textures use NASA Blue Marble & ETOPO1 elevation data. Place search and reverse geocoding use [OpenStreetMap Nominatim](https://nominatim.org/) alongside a built-in instant gazetteer. Road, bike, and walking geometry uses [OSRM](https://project-osrm.org/). Please follow each service's usage policy.

## License

[MIT](LICENSE)
