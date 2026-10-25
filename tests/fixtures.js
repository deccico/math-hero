// Fixtures and helpers shared by the spec files.
const { test: base, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const MAX_QUESTIONS = 10;

// Every test starts on a fresh app and fails if the page threw or logged an error.
const test = base.extend({
  // Where the app is opened: from disk, unless a spec serves it over HTTP.
  appUrl: pathToFileURL(path.join(__dirname, '..', 'site', 'index.html')).href,
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
    await use(page);
    expect(errors).toEqual([]);
  },
});

// Reads the problem on screen ("12 - 7") as its two operands.
async function readProblem(page) {
  const text = await page.locator('#problemDisplay').textContent();
  const [a, b] = text.trim().split(' - ').map(Number);
  return { a, b };
}

async function answer(page, value) {
  await page.locator('#answerInput').fill(String(value));
  await page.locator('#answerInput').press('Enter');
}

async function answerCorrectly(page) {
  const { a, b } = await readProblem(page);
  await answer(page, a - b);
}

// Names of the font families the page has finished loading.
async function loadedFonts(page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter((font) => font.status === 'loaded').map((font) => font.family.replace(/["']/g, ''));
  });
}

module.exports = { test, expect, MAX_QUESTIONS, readProblem, answer, answerCorrectly, loadedFonts };
