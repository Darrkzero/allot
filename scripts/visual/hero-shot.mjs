// Captures the landing hero (with the WebGL coin scene) at a few moments in time.
//   node scripts/visual/hero-shot.mjs <outDir> [frames=3]
import { chromium } from "playwright-core";
import fs from "node:fs";

const [outDir, frames = "3"] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: Number(process.env.W || 1440), height: Number(process.env.H || 900) } });
page.on("console", (m) => { if (m.type() === "error") console.log("console error:", m.text().slice(0, 200)); });
page.on("pageerror", (e) => console.log("page error:", e.message.slice(0, 200)));
await page.goto((process.env.BASE_URL || "http://localhost:3000") + "/", { waitUntil: "networkidle", timeout: 90_000 });
await page.waitForTimeout(5000);
for (let i = 0; i < Number(frames); i++) {
  await page.screenshot({ path: `${outDir}/hero${i}.png` });
  console.log(`${outDir}/hero${i}.png`);
  await page.waitForTimeout(1500);
}
await browser.close();
