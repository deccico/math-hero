// Fixtures and helpers shared by the spec files.
const { test: base, expect } = require('@playwright/test');
const path = require('path');
const { startServer } = require('./static-server');

const MAX_QUESTIONS = 10;
// A problem as displayed: "12 - 7" or "8 + 5".
const PROBLEM_PATTERN = /^(\d+) ([+-]) (\d+)$/;

// Every test starts on a fresh app and fails if the page threw or logged an error.
const test = base.extend({
  // site/ served over HTTP the way GitHub Pages serves it, once per worker. Over file://, WebKit
  // refuses to load the manifest and logs an error, and the service worker can't run.
  siteServer: [async ({}, use) => {
    const server = await startServer(path.join(__dirname, '..', 'site'));
    await use(server);
    await server.stop();
  }, { scope: 'worker' }],
  // Where the app is opened; the offline tests serve their own copy of the site instead.
  appUrl: async ({ siteServer }, use) => use(siteServer.url),
  // Every URL the page requested, from the start of loading.
  requests: async ({}, use) => use([]),
  page: async ({ page, appUrl, requests }, use) => {
    const errors = [];
    page.on('request', (request) => requests.push(request.url()));
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(appUrl);
    // Let the service worker finish installing first: a reload in the middle of it makes WebKit
    // fail the registration, which the page reports as an error.
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await use(page);
    expect(errors).toEqual([]);
  },
});

// Splits a displayed problem ("12 - 7") into its numbers and operator.
function parseProblem(text) {
  const [, a, op, b] = text.trim().match(PROBLEM_PATTERN);
  return { a: Number(a), op, b: Number(b) };
}

function solve({ a, op, b }) {
  return op === '+' ? a + b : a - b;
}

async function readProblem(page) {
  return parseProblem(await page.locator('#problemDisplay').textContent());
}

async function answer(page, value) {
  await page.locator('#answerInput').fill(String(value));
  await page.locator('#answerInput').press('Enter');
}

async function answerCorrectly(page) {
  await answer(page, solve(await readProblem(page)));
}

// Names of the font families the page has finished loading.
async function loadedFonts(page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((font) => font.status === 'loaded').map((font) => font.family.replace(/["']/g, ''));
  });
}

module.exports = {
  test, expect, MAX_QUESTIONS, PROBLEM_PATTERN, parseProblem, solve, readProblem, answer, answerCorrectly, loadedFonts,
};
