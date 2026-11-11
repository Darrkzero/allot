// Scrolls the page like a visitor (so scroll-reveals fire), then takes a full-page screenshot.
//   node scripts/visual/scroll-shot.mjs <outFile> [path=/]
import { chromium } from "playwright-core";

const [outFile, path = "/"] = process.argv.slice(2);
const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto((process.env.BASE_URL || "http://localhost:3000") + path, { waitUntil: "load" });
await page.waitForTimeout(1500);
const height = await page.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < height; y += 300) {
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(160);
}
await page.waitForTimeout(3500); // let the last reveals and the typed terminal finish
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(400);
await page.screenshot({ path: outFile, fullPage: true });
console.log(outFile);
await browser.close();
