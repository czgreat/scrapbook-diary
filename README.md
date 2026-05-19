# Scrapbook Diary

[English](README.md) | [中文](README.zh-CN.md)

Scrapbook Diary is a local-first visual diary editor inspired by image-heavy social publishing tools. It is designed for drafting rich daily posts without a backend: images, captions, topics, layout choices, and publishing metadata stay in the browser.


## AI-assisted development

This public release was prepared with Codex using GPT-5.4 and GPT-5.5 assistance. The code, documentation, and release cleanup were reviewed for public sharing, but the project is community-maintained and is not an official OpenAI product.


## Highlights

- Calendar-driven daily entry workflow
- Multi-image upload, ordering, and cover selection
- Cover ratio presets: `3:4`, `1:1`, `4:5`, and `9:16`
- Direct crop/position/zoom controls in the preview area
- Draft fields for title, body, topics, location, visibility, and scheduled time
- Browser-local persistence with IndexedDB
- Vite + React implementation with a static production build

## Architecture

```text
src/
  App.tsx        Main editor experience
  storage.ts     IndexedDB persistence helpers
  App.css        Product styling and layout
public/          Static assets
server.mjs       Lightweight local static server
```

The app does not require a remote database. It is suitable for local writing workflows, demos, and static hosting.

## Quick Start

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Preview a production build:

```bash
npm run preview
```

## Docker

```bash
cp docker-compose.example.yml docker-compose.yml
docker compose up --build
```

## Privacy

Drafts are stored in the browser. Clearing site data removes local drafts. Do not use this repository to commit personal media or generated `dist/` output.

## License

MIT

