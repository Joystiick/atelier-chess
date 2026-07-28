# Atelier Chess

A quiet table for two — human vs human (8-digit codes) or vs Garbochess-JS AI (easy / medium / hard).

**Stack:** Next.js · Neon Postgres · Pusher Channels · Netlify · [Garbochess-JS](https://github.com/glinscott/Garbochess-JS)

**Native desktop (Electron):** see [`desktop/README.md`](desktop/README.md).

## Local setup

1. Copy env:
   ```bash
   cp .env.example .env.local
   ```
2. Fill `DATABASE_URL` (Neon) and Pusher keys.
3. Install & push schema:
   ```bash
   npm install
   npm run db:push
   ```
4. Run:
   ```bash
   npm run dev
   ```
   Or with Netlify platform features: `netlify dev`

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js local server |
| `npm run build` | Production build |
| `npm run db:push` | Apply Drizzle schema to Neon |
| `npm run desktop:dev` | Typecheck + launch Electron shell (loads Netlify by default) |
| `npm run desktop:build` | Compile Electron main/preload only |
| `npm run desktop:dist:win` | Build Windows x64 NSIS installer |
| `npm run desktop:write-latest` | Fill `public/desktop/latest.json` from release asset names |

## Deploy (Netlify)

1. Push this repo to GitHub.
2. `netlify init` or link in the Netlify UI.
3. Set the same env vars in Netlify (including `NEXT_PUBLIC_PUSHER_*`).
4. Deploy.

## Attribution

Chess engine: Gary Linscott — Garbochess-JS (see `public/engine/LICENSE`).

Piece artwork: [Lichess cburnett](https://github.com/lichess-org/lila) SVG set (Colin M.L. Burnett).
