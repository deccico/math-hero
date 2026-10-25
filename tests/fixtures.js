// Fixtures and helpers shared by the spec files.
const { test: base, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const MAX_QUESTIONS = 10;
// A problem as displayed: "12 - 7" or "8 + 5".
const PROBLEM_PATTERN = /^(\d+) ([+-]) (\d+)$/;

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
