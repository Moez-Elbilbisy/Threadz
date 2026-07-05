# Threadz Project Memory

## Project
Premium Egyptian streetwear brand — Cloudflare Pages site. Shop, collections, journal, cart, auth, AI virtual try-on, order tracking with Bosta API.

## Stack
- Cloudflare Pages (wrangler) + Pages Functions (ES modules)
- KV namespace `ORDERS` for products, orders, users
- Static HTML/CSS/JS frontend (no framework)
- AI try-on via **Puter.js** (Nano Banana / Gemini 3 Pro) — client-side, free, no API key needed

## AI Try-On Architecture
- `tryon.html` — Upload photo + select product → generates with Puter.js
- `tryon.js` — Composites user photo + garment image, calls `puter.ai.txt2img()` with
  Gemini 3 Pro model + try-on prompt. No server-side AI calls.
- Puter.js CDN: `https://js.puter.com/v2/` loaded in tryon.html

## Key Files
| File | Purpose |
|------|---------|
| `tryon.html` / `tryon.js` | AI try-on page (Puter.js client-side generation) |
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
