const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const { test: base, expect, PROBLEM_PATTERN, answerCorrectly, loadedFonts } = require('./fixtures');
const { startServer } = require('./static-server');

const SITE = path.join(__dirname, '..', 'site');

// Serves a fresh copy of site/ over HTTP for each test, so a test can publish a new version
// by editing the copy, and cut the network by stopping the server.
const test = base.extend({
  site: async ({}, use, testInfo) => {
    const root = testInfo.outputPath('site');
    fs.cpSync(SITE, root, { recursive: true });
    const server = await startServer(root);
    await use({ root, ...server });
    await server.stop();
  },
  appUrl: async ({ site }, use) => use(site.url),
});

// Waits until the service worker is active, which means its install stored every file.
async function waitForOfflineReady(page) {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
}

async function expectPlayable(page) {
  await expect(page.locator('#problemDisplay')).toHaveText(PROBLEM_PATTERN);
  await expect(page.locator('#celebrationScreen')).toBeHidden();
  expect(await loadedFonts(page)).toContain('Fredoka');
  await answerCorrectly(page);
  await expect(page.locator('#questionCount')).toHaveText('2');
}

// These tests reload to go offline: unlike goto, a reload revalidates with the server, so
// the browser's HTTP cache can't stand in for the service worker.

test('works offline after one visit', async ({ page, site }) => {
  await waitForOfflineReady(page);
  await site.stop();

  await page.reload();

  await expectPlayable(page);
});

test('shows a new version on the next visit, then keeps it for offline use', async ({ page, site }) => {
  await waitForOfflineReady(page);
  const index = path.join(site.root, 'index.html');
  fs.writeFileSync(index, fs.readFileSync(index, 'utf8').replace(/<title>[^<]*<\/title>/, '<title>Math Hero v2</title>'));

  // goto, not reload: the server's max-age=600 lets the browser reuse its old copy, so only
  // the service worker revalidating with the server finds the new version.
  await page.goto(site.url);
  await expect(page).toHaveTitle('Math Hero v2');

  await site.stop();
  await page.reload();
  await expect(page).toHaveTitle('Math Hero v2');
  await expectPlayable(page);
});

test('falls back to the stored version within seconds when the network never answers', async ({ page, site }) => {
  await waitForOfflineReady(page);
  site.hang();

  const started = Date.now();
  await page.reload({ timeout: 15_000 });

  // One network timeout for the whole page, not one per file.
  expect(Date.now() - started).toBeLessThan(5_000);
  await expectPlayable(page);
});

test('stores the manifest and icons for offline use', async ({ page }) => {
  await waitForOfflineReady(page);

  // The browser, not the page, fetches these, so only the install step stores them.
  const missing = await page.evaluate(async () => {
    const files = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
    const cache = await caches.open('math-hero');
    const stored = await Promise.all(files.map((file) => cache.match(file)));
    return files.filter((file, i) => !stored[i]);
  });
  expect(missing).toEqual([]);
});

// Playwright's usual contexts are incognito, where Chrome never offers to install an app,
// and the headless shell skips the check, so this needs a real profile and full Chromium.
test('Chrome finds the app installable', async ({ site }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser is enough for this check');
  const context = await chromium.launchPersistentContext(testInfo.outputPath('profile'), { channel: 'chromium' });
  try {
    const page = await context.newPage();
    await page.goto(site.url);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    const cdp = await context.newCDPSession(page);

    expect((await cdp.send('Page.getAppManifest')).errors).toEqual([]);
    expect((await cdp.send('Page.getInstallabilityErrors')).installabilityErrors).toEqual([]);
  } finally {
    await context.close();
  }
});
