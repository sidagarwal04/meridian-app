# Meridian

Turn a trip into a clear map animation for sharing or presenting.

Add the places you went, choose how you traveled between them, and export a short video of the route drawn across a globe. Videos stay in this browser. Sign-in uses Google.

## Features

- Air, road, rail, and sea routes
- Photos, emoji, and music generated in the browser
- Import from GPX, KML, GeoJSON, or a Google Maps directions link
- 1080p WebM export at 60 frames per second
- English plus Arabic, German, Spanish, French, Hindi, Japanese, Korean, Portuguese, and Chinese

## Local setup

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local
```

Set these in `.env.local`:

```
NEXTAUTH_URL=http://localhost:3456
NEXTAUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

`NEXTAUTH_SECRET` can be any long random string. In Google Cloud Console, create an OAuth client of type Web application and set the authorized redirect URI to `http://localhost:3456/api/auth/callback/google`.

```bash
npm run dev
```

Open [http://localhost:3456](http://localhost:3456).

## Scripts

- `npm run dev` starts the development server on port 3456
- `npm run build` creates a production build
- `npm start` serves that build

## Data

Country shapes come from Natural Earth via world-atlas. Place search uses OpenStreetMap Nominatim. Road geometry uses OSRM. Follow each service's usage policy.

## License

[MIT](LICENSE)
