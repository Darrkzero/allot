// Captures the landing intro at several moments and measures animation smoothness.
//   node scripts/visual/motion-check.mjs <outDir>
// Note: headless Edge may render WebGL in software, so absolute FPS is a lower bound.
import { chromium } from "playwright-core";
import fs from "node:fs";

const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log("page error:", e.message.slice(0, 200)));

await page.goto((process.env.BASE_URL || "http://localhost:3000") + "/", { waitUntil: "domcontentloaded" });
// Wait until the WebGL canvas exists, then capture the intro timeline from that moment.
await page.waitForSelector("canvas", { timeout: 60_000 });
const t0 = Date.now();
for (const at of [200, 800, 1500, 2300, 3400]) {
  const wait = at - (Date.now() - t0);
  if (wait > 0) await page.waitForTimeout(wait);
  await page.screenshot({ path: `${out}/intro-${at}ms.png` });
  console.log(`captured intro at ~${at}ms`);
}

// Frame timing over 4 s while the orbit runs and the mouse moves.
const stats = await page.evaluate(async () => {
  const times = [];
  let last = performance.now();
  const end = last + 4000;
  await new Promise((resolve) => {
    const tick = (now) => {
      times.push(now - last);
      last = now;
      if (now < end) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const slow = times.filter((t) => t > 34).length;
  return { frames: times.length, fps: Math.round(1000 / avg), slowFramesPct: Math.round((slow / times.length) * 100) };
});
console.log("frame stats:", JSON.stringify(stats));

// Interaction: move the mouse to a corner and scroll a bit, then capture.
await page.mouse.move(1300, 200, { steps: 10 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/pointer-tilt.png` });
await page.mouse.wheel(0, 420);
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/scrolled.png` });
console.log("captured interaction frames");
await browser.close();
