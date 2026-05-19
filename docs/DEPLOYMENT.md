# Deployment Guide

**Language:** English | [中文](DEPLOYMENT.zh-CN.md)

This guide explains how to run `scrapbook-diary` locally, in Docker, or with a manual service setup. It assumes you cloned the GitHub repository and are working from the repository root.

## What Is Already Usable

- Run locally with `npm run dev`
- Build static assets with `npm run build`
- Serve with the provided Docker/Nginx example
- Use as a private local drafting tool

## What You Must Provide

- A modern Node.js runtime and npm
- A browser profile where local drafts can be stored
- Your own image assets; do not commit private media

## Local Development

```bash
npm install
npm run dev
```

If the command uses `. .venv/bin/activate`, use `.venv\Scripts\Activate.ps1` on Windows PowerShell.

## Docker Deployment

```bash
cp docker-compose.example.yml docker-compose.yml
docker compose up --build
```

Before running Docker, review every bind mount and every value in `.env`. Example compose files are intentionally generic and should be adjusted to your host paths and ports.

## Manual Deployment

- Run `npm run build` to create `dist/`.
- Serve `dist/` with any static web server.
- Use HTTPS in production if the workflow is exposed beyond localhost.

## Configuration Checklist

- No server-side configuration is required for the default local workflow.
- Browser data is local to the site origin. Changing hostnames or clearing site data can make drafts unavailable.

## Validation Checks

```bash
npm run lint --if-present
npm run build
```

## Production Checklist

- Replace all placeholder secrets before real use.
- Keep private config, generated data, logs, uploaded media, and generated artifacts outside Git.
- Put the service behind a reverse proxy with HTTPS if it is reachable from other devices.
- Add authentication before exposing private APIs beyond localhost.
- Configure backups for any database, state directory, uploaded files, and generated artifacts.
- Read `SECURITY.md` before reporting or triaging security issues.

## Troubleshooting

- Re-check `.env` and volume paths first; most deployment failures are path or permission issues.
- Use the health endpoint listed in `README.md` to separate process startup issues from application behavior.
- Run the validation commands before changing deployment infrastructure.
- When asking an AI assistant for help, include OS, runtime versions, exact command, sanitized logs, and deployment mode.
