# Scrapbook Diary

[![CI](https://github.com/czgreat/scrapbook-diary/actions/workflows/ci.yml/badge.svg)](https://github.com/czgreat/scrapbook-diary/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Language:** English | [中文](README.zh-CN.md)

Local-first visual diary editor for drafting image-rich daily posts without running a backend.

## Overview

Scrapbook Diary is a Vite + React application for composing visual diary entries, social-post drafts, or lightweight content boards. Images, captions, topics, cover choices, and draft metadata are stored in the browser with IndexedDB.

## Key Features

- Calendar-driven daily entry workflow
- Multi-image upload, ordering, cover selection, and preview
- Cover ratio presets for common publishing formats
- Crop, position, and zoom controls in the editor
- Browser-local persistence with no required remote database

## Current Public Release

Ready to use:

- Run locally with `npm run dev`
- Build static assets with `npm run build`
- Serve with the provided Docker/Nginx example
- Use as a private local drafting tool

You must provide locally:

- A modern Node.js runtime and npm
- A browser profile where local drafts can be stored
- Your own image assets; do not commit private media

## Quick Start

```bash
npm install
npm run dev
```

For Python projects on Windows, activate the virtual environment with `.venv\Scripts\Activate.ps1` instead of `. .venv/bin/activate`.

## Docker Deployment

```bash
cp docker-compose.example.yml docker-compose.yml
docker compose up --build
```

## Manual Deployment

- Run `npm run build` to create `dist/`.
- Serve `dist/` with any static web server.
- Use HTTPS in production if the workflow is exposed beyond localhost.

## Configuration

- No server-side configuration is required for the default local workflow.
- Browser data is local to the site origin. Changing hostnames or clearing site data can make drafts unavailable.

## Validation

```bash
npm run lint --if-present
npm run build
```

## Repository Layout

| Path | Purpose |
|---|---|
| `src/App.tsx` | Main React editor experience |
| `src/storage.ts` | IndexedDB persistence helpers |
| `public/` | Static assets |
| `server.mjs` | Lightweight local static server |
| `docker-compose.example.yml` | Example container deployment |

## Documentation

| Topic | English | Chinese |
|---|---|---|
| Deployment | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | [docs/DEPLOYMENT.zh-CN.md](docs/DEPLOYMENT.zh-CN.md) |
| AI handoff | [docs/AI_HANDOFF.md](docs/AI_HANDOFF.md) | [docs/AI_HANDOFF.zh-CN.md](docs/AI_HANDOFF.zh-CN.md) |
| Roadmap | [docs/ROADMAP.md](docs/ROADMAP.md) | [docs/ROADMAP.zh-CN.md](docs/ROADMAP.zh-CN.md) |

## AI-Assisted Development

This public release was prepared with Codex using GPT-5.4 and GPT-5.5 assistance. The source code, docs, and public-release cleanup were reviewed for public sharing, but this is a community project and not an official OpenAI product.

Good next tasks for an AI coding assistant:

- Add export/import for local drafts
- Add browser storage migration tests
- Improve mobile editor ergonomics
- Add Playwright smoke tests for upload and preview flows

## Privacy and Secrets

Do not commit real `.env` files, API keys, webhook secrets, cookies, private media, production databases, logs, generated artifacts, or personal data. Start from the example config files and keep private values outside Git.

## License

MIT
