# Scrapbook Diary

A local-first visual diary editor inspired by social post creation flows. It is built with React, Vite, and IndexedDB, and focuses on fast image-first drafting without requiring a backend.

## Features

- Calendar-driven daily entries
- Multi-image upload and cover selection
- Cover ratios: `3:4`, `1:1`, `4:5`, and `9:16`
- Drag-to-crop preview with zoom and position controls
- Draft fields for title, body, topics, location, visibility, and scheduled time
- Local persistence with IndexedDB

## Quick Start

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## Notes

All user content stays in the browser's local storage. Clear site data if you want to remove local drafts.
