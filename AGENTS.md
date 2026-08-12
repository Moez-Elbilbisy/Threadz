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

## Free Tools (free-for.dev sweep — 2026-08-12)
All free-tier, no card. Candidate/recommended integrations only — none wired up yet.

| Need | Tool | Free limit |
|------|------|-----------|
| Image CDN / product images | Cloudinary | 25 credits/mo (1 credit = 1k transforms, 1GB storage, 1GB CDN) |
| Image CDN alt | ImageKit | 20GB bandwidth/mo, real-time transforms |
| Try-on photo uploads | Uploadcare | 3k uploads / 3GB traffic / 3GB storage |
| Image host | ImgBB | unlimited, direct links |
| Object storage | Cloudflare R2 | 10GB/mo, 1M A + 10M B ops (already in CF free tier) |
| Transactional email | Resend | 3k emails/mo, 100/day, 1 custom domain |
| Transactional email alt | Brevo | 9k/mo, 300/day |
| Client-side email | EmailJS | 200 req/mo, 2 templates |
| Brand inboxes | Zoho Mail | 5 users, 5GB each, 1 domain |
| E-com analytics | TraceLog | 10k events/mo, AI e-com insights |
| Simple analytics | GoatCounter | 100k pageviews/mo (non-commercial) |
| Session replay/heatmaps | Microsoft Clarity | unlimited, free |
| Product analytics + surveys | PostHog | 1M events/mo |
| Uptime monitoring | UptimeRobot | 50 monitors @ 5min |
| Uptime + status page | Better Stack / FlareWarden / Pingbreak / OnlineOrNot | 10–15 monitors |
| Error tracking | Sentry | 5k errors/mo |
| Webhooks as a service | Svix | 50k messages/mo |
| Webhook mock/test | Beeceptor | 50 req/day |
| Key-rotation watchdog | healthchecks.io | 20 cron/heartbeats |
| Shop search | Algolia (Build) | 1M docs, 10k searches/mo |
| Web push | OneSignal | unlimited push + 10k emails/mo |
| Phone validation | veriphone | 1k req/mo |
| AI image fallback | Pollinations.AI | free, no API key |
| AI image gateway | Lumenfall | FLUX schnell free/unlimited |
| Edge DB (if KV limits bite) | Turso | 9GB, 500 DBs, 1B row reads/mo |
| Sessions / key index | Upstash Redis | 500k cmds/mo, 256MB |
| Full DB + auth alt | Supabase / Neon | free tier |
| Contact/quiz forms | Tally.so / HeyForm | unlimited |
| Logs | Axiom | 0.5TB, 30-day retention |

## Security Notes (IMPORTANT)
- `wrangler.toml` is committed and holds LIVE secrets: `BOSTA_API_KEY`, `JWT_SECRET`, `ADMIN_CODE`, `HF_TOKEN`, `PIAPI_KEY`, Segmind/Gemini/LightX/RapidAPI keys, `COMFYICU_API_KEY`.
  - Any time the repo is public or shared, those must be rotated.
  - Even if private, move keys out of the file: `wrangler pages secret put <NAME>` or Dashboard → Pages → project → **Variables** → add as Secret, then replace vars usage in code. Keep `wrangler.toml` secrets blank.
- `..\config.json` (parent dir, outside repo) holds a plaintext Discord selfbot token — never commit; treat as throwaway.
- `.gitignore` already covers `api-keys.txt`, `.env.comfyicu`, `Created.txt`, `Auto-Gmail-Creator/`.

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
