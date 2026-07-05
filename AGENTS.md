# Threadz Project Memory

## Project
Premium Egyptian streetwear brand — Cloudflare Pages site. Shop, collections, journal, cart, auth, AI virtual try-on, order tracking with Bosta API.

## Stack
- Cloudflare Pages (wrangler) + Pages Functions (ES modules)
- KV namespace `ORDERS` for products, orders, users
- Static HTML/CSS/JS frontend (no framework)
- AI try-on via **ComfyICU (Nano Banana / CatVTON)** — server-side proxy at `/api/tryon`
- **Puter.js** retained as client-side fallback if server fails

## AI Try-On Architecture
- `tryon.html` — Upload photo + select product → sends to `/api/tryon` (server proxy)
- `tryon.js`:
  1. Primary: `generateWithServer()` sends `person` file + `garment_url` to `/api/tryon`
  2. Fallback: if server fails, `generateWithPuter()` composites person+garment and calls `puter.ai.txt2img()`
- `functions/api/tryon.js` — Cloudflare Pages Function with multiple providers:
  - `comfyicu` (default): Uses ComfyICU with Nano Banana / CatVTON workflow
  - Other: gemini, fal, segmind, idm-vton, lightx, rapidapi
- ComfyICU API key + workflow ID stored in `wrangler.toml` as `COMFYICU_API_KEY` / `COMFYICU_WORKFLOW_ID` (not exposed to client)
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

## Credit Rotation
- ComfyICU free tier gives 5k credits. When exhausted, API returns HTTP 402.
- `tryon.js` auto-rotates through `COMFYICU_API_KEY_BACKUP_1`, `_BACKUP_2` on 402.
- Active key index stored in KV (`comfyicu_key_index`).
- ComfyICU uses Google OAuth only — no email signup.

## Account Automation
Two tools chained together for fully automated account cycling:

### 1. Auto-Gmail-Creator (external Python tool)
- https://github.com/ai-to-ai/Auto-Gmail-Creator
- Creates Gmail accounts via Selenium with sms-activate.org phone verification
- Outputs `Created.txt` with `username\tpassword\tbirthday\tphone` format
- Requires: sms-activate.org API key (~$0.15/phone number), proxies
- Place cloned repo at project root or any directory

### 2. `scripts/setup-comfyicu.js` (our Playwright script)
- Reads from Auto-Gmail-Creator's `Created.txt` first (use `--gmail-dir <path>` flag)
- Falls back to `.env.comfyicu` file or env vars
- Opens browser, does Google OAuth → ComfyICU signup → API key extraction
- Updates `wrangler.toml` with all 3 keys

### Full cycle
```bash
# Step 1: Create 3 Gmail accounts
cd Auto-Gmail-Creator
python app.py  # needs sms-activate.org API key + proxies
# Output: Created.txt with 3 accounts

# Step 2: Create ComfyICU accounts & extract API keys
cd ../Threadz/Website
node scripts/setup-comfyicu.js --gmail-dir ../../Auto-Gmail-Creator

# Step 3: Deploy
npx wrangler pages deploy . --branch=main
```
- Rotation logic is inline in `comfyicuTryon()` in `functions/api/tryon.js`.

## Memory Instructions (for AI)
Every time a new session starts, read this file first. When making changes to the project, update this file to reflect:
- New files added
- Architecture changes
- New dependencies or config
- Any decisions or conventions established

At the end of each session, if any project-relevant changes were made, update this file and commit/push.
