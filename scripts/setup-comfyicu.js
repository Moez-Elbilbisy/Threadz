/**
 * ComfyICU Account Setup — Playwright Automation
 *
 * Automates signing up for ComfyICU with Google OAuth accounts and
 * extracting API keys. Run locally (NOT on Cloudflare).
 *
 * Prerequisites:
 *   npm install playwright
 *   npx playwright install chromium
 *
 * Reads Gmail accounts from Auto-Gmail-Creator's Created.txt first,
 * then falls back to .env.comfyicu or environment variables.
 *
 * Prerequisites:
 *   npm install playwright
 *   npx playwright install chromium
 *
 * Usage — chained with Auto-Gmail-Creator:
 *   git clone https://github.com/ai-to-ai/Auto-Gmail-Creator.git
 *   # Run Auto-Gmail-Creator to create Gmail accounts -> outputs Created.txt
 *   # Point this script to that output:
 *   node scripts/setup-comfyicu.js --gmail-dir ../Auto-Gmail-Creator
 *
 * Usage — manual accounts:
 *   set COMFYICU_EMAIL_1=youraccount1@gmail.com
 *   set COMFYICU_PASS_1=yourpassword1
 *   ... (up to 3)
 *   node scripts/setup-comfyicu.js
 *
 * Or use .env.comfyicu file:
 *   COMFYICU_EMAIL_1=...
 *   COMFYICU_PASS_1=...
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

// ── Read accounts ─────────────────────────────────────────────────────
function loadAccounts() {
  const accounts = [];

  // Priority 1: Auto-Gmail-Creator output (--gmail-dir flag or Auto-Gmail-Creator/)
  const gmailDir = process.argv.includes("--gmail-dir")
    ? process.argv[process.argv.indexOf("--gmail-dir") + 1]
    : path.join(__dirname, "..", "Auto-Gmail-Creator");

  const createdTxt = path.join(gmailDir, "Created.txt");
  if (fs.existsSync(createdTxt)) {
    const lines = fs.readFileSync(createdTxt, "utf-8").split("\n").filter(Boolean);
    for (let i = 0; i < lines.length && i < 3; i++) {
      const parts = lines[i].split("\t");
      if (parts.length >= 2) {
        const username = parts[0].trim();
        const password = parts[1].trim();
        accounts.push({
          email: username.includes("@") ? username : `${username}@gmail.com`,
          pass: password,
          index: accounts.length + 1,
        });
      }
    }
    if (accounts.length > 0) {
      console.log(`Loaded ${accounts.length} account(s) from ${createdTxt}`);
      return accounts;
    }
  }

  // Priority 2: .env.comfyicu file
  const envPath = path.join(__dirname, "..", ".env.comfyicu");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const m = line.trim().match(/^([^=]+)=(.*)$/);
      if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }

  for (let i = 1; i <= 3; i++) {
    const email = process.env[`COMFYICU_EMAIL_${i}`];
    const pass = process.env[`COMFYICU_PASS_${i}`];
    if (email && pass) accounts.push({ email, pass, index: i });
  }
  return accounts;
}

// ── OAuth automation ──────────────────────────────────────────────────
async function setupAccount(browser, { email, pass, index }) {
  const context = await browser.newContext({
    locale: "en-US",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  console.log(`\n[Account ${index}] Starting — ${email}`);

  try {
    // 1. Go to ComfyICU
    await page.goto("https://comfy.icu", { waitUntil: "networkidle", timeout: 30000 });

    // 2. Click "Continue with Google"
    const googleBtn = page.locator("button, a", { hasText: /Continue with Google/i });
    await googleBtn.waitFor({ timeout: 10000 });
    await googleBtn.click();
    console.log(`[Account ${index}] Clicked "Continue with Google"`);

    // 3. Handle Google OAuth — might open a popup or redirect
    let loginPage = page;
    const popupPromise = context.waitForEvent("page", { timeout: 5000 }).catch(() => null);
    const popup = await popupPromise;

    if (popup) {
      loginPage = popup;
      await popup.waitForLoadState("domcontentloaded");
      console.log(`[Account ${index}] Google OAuth opened in popup`);
    } else {
      // Might have redirected in the same tab
      await page.waitForURL(/accounts\.google\.com|signin\/oauth/, { timeout: 10000 });
      console.log(`[Account ${index}] Google OAuth redirected in same tab`);
    }

    // 4. Enter email
    await loginPage.waitForSelector('input[type="email"]', { timeout: 15000 });
    await loginPage.fill('input[type="email"]', email);
    await loginPage.click('button:has-text("Next"), button:has-text("Далее")');
    console.log(`[Account ${index}] Email entered`);

    // 5. Enter password
    await loginPage.waitForSelector('input[type="password"]', { timeout: 15000 });
    await loginPage.fill('input[type="password"]', pass);
    await loginPage.click('button:has-text("Next"), button:has-text("Далее")');
    console.log(`[Account ${index}] Password entered`);

    // 6. Handle post-login: "Confirm your account", permissions, etc.
    //    Google may show: "Google hasn't verified this app", "Continue", etc.
    //    Or "This sign-in was blocked" — can't handle that.
    //    Also possible: phone verification, CAPTCHA — needs manual intervention.
    await loginPage.waitForTimeout(3000);

    // Check for "Confirm your account" or permissions buttons
    try {
      const continueBtn = loginPage.locator('button, span', { hasText: /Continue|Confirm/i });
      if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await continueBtn.click();
        console.log(`[Account ${index}] Clicked Continue/Confirm`);
      }
    } catch { /* no such button */ }

    // 7. Wait for redirect back to comfy.icu
    console.log(`[Account ${index}] Waiting for redirect to ComfyICU...`);
    console.log(`[Account ${index}] >>> If Google requires verification, complete it manually in the browser <<<`);

    // Wait up to 2 minutes for the redirect back to comfy.icu
    let redirected = false;
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(2000);
      const url = page.url();
      if (url.startsWith("https://comfy.icu") && !url.includes("signin") && !url.includes("accounts")) {
        redirected = true;
        break;
      }
      // Check popup closed (redirected to main page)
      if (popup && popup.isClosed()) {
        const mainUrl = page.url();
        if (mainUrl.startsWith("https://comfy.icu")) {
          redirected = true;
          break;
        }
      }
    }

    if (!redirected) {
      // Try navigating directly in case OAuth completed silently
      await page.goto("https://comfy.icu/account", { waitUntil: "networkidle", timeout: 30000 });
    }

    // 8. Navigate to account settings
    await page.goto("https://comfy.icu/account", { waitUntil: "networkidle", timeout: 30000 });
    console.log(`[Account ${index}] On account page`);

    // 9. Extract API key — look for the key display on the page
    await page.waitForTimeout(3000);

    // Try different selectors to find the API key
    let apiKey = null;

    // Selector 1: pre/code element containing the key
    const keyEl = page.locator('pre, code, input[type="text"], [data-testid="api-key"]').first();
    if (await keyEl.isVisible({ timeout: 5000 }).catch(() => false)) {
      apiKey = (await keyEl.textContent()) || (await keyEl.inputValue());
    }

    // If no key displayed, look for "Create" or "Generate" button
    if (!apiKey) {
      const createBtn = page.locator('button, a', { hasText: /Create|Generate|New Key/i }).first();
      if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await createBtn.click();
        await page.waitForTimeout(3000);
        // Read the newly generated key
        const newKeyEl = page.locator('pre, code, input[type="text"], [class*="key"]').first();
        if (await newKeyEl.isVisible({ timeout: 3000 }).catch(() => false)) {
          apiKey = (await newKeyEl.textContent()) || (await newKeyEl.inputValue());
        }
      }
    }

    // Clean up whitespace
    if (apiKey) apiKey = apiKey.trim();

    // Fallback: copy from clipboard or let user see it
    if (!apiKey) {
      console.log(`[Account ${index}] Could not auto-extract API key.`);
      console.log(`[Account ${index}] The browser is open — please copy the key manually from https://comfy.icu/account`);
      await page.waitForTimeout(60000); // Give user 60s to copy it
      apiKey = await page.evaluate(() => {
        // Try to get it from the page
        const el = document.querySelector('pre, code, input[type="text"], [class*="key"], [class*="token"]');
        return el ? (el.textContent || el.value || "").trim() : null;
      });
    }

    await context.close();
    return apiKey;

  } catch (err) {
    console.error(`[Account ${index}] Error: ${err.message}`);
    await context.close().catch(() => {});
    return null;
  }
}

