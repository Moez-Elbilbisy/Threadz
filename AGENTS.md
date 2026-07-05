# Threadz Project Memory

## Project
Premium Egyptian streetwear brand — Cloudflare Pages site. Shop, collections, journal, cart, auth, AI virtual try-on, order tracking with Bosta API.

## Stack
- Cloudflare Pages (wrangler) + Pages Functions (ES modules)
- KV namespace `ORDERS` for products, orders, users
- Static HTML/CSS/JS frontend (no framework)
- AI try-on via **PiAPI** (Kling Virtual Try-On) — server-side proxy at `/api/tryon`, $0.07/image
- **Puter.js** retained as client-side fallback if server fails

## AI Try-On Architecture
- `tryon.html` — Upload photo + select product → sends to `/api/tryon` (server proxy)
- `tryon.js`:
  1. Primary: `generateWithServer()` sends `person` file + `garment_url` to `/api/tryon`
  2. Fallback: if server fails, `generateWithPuter()` composites person+garment and calls `puter.ai.txt2img()`
- `functions/api/tryon.js` — Cloudflare Pages Function with multiple providers:
  - `piapi` (default): Uploads person + garment to LightX CDN, calls PiAPI `POST /api/v1/task` (Kling model), polls for result
  - Other: gemini, fal, segmind, idm-vton, lightx, rapidapi
- PiAPI key stored in `wrangler.toml` as `PIAPI_KEY` (not exposed to client)
- Puter.js CDN (`https://js.puter.com/v2/`) kept for fallback

## Key Files
| File | Purpose |
|------|---------|
| `tryon.html` / `tryon.js` | AI try-on page (PiAPI primary, Puter.js fallback) |
| `functions/api/tryon.js` | Server try-on endpoint (PiAPI/Kling + 6 other providers) |
| `functions/api/products.js` | Product CRUD (KV-backed) |
| `wrangler.toml` | Config with API keys, KV binding |
| `styles.css` | All site styles (~2800 lines) |
| `script.js` | Global JS (nav, scroll, cart) |
| `cart-data.js` | Cart state (localStorage) |
| `site-images.js` | Dynamic site image loader from /api/settings |

## GitHub
- Remote: https://github.com/Threadzeg/Threadz.git
- Branch: main

## Memory Instructions (for AI)
Every time a new session starts, read this file first. When making changes to the project, update this file to reflect:
- New files added
- Architecture changes
- New dependencies or config
- Any decisions or conventions established

At the end of each session, if any project-relevant changes were made, update this file and commit/push.
