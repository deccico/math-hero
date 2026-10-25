// Draws the app icons into site/icons/ by rendering HTML in Chromium and taking screenshots.
// Run with `npm run build:icons` after changing the design below; the PNGs are committed.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const SITE = path.join(__dirname, '..', 'site');
// Inlined: a page made with setContent is about:blank, which can't load file:// fonts.
const FONT = `data:font/woff2;base64,${fs.readFileSync(path.join(SITE, 'fonts', 'fredoka-latin-wght-normal.woff2')).toString('base64')}`;
const ICONS = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180], // iOS rounds the corners itself
];

// Full-bleed background, with the symbols inside the central 60%, so the same image also
// works as a maskable icon (Android may crop it to a circle of 80%).
function iconHtml(size) {
  return `<!doctype html>
<style>
  @font-face { font-family: Fredoka; src: url(${FONT}) format('woff2'); font-weight: 300 700; }
  html, body { margin: 0; }
  .icon {
    width: ${size}px; height: ${size}px; display: grid; place-items: center;
    background: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%);
  }
  .card {
    width: 60%; height: 60%; border-radius: 22%; background: #fff;
    display: flex; align-items: center; justify-content: center; gap: ${size * 0.04}px;
    box-shadow: 0 ${size * 0.02}px ${size * 0.06}px rgba(30, 41, 59, 0.25);
    font: 700 ${size * 0.3}px/1 Fredoka; color: #4f46e5;
  }
</style>
<div class="icon"><div class="card"><span>+</span><span>−</span></div></div>`;
}

(async () => {
  const browser = await chromium.launch();
  for (const [file, size] of ICONS) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(iconHtml(size));
    // Fail rather than quietly draw the symbols in a fallback font.
    const loaded = await page.evaluate(() => document.fonts.load('700 10px Fredoka', '+−').then((faces) => faces.length));
    if (!loaded) throw new Error('The Fredoka font did not load');
    await page.screenshot({ path: path.join(SITE, 'icons', file) });
    await page.close();
  }
  await browser.close();
})();
