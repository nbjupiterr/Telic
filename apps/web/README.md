# Telic website

The public Telic product site lives in this npm workspace. It uses the Next.js
App Router and ships as statically rendered pages with small interactive islands.

## Local development

Run commands from the repository root:

```bash
npm ci
npm run site:dev
```

Open `http://localhost:3000`. Before handoff, run:

```bash
npm run site:check
npm run site:build
```

For the production browser audit, start the built site, then run the audit in a
second terminal:

```bash
npm run start --workspace @telic/web -- --hostname 127.0.0.1 --port 3000
npm run site:browser-audit
```

Set `SITE_BROWSER_PATH` if Brave, Chrome, or Chromium is not installed in a
standard Linux path.

## Vercel deployment

Import the GitHub repository as a Vercel monorepo project. Set the project Root
Directory to `apps/web`; keep the detected Next.js framework, install command,
build command, and output directory defaults. Vercel reads the repository-root
lockfile and supplies `VERCEL_PROJECT_PRODUCTION_URL` for canonical metadata.

If another platform is used, set `NEXT_PUBLIC_SITE_URL` to the final HTTPS
origin before building.

## Demo media handoff

Recording specifications and exact filenames live in
[`public/media/README.md`](public/media/README.md). The current product UI is a
stable placeholder. Keep its dimensions and transcript when replacing it with
the final video component.