// ── Update wrangler.toml ──────────────────────────────────────────────
function updateWranglerConfig(keys) {
  const tomlPath = path.join(__dirname, "..", "wrangler.toml");
  let content = fs.readFileSync(tomlPath, "utf-8");

  // Replace each key
  const vars = [
    { key: "COMFYICU_API_KEY", index: 0 },
    { key: "COMFYICU_API_KEY_BACKUP_1", index: 1 },
    { key: "COMFYICU_API_KEY_BACKUP_2", index: 2 },
  ];

  for (const v of vars) {
    const val = keys[v.index] || "";
    if (val) {
      const regex = new RegExp(`(${v.key}\\s*=\\s*)"[^"]*"`, "i");
      if (regex.test(content)) {
        content = content.replace(regex, `$1"${val}"`);
      }
    }
  }

  fs.writeFileSync(tomlPath, content, "utf-8");
  console.log("\n✓ wrangler.toml updated with new API keys");
}

// ── Main ──────────────────────────────────────────────────────────────
async function main() {
  const accounts = loadAccounts();
  if (accounts.length === 0) {
    console.log("No accounts found. Set COMFYICU_EMAIL_1..3 and COMFYICU_PASS_1..3");
    console.log("Or create .env.comfyicu in the project root with:");
    console.log('  COMFYICU_EMAIL_1=youraccount1@gmail.com');
    console.log('  COMFYICU_PASS_1=yourpassword1');
    process.exit(1);
  }

  console.log(`Found ${accounts.length} account(s) to set up\n`);

  const browser = await chromium.launch({
    headless: false, // Required for Google OAuth — won't work headless
  });

  const keys = [];
  for (const account of accounts) {
    const key = await setupAccount(browser, account);
    if (key) {
      keys.push(key);
      console.log(`[Account ${account.index}] API key: ${key.substring(0, 16)}...`);
    } else {
      keys.push(null);
      console.log(`[Account ${account.index}] FAILED`);
    }
  }

  await browser.close();

  const validKeys = keys.filter(Boolean);
  if (validKeys.length > 0) {
    updateWranglerConfig(keys);
    console.log(`\nDone! ${validKeys.length} key(s) configured.`);
    console.log("Deploy to update Cloudflare:");
    console.log("  npx wrangler pages deploy . --branch=main");
  } else {
    console.log("\nNo keys were extracted. Check the errors above.");
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
