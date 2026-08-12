// Live read-only validation of every API key Threadz has configured.
// Run:  node scripts/validate-tools.js
// Exits nonzero if a "required" provider fails. Never burns AI credits or creates data.
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const toml = readFileSync(resolve("wrangler.toml"), "utf8");
const get = (key) => {
  const m = toml.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, "m"));
  return m ? m[1] : "";
};

const results = [];
const record = (name, status, detail = "") => results.push({ name, status, detail });

async function check(name, fn, required = true) {
  try {
    const ok = await fn();
    record(name, ok ? "PASS" : "FAIL", ok ? "" : "live check rejected");
  } catch (e) {
    record(name, "FAIL", e.message);
  }
}

const fetchJson = async (url, opts = {}, okCodes = [200, 201, 203]) => {
  const r = await fetch(url, opts);
  const body = await r.text();
  if (!okCodes.includes(r.status)) throw new Error(`${r.status} ${body.slice(0, 200)}`);
  return JSON.parse(body);
};

// ── Core: Bosta (POST-only API — live check would create a shipment) ────────
record("bosta", get("BOSTA_API_KEY") ? "SET" : "SKIP", get("BOSTA_API_KEY") ? "POST-only API; skipped live check" : "no key in wrangler.toml");

// ── Core: HuggingFace whoami ────────────────────────────────────────────────
{
  const key = get("HF_TOKEN");
  if (key) {
    await check("huggingface (GET /api/whoami-v2)", async () => {
      await fetchJson("https://huggingface.co/api/whoami-v2", {
        headers: { Authorization: `Bearer ${key}` },
      });
      return true;
    });
  } else record("huggingface", "SKIP", "no key");
}

// ── Gemini (read-only list models, free) ────────────────────────────────────
{
  const key = get("GEMINI_API_KEY");
  if (key) {
    await check("gemini (GET /v1beta/models)", async () => {
      await fetchJson(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      return true;
    });
  } else record("gemini", "SKIP", "no key");
}

// ── ComfyICU (read-only workflow fetch, does NOT queue a job) ───────────────
{
  const key = get("COMFYICU_API_KEY");
  const wf = get("COMFYICU_WORKFLOW_ID");
  if (key && wf) {
    await check("comfyicu (GET /api/v1/workflows/id — read-only)", async () => {
      const r = await fetch(`https://comfy.icu/api/v1/workflows/${wf}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      return r.ok; // 401/403 → invalid key, 200 → key valid
    });
  } else record("comfyicu", "SKIP", !key ? "no key" : "no workflow id");
}

// ── Presence-only providers (live check would burn credits) ──────────────────
for (const name of ["PIAPI_KEY", "SEGMIND_API_KEY", "LIGHTX_API_KEY", "RAPIDAPI_KEY"]) {
  record(name.toLowerCase(), get(name) ? "SET" : "SKIP", get(name) ? "" : "no key");
}

// ── Optional free-store keys (from free-for.dev sweep) — SET only when added ──
const resendKey = get("RESEND_API_KEY");
if (resendKey) {
  await check("resend (GET /keys)", async () => {
    await fetchJson("https://api.resend.com/keys", {
      headers: { Authorization: `Bearer ${resendKey}` },
    });
    return true;
  });
} else record("resend", "SKIP", "no RESEND_API_KEY yet — add to get order emails");

// ── Output ──────────────────────────────────────────────────────────────────
const pad = (s, n) => String(s).padEnd(n);
console.log("\nThreadz provider status\n" + "-".repeat(60));
for (const { name, status, detail } of results) {
  const color = status === "PASS" ? "\x1b[32m" : status === "FAIL" ? "\x1b[31m" : "\x1b[33m";
  console.log(`${color}${pad(status, 5)}\x1b[0m ${pad(name, 42)} ${detail}`);
}
console.log("-".repeat(60));

const failed = results.filter((r) => r.status === "FAIL");
if (failed.length) {
  process.exitCode = 1;
}