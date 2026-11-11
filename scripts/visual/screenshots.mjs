// Captures full-page screenshots of the app (desktop + mobile) using the installed Microsoft Edge.
//   node scripts/visual/screenshots.mjs <outDir> <path> [path...]
// Example: node scripts/visual/screenshots.mjs ./shots / /create /pay/demo

import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const [outDir, ...paths] = process.argv.slice(2);
const BASE = process.env.BASE_URL || "http://localhost:3000";
if (!outDir || !paths.length) {
  console.error("usage: node scripts/visual/screenshots.mjs <outDir> <path> [path...]");
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: "msedge" });
const sizes = [
  { name: "desktop", viewport: { width: 1440, height: 900 } },
  { name: "mobile", viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 },
];
for (const s of sizes) {
  const ctx = await browser.newContext({ viewport: s.viewport, isMobile: s.isMobile, deviceScaleFactor: s.deviceScaleFactor ?? 1, locale: "en-US" });
  const page = await ctx.newPage();
  for (const p of paths) {
    await page.goto(BASE + p, { waitUntil: "networkidle", timeout: 90_000 });
    await page.waitForTimeout(1500); // let live quotes / client fetches settle
    const file = path.join(outDir, `${s.name}${p.replace(/[^a-z0-9]+/gi, "_") || "_home"}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(file);
  }
  await ctx.close();
}
await browser.close();
