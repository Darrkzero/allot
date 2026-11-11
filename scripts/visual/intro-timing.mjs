// Measures the real intro timeline in-page (screenshots are too slow to time it).
//   node scripts/visual/intro-timing.mjs
import { chromium } from "playwright-core";

const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => {
  window.__t = { nav: performance.now() };
  new MutationObserver(() => {
    if (!window.__t.canvas && document.querySelector("canvas")) window.__t.canvas = performance.now();
  }).observe(document, { childList: true, subtree: true });
  window.addEventListener("allot:coins-landed", () => (window.__t.landed = performance.now()));
});
await page.goto((process.env.BASE_URL || "http://localhost:3000") + "/", { waitUntil: "load" });
await page.waitForFunction(() => window.__t.landed, null, { timeout: 30_000 });
const t = await page.evaluate(() => window.__t);
const ms = (x) => `${Math.round(x)} ms`;
console.log(`canvas appeared:  ${ms(t.canvas - t.nav)} after navigation`);
console.log(`coins landed:     ${ms(t.landed - t.canvas)} after canvas (intro length incl. first-frame prep)`);
await browser.close();
