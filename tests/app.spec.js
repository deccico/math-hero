const { test: base, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const APP_URL = pathToFileURL(path.join(__dirname, '..', 'site', 'index.html')).href;
const MAX_QUESTIONS = 10;

// Every test starts on a fresh app and fails if the page threw or logged an error.
const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(APP_URL);
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

// Answers every question, waiting for each one to advance before the next.
async function finishGame(page) {
  for (let question = 1; question <= MAX_QUESTIONS; question++) {
    await answerCorrectly(page);
    if (question < MAX_QUESTIONS) {
      await expect(page.locator('#questionCount')).toHaveText(String(question + 1));
    }
  }
  await expect(page.locator('#celebrationScreen')).toBeVisible();
}

// Generates many problems with the current settings and returns their operands.
async function sampleProblems(page, count) {
  const texts = await page.evaluate((n) => {
    const seen = [];
    for (let i = 0; i < n; i++) {
      generateProblem();
      seen.push(document.getElementById('problemDisplay').textContent);
    }
    return seen;
  }, count);
  return texts.map((text) => text.split(' - ').map(Number));
}

// An unpinned CDN URL can change what the page runs without a commit here.
test('loads every external script from an exact version', async ({ page }) => {
  const sources = await page.locator('script[src]').evaluateAll((scripts) => scripts.map((s) => s.src));
  expect(sources.length).toBeGreaterThan(0);
  for (const src of sources) {
    expect(src).toMatch(/\/\d+\.\d+\.\d+$/);
  }
});

test('starts on question 1 with an empty scoreboard', async ({ page }) => {
  await expect(page.locator('#questionCount')).toHaveText('1');
  await expect(page.locator('#streakCount')).toHaveText('0');
  await expect(page.locator('#totalCount')).toHaveText('0');
  await expect(page.locator('#problemDisplay')).toHaveText(/^\d{2} - \d$/);
  await expect(page.locator('#answerInput')).toBeFocused();
});

test('a correct answer scores and moves to the next question', async ({ page }) => {
  await answerCorrectly(page);

  await expect(page.locator('#streakCount')).toHaveText('1');
  await expect(page.locator('#totalCount')).toHaveText('1');
  await expect(page.locator('#questionCount')).toHaveText('2');
  await expect(page.locator('#answerInput')).toHaveValue('');
});

test('a wrong answer shakes, resets the streak and stays on the question', async ({ page }) => {
  await answerCorrectly(page);
  await expect(page.locator('#questionCount')).toHaveText('2');
  const { a, b } = await readProblem(page);

  await answer(page, a - b + 1);

  await expect(page.locator('#answerInput')).toHaveClass(/animate-shake/);
  await expect(page.locator('#streakCount')).toHaveText('0');
  await expect(page.locator('#totalCount')).toHaveText('1');
  await expect(page.locator('#questionCount')).toHaveText('2');
  await expect(page.locator('#problemDisplay')).toHaveText(`${a} - ${b}`);
});

test('pressing Enter twice on a correct answer counts it once', async ({ page }) => {
  await answerCorrectly(page);
  await page.locator('#answerInput').press('Enter');

  await expect(page.locator('#totalCount')).toHaveText('1');
  await expect(page.locator('#streakCount')).toHaveText('1');
  await expect(page.locator('#answerInput')).toHaveValue('');
  await expect(page.locator('#questionCount')).toHaveText('2');
});

test('finishing all questions shows the celebration inside the card', async ({ page }) => {
  await finishGame(page);

  await expect(page.locator('#appCard #celebrationScreen')).toBeVisible();
  await expect(page.locator('#gameScreen')).toBeHidden();
  await expect(page.locator('#problemDisplay')).toBeHidden();
  await expect(page.locator('#answerInput')).toBeHidden();
  await expect(page.locator('#teensToggle')).toBeHidden();
  await expect(page.locator('#totalCount')).toHaveText(String(MAX_QUESTIONS));
});

test('play again restarts at question 1 and keeps the solved total', async ({ page }) => {
  await finishGame(page);

  await page.locator('#playAgainBtn').click();

  await expect(page.locator('#celebrationScreen')).toBeHidden();
  await expect(page.locator('#gameScreen')).toBeVisible();
  await expect(page.locator('#questionCount')).toHaveText('1');
  await expect(page.locator('#streakCount')).toHaveText('0');
  await expect(page.locator('#totalCount')).toHaveText(String(MAX_QUESTIONS));
  await expect(page.locator('#answerInput')).toBeFocused();
});

test('default settings give teen problems that need borrowing', async ({ page }) => {
  for (const [a, b] of await sampleProblems(page, 200)) {
    expect(a).toBeGreaterThanOrEqual(11);
    expect(a).toBeLessThanOrEqual(19);
    expect(b).toBeGreaterThanOrEqual(1);
    expect(b).toBeLessThanOrEqual(9);
    expect(a % 10).toBeLessThan(b);
  }
});

test('without the teens limit, problems use any two-digit number', async ({ page }) => {
  await page.locator('#teensToggle').uncheck();

  const problems = await sampleProblems(page, 200);
  for (const [a, b] of problems) {
    expect(a).toBeGreaterThanOrEqual(11);
    expect(a).toBeLessThanOrEqual(99);
    expect(a % 10).toBeLessThan(b);
  }
  expect(problems.some(([a]) => a >= 20)).toBe(true);
});

test('without the borrowing rule, some problems need no borrowing', async ({ page }) => {
  await page.locator('#borrowToggle').uncheck();

  const problems = await sampleProblems(page, 200);
  for (const [a, b] of problems) {
    expect(a).toBeGreaterThan(b);
  }
  expect(problems.some(([a, b]) => a % 10 >= b)).toBe(true);
});
