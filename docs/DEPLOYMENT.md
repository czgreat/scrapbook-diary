# Deployment Guide

Local-first image diary editor built with React, Vite, and IndexedDB.

## What is already usable

- Runs locally with Node.js and npm
- Can be built as a static site
- Can run through Docker/Nginx using the example compose file
- No backend or database is required

## What you must provide

- Real screenshots for the README if you want a polished GitHub landing page
- Optional hosted demo URL
- Optional export/sync feature if cross-device drafts are required

## Local development

```bash
npm install
npm run dev
```

## Validation checks

```bash
npm run lint --if-present
npm run build
```

## Docker deployment

```bash
cp docker-compose.example.yml docker-compose.yml
docker compose up --build
```

## Manual deployment

Build with `npm run build`, then serve the generated `dist/` directory from any static web server such as Nginx, Caddy, GitHub Pages, or Cloudflare Pages.

## Production checklist

- Keep `.env` private and never commit it.
- Replace all placeholder secrets before exposing the service.
- Mount runtime data outside the repository.
- Put the service behind HTTPS if it is reachable from other machines.
- Back up persistent data before upgrades.
- Review logs after the first startup.

