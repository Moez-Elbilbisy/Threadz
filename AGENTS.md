# Threadz Project Memory

## Project
Premium Egyptian streetwear brand — Cloudflare Pages site. Shop, collections, journal, cart, auth, AI virtual try-on, order tracking with Bosta API.

## Stack
- Cloudflare Pages (wrangler) + Pages Functions (ES modules)
- KV namespace `ORDERS` for products, orders, users
- Static HTML/CSS/JS frontend (no framework)
- AI try-on via `/api/tryon` (supports Gemini, IDM-VTON, Segmind, Fal.ai, LightX, RapidAPI)

## AI Try-On Architecture
- `tryon.html` — Upload photo + select product → generate
- `infinite-tryon.html` — TikTok-style infinite scroll feed of AI try-on results
- `infinite-tryon.js` — Uses pool of stock model photos × products, calls `/api/tryon`, caches results
- `/api/tryon` (functions/api/tryon.js) — receives person + garment images, calls configured AI provider
- `worker.js` — standalone ES module version of the try-on worker (for direct deploy)

## Key Files
| File | Purpose |
|------|---------|
| `functions/api/tryon.js` | AI try-on server endpoint |
| `functions/api/products.js` | Product CRUD (KV-backed) |
| `tryon.html` / `tryon.js` | Classic upload-based try-on page |
| `infinite-tryon.html` / `infinite-tryon.js` | Infinite feed try-on |
| `worker.js` | Standalone try-on worker (mirrors functions/api/tryon.js) |
| `wrangler.toml` | Config with AI API keys, KV binding |
| `styles.css` | All site styles (~2800 lines) |
| `script.js` | Global JS (nav, scroll, cart) |
| `cart-data.js` | Cart state (localStorage) |
| `site-images.js` | Dynamic site image loader from /api/settings |

## Wrangler Config (wrangler.toml)
- KV: `ORDERS` for storage
- AI provider set to `idm-vton` (Hugging Face yisol/IDM-VTON)
- API keys: GEMINI_API_KEY, SEGMIND_API_KEY, HF_TOKEN, LIGHTX_API_KEY, RAPIDAPI_KEY, FAL_KEY

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
