# Usage and API Examples

**Language:** English | [中文](USAGE_EXAMPLES.zh-CN.md)

These examples use public-safe placeholder data. Replace URLs, tokens, paths, and settings before running them in your own environment, and make sure you are allowed to process the target data.

## Example 1: Local drafting workflow

Run the dev server, open the local URL, create a dated entry, add public-demo images, adjust cover crop, and confirm the draft persists after refresh.

## Example 2: Static hosting workflow

Run `npm run build`, serve `dist/` with a static web server, and verify that browser storage stays scoped to the final site origin.

## Local Validation Tips

- Start from `README.md` and bring the service up first.
- Call the health endpoint before running operations that write state or send notifications.
- Use synthetic or public demo data; do not paste private data into issues, screenshots, or commits.
- When using an AI assistant, provide this file, the deployment guide, and sanitized logs.
