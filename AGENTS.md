# Threadz Project Memory

## Project
Premium Egyptian streetwear brand — Cloudflare Pages site. Shop, collections, journal, cart, auth, AI virtual try-on, order tracking with Bosta API.

## Stack
- Cloudflare Pages (wrangler) + Pages Functions (ES modules)
- KV namespace `ORDERS` for products, orders, users
- Static HTML/CSS/JS frontend (no framework)
- AI try-on via **Google Gemini image model (free tier)** — server-side proxy at `/api/tryon`
- **Puter.js** retained as client-side fallback if server fails

## AI Try-On Architecture
- `tryon.html` — Upload photo + select product → sends to `/api/tryon` (server proxy)
- `tryon.js`:
  1. Primary: `generateWithServer()` sends `person` file + `garment_url` to `/api/tryon`
  2. Fallback: if server fails, `generateWithPuter()` composites person+garment and calls `puter.ai.txt2img()`
- `functions/api/tryon.js` — Cloudflare Pages Function, **single provider: Google Gemini** (`gemini-3.1-flash-lite-image:generateContent`).
  - Free tier from Google AI Studio (free-for.dev "Major Cloud Providers"), no credit card.
  - All paid/credit-burning providers were removed 2026-08-12: ComfyICU (+ credit rotation), PiAPI/Kling, Fal, Segmind, LightX, RapidAPI, IDM-VTON/Gradio, Pollinations (now key-gated).
- `GEMINI_API_KEY` stored in `wrangler.toml` (only AI key left; not exposed to client).

## Key Files
| File | Purpose |
|------|---------|
| `tryon.html` / `tryon.js` | AI try-on page (server → Gemini, Puter.js fallback) |
| `functions/api/tryon.js` | Server try-on endpoint (Gemini only) |
| `functions/api/health.js` | Live health/status endpoint for uptime monitors |
| `functions/api/products.js` | Product CRUD (KV-backed) |
| `wrangler.toml` | Config with API keys, KV binding |
| `styles.css` | All site styles (~2800 lines) |
| `script.js` | Global JS (nav, scroll, cart) |
| `cart-data.js` | Cart state (localStorage) |
| `site-images.js` | Dynamic site image loader from /api/settings |
| `scripts/validate-tools.js` | Live read-only validation of all configured API keys |

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
| Uptime watchdog | healthchecks.io | 20 cron/heartbeats |
| Shop search | Algolia (Build) | 1M docs, 10k searches/mo |
| Web push | OneSignal | unlimited push + 10k emails/mo |
| Phone validation | veriphone | 1k req/mo |
| Edge DB (if KV limits bite) | Turso | 9GB, 500 DBs, 1B row reads/mo |
| Sessions / key index | Upstash Redis | 500k cmds/mo, 256MB |
| Full DB + auth alt | Supabase / Neon | free tier |
| Contact/quiz forms | Tally.so / HeyForm | unlimited |
| Logs | Axiom | 0.5TB, 30-day retention |

**Wired so far:** Resend order emails (env-gated in `create-shipment.js`). Health endpoint at `/api/health` for uptime monitors.

## Security Notes (IMPORTANT)
- `wrangler.toml` is committed and holds LIVE secrets: `BOSTA_API_KEY`, `JWT_SECRET`, `ADMIN_CODE`, `GEMINI_API_KEY`. (Paid AI keys were removed from the file 2026-08-12 — but they remain in git *history*; rotate them if the repo is/was public.)
  - Best practice: move keys to Pages encrypted secrets (`wrangler pages secret put <NAME>` or Dashboard → Pages → project → **Variables** → add as Secret), keep `wrangler.toml` blank.
- `..\config.json` (parent dir, outside repo) holds a plaintext Discord selfbot token — never commit; treat as throwaway.
- `.gitignore` covers `api-keys.txt`, `.env.comfyicu`, `Created.txt`, `Auto-Gmail-Creator/`, `.wrangler/`.

## Try-On credit model (2026-08-12)
- Single free provider: Google Gemini image model via `GEMINI_API_KEY` (free tier, no CC). No credit rotation needed anymore — ComfyICU/PiAPI/etc. and the account-farming pipeline were removed.
- `worker.js` still contains the old multi-provider logic and key references — **unused** (Pages deploys `functions/` only); kept as a reference, ignore.
- Legacy debug scripts (`scripts/debug_*.cjs`, `scripts/setup-comfyicu.cjs`) are untracked leftovers, not part of the site.

## Memory Instructions (for AI)
Every time a new session starts, read this file first. When making changes to the project, update this file to reflect:
- New files added
- Architecture changes
- New dependencies or config
- Any decisions or conventions established

At the end of each session, if any project-relevant changes were made, update this file and commit/push.
