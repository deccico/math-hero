const {
  test, expect, MAX_QUESTIONS, parseProblem, solve, readProblem, answer, answerCorrectly, loadedFonts,
} = require('./fixtures');

// Answers every question of the round, waiting for each one to advance before the next.
// Questions numbered in `miss` (from 1) get one wrong answer first; returns those problems.
async function finishGame(page, { miss = [], length = MAX_QUESTIONS } = {}) {
  const missed = [];
  for (let question = 1; question <= length; question++) {
    if (miss.includes(question)) {
      const problem = await readProblem(page);
      missed.push(`${problem.a} ${problem.op} ${problem.b}`);
      await answer(page, solve(problem) + 1);
    }
    await answerCorrectly(page);
    if (question < length) {
      await expect(page.locator('#questionCount')).toHaveText(String(question + 1));
    }
  }
  await expect(page.locator('#celebrationScreen')).toBeVisible();
  return missed;
}

// The problems listed for review on the results screen, as "13 - 5".
async function reviewedProblems(page) {
  return page.locator('#reviewList li').evaluateAll((items) => items.map((item) => item.dataset.problem));
}

// Generates many problems with the current settings and returns them parsed.
async function sampleProblems(page, count) {
  const texts = await page.evaluate((n) => {
    const seen = [];
    for (let i = 0; i < n; i++) {
      generateProblem();
      seen.push(document.getElementById('problemDisplay').textContent);
    }
    return seen;
  }, count);
  return texts.map(parseProblem);
}

function crossesTen({ a, op, b }) {
  return op === '+' ? (a % 10) + (b % 10) >= 10 : (a % 10) < (b % 10);
}

async function openSettings(page) {
  await page.locator('#settingsBtn').click();
  await expect(page.locator('#settingsScreen')).toBeVisible();
}

// Types a number into a settings box and leaves it, which applies the change.
async function setNumber(page, id, value) {
  await page.locator(`#${id}`).fill(String(value));
  await page.locator(`#${id}`).press('Tab');
}

// Sets both ends of a range ('first' or 'second'), lowest first.
async function setRange(page, which, lowest, highest) {
  await setNumber(page, `${which}Min`, lowest);
  await setNumber(page, `${which}Max`, highest);
}

// Ticks exactly the given operations ('subtract', 'add').
async function setOperations(page, ...keys) {
  for (const key of keys) await page.locator(`#${key}Toggle`).check();
  for (const key of ['subtract', 'add'].filter((k) => !keys.includes(k))) {
    await page.locator(`#${key}Toggle`).uncheck();
  }
}

// Tailwind and the Fredoka font are bundled in site/, so the page needs no other site.
test('loads its script, styles and font from its own site only', async ({ page, requests }) => {
  await expect(page.locator('script[src]')).toHaveCount(1);
  await expect(page.locator('script[src="app.js"]')).toHaveCount(1);
  await expect(page.locator('link[rel="stylesheet"][href="tailwind.css"]')).toHaveCount(1);
  await expect(page.locator('#problemDisplay')).toHaveCSS('font-weight', '700');

  expect(await loadedFonts(page)).toContain('Fredoka');
  expect(requests.filter((url) => !url.startsWith('file:'))).toEqual([]);
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
  const problem = await readProblem(page);

  await answer(page, solve(problem) + 1);

  await expect(page.locator('#answerInput')).toHaveClass(/animate-shake/);
  await expect(page.locator('#streakCount')).toHaveText('0');
  await expect(page.locator('#totalCount')).toHaveText('1');
  await expect(page.locator('#questionCount')).toHaveText('2');
  await expect(page.locator('#problemDisplay')).toHaveText(`${problem.a} ${problem.op} ${problem.b}`);
});

test('a right answer counts as soon as it is typed, without Enter', async ({ page }) => {
  await openSettings(page);
  // Additions that carry always have a two-digit answer, so the first digit alone must not count.
  await setOperations(page, 'add');
  await page.locator('#settingsDoneBtn').click();
  const digits = String(solve(await readProblem(page)));

  await page.locator('#answerInput').pressSequentially(digits[0]);
  await expect(page.locator('#questionCount')).toHaveText('1');
  await page.locator('#answerInput').pressSequentially(digits[1]);

  await expect(page.locator('#questionCount')).toHaveText('2');
  await expect(page.locator('#totalCount')).toHaveText('1');
});

test('a wrong answer waits for Enter', async ({ page }) => {
  await answerCorrectly(page);
  await expect(page.locator('#questionCount')).toHaveText('2');
  const wrong = String(solve(await readProblem(page)) + 1);

  await page.locator('#answerInput').pressSequentially(wrong);
  await expect(page.locator('#answerInput')).not.toHaveClass(/animate-shake/);
  await expect(page.locator('#streakCount')).toHaveText('1');

  await page.locator('#answerInput').press('Enter');
  await expect(page.locator('#answerInput')).toHaveClass(/animate-shake/);
  await expect(page.locator('#streakCount')).toHaveText('0');
});

// The Check button does what Enter does, for keyboards without Enter (the iPhone number keypad).
test('the Check button marks a wrong answer, like Enter', async ({ page }) => {
  await answerCorrectly(page);
  await expect(page.locator('#questionCount')).toHaveText('2');
  await page.locator('#answerInput').fill(String(solve(await readProblem(page)) + 1));

  await page.locator('#checkBtn').click();

  await expect(page.locator('#answerInput')).toHaveClass(/animate-shake/);
  await expect(page.locator('#streakCount')).toHaveText('0');
  await expect(page.locator('#answerInput')).toBeFocused();
});

test('the Check button ignores an empty answer box', async ({ page }) => {
  await page.locator('#checkBtn').click();

  await expect(page.locator('#answerInput')).not.toHaveClass(/animate-shake/);
  await expect(page.locator('#questionCount')).toHaveText('1');
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
  await expect(page.locator('#settingsBtn')).toBeHidden();
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

test('the results show the first-try score, the time and the problems that needed more tries', async ({ page }) => {
  const missed = await finishGame(page, { miss: [1, 4] });

  await expect(page.locator('#resultScore')).toHaveText('8 of 10 right first time');
  await expect(page.locator('#resultTime')).toHaveText(/^Time: \d+:\d{2}$/);
  expect(await reviewedProblems(page)).toEqual(missed);
  await expect(page.locator('#reviewList li').first()).toContainText('You tried');
  await expect(page.locator('#practiceBtn')).toBeVisible();
});

test('a perfect game has nothing to review', async ({ page }) => {
  await finishGame(page);

  await expect(page.locator('#resultScore')).toHaveText('10 of 10 right first time');
  await expect(page.locator('#reviewBox')).toBeHidden();
  await expect(page.locator('#practiceBtn')).toBeHidden();
});

test('a question that took much longer than the rest is in the review', async ({ page }) => {
  // Started 30 seconds ago, against about a second for the others.
  await page.evaluate(() => { question.startedAt -= 30_000; });
  const slow = await readProblem(page);

  await finishGame(page);

  await expect(page.locator('#resultScore')).toHaveText('10 of 10 right first time');
  expect(await reviewedProblems(page)).toEqual([`${slow.a} ${slow.op} ${slow.b}`]);
  await expect(page.locator('#reviewList li')).toContainText('Took 30 s');
});

test('Practice these again asks exactly the problems to review, until none are left', async ({ page }) => {
  const missed = await finishGame(page, { miss: [2, 5, 9] });

  await page.locator('#practiceBtn').click();
  await expect(page.locator('#roundLabel')).toHaveText('Practice');
  await expect(page.locator('#questionTotal')).toHaveText('3');
  const asked = [];
  for (let question = 1; question <= 3; question++) {
    const problem = await readProblem(page);
    asked.push(`${problem.a} ${problem.op} ${problem.b}`);
    // Miss the first practice problem again.
    if (question === 1) await answer(page, solve(problem) + 1);
    await answerCorrectly(page);
    if (question < 3) await expect(page.locator('#questionCount')).toHaveText(String(question + 1));
  }
  expect([...asked].sort()).toEqual([...missed].sort());
  await expect(page.locator('#resultScore')).toHaveText('2 of 3 right first time');
  expect(await reviewedProblems(page)).toEqual([asked[0]]);

  await page.locator('#practiceBtn').click();
  await expect(page.locator('#questionTotal')).toHaveText('1');
  await answerCorrectly(page);
  await expect(page.locator('#resultScore')).toHaveText('1 of 1 right first time');
  await expect(page.locator('#practiceBtn')).toBeHidden();

  await page.locator('#playAgainBtn').click();
  await expect(page.locator('#roundLabel')).toHaveText('Question');
  await expect(page.locator('#questionTotal')).toHaveText(String(MAX_QUESTIONS));
});

test('changing a setting during practice starts a fresh game', async ({ page }) => {
  await finishGame(page, { miss: [1] });
  await page.locator('#practiceBtn').click();

  await openSettings(page);
  await page.locator('#addToggle').check();
  await page.locator('#settingsDoneBtn').click();

  await expect(page.locator('#roundLabel')).toHaveText('Question');
  await expect(page.locator('#questionCount')).toHaveText('1');
  await expect(page.locator('#questionTotal')).toHaveText(String(MAX_QUESTIONS));
});

test('default settings give teen subtractions that need borrowing', async ({ page }) => {
  for (const problem of await sampleProblems(page, 200)) {
    expect(problem.op).toBe('-');
    expect(problem.a).toBeGreaterThanOrEqual(11);
    expect(problem.a).toBeLessThanOrEqual(19);
    expect(problem.b).toBeGreaterThanOrEqual(1);
    expect(problem.b).toBeLessThanOrEqual(9);
    expect(crossesTen(problem)).toBe(true);
  }

  await openSettings(page);
  await expect(page.locator('#subtractToggle')).toBeChecked();
  await expect(page.locator('#addToggle')).not.toBeChecked();
  await expect(page.locator('#crossTenToggle')).toBeChecked();
  for (const [id, value] of [['firstMin', '11'], ['firstMax', '19'], ['secondMin', '1'], ['secondMax', '9']]) {
    await expect(page.locator(`#${id}`)).toHaveValue(value);
  }
});

test('the gear opens the settings, and Done returns to the same question', async ({ page }) => {
  await answerCorrectly(page);
  await expect(page.locator('#questionCount')).toHaveText('2');

  await openSettings(page);
  await expect(page.locator('#gameScreen')).toBeHidden();
  // Clicking a box in the settings must not send the focus back to the answer box.
  await page.locator('#firstMax').click();
  await expect(page.locator('#firstMax')).toBeFocused();

  await page.locator('#settingsDoneBtn').click();
  await expect(page.locator('#settingsScreen')).toBeHidden();
  await expect(page.locator('#gameScreen')).toBeVisible();
  await expect(page.locator('#questionCount')).toHaveText('2');
  await expect(page.locator('#answerInput')).toBeFocused();
});

test('addition only gives additions that carry, within the ranges', async ({ page }) => {
  await openSettings(page);
  await setOperations(page, 'add');
  await setRange(page, 'first', 5, 30);
  await setRange(page, 'second', 3, 8);

  const problems = await sampleProblems(page, 200);
  for (const problem of problems) {
    expect(problem.op).toBe('+');
    expect(problem.a).toBeGreaterThanOrEqual(5);
    expect(problem.a).toBeLessThanOrEqual(30);
    expect(problem.b).toBeGreaterThanOrEqual(3);
    expect(problem.b).toBeLessThanOrEqual(8);
    expect(crossesTen(problem)).toBe(true);
  }
});

test('an addition answered correctly scores', async ({ page }) => {
  await openSettings(page);
  await setOperations(page, 'add');
  await page.locator('#settingsDoneBtn').click();
  expect((await readProblem(page)).op).toBe('+');

  await answerCorrectly(page);

  await expect(page.locator('#questionCount')).toHaveText('2');
  await expect(page.locator('#totalCount')).toHaveText('1');
});

test('with both operations ticked, additions and subtractions mix', async ({ page }) => {
  await openSettings(page);
  await setOperations(page, 'subtract', 'add');

  const problems = await sampleProblems(page, 200);
  const additions = problems.filter((problem) => problem.op === '+').length;
  expect(additions).toBeGreaterThan(50);
  expect(additions).toBeLessThan(150);
  for (const problem of problems) {
    expect(crossesTen(problem)).toBe(true);
    expect(solve(problem)).toBeGreaterThanOrEqual(0);
  }
});

test('without crossing ten, some problems need no borrowing or carrying', async ({ page }) => {
  await openSettings(page);
  await setOperations(page, 'subtract', 'add');
  await setRange(page, 'first', 20, 30);
  await setRange(page, 'second', 10, 15);
  await page.locator('#crossTenToggle').uncheck();

  const problems = await sampleProblems(page, 200);
  for (const problem of problems) {
    expect(problem.a).toBeGreaterThanOrEqual(20);
    expect(problem.a).toBeLessThanOrEqual(30);
    expect(problem.b).toBeGreaterThanOrEqual(10);
    expect(problem.b).toBeLessThanOrEqual(15);
  }
  expect(problems.some(crossesTen)).toBe(true);
  expect(problems.some((problem) => !crossesTen(problem))).toBe(true);
});

test('subtraction answers are never negative', async ({ page }) => {
  await openSettings(page);
  await page.locator('#crossTenToggle').uncheck();
  await setRange(page, 'first', 0, 9);
  await setRange(page, 'second', 0, 9);

  const problems = await sampleProblems(page, 300);
  for (const problem of problems) {
    expect(solve(problem)).toBeGreaterThanOrEqual(0);
  }
  expect(problems.some((problem) => solve(problem) === 0)).toBe(true);
});

test('the same problem is not asked twice in a row', async ({ page }) => {
  await openSettings(page);
  // Only 11 - 2 and 11 - 3 fit.
  await setRange(page, 'first', 11, 11);
  await setRange(page, 'second', 2, 3);

  const texts = (await sampleProblems(page, 50)).map(({ a, op, b }) => `${a} ${op} ${b}`);
  expect(new Set(texts)).toEqual(new Set(['11 - 2', '11 - 3']));
  for (let i = 1; i < texts.length; i++) {
    expect(texts[i]).not.toBe(texts[i - 1]);
  }
});

test('moving one end of a range past the other moves the other end too', async ({ page }) => {
  await openSettings(page);

  await setNumber(page, 'firstMax', 5);
  await expect(page.locator('#firstMin')).toHaveValue('5');

  await setNumber(page, 'secondMin', 40);
  await expect(page.locator('#secondMax')).toHaveValue('40');
});

test('numbers are kept between 0 and 99', async ({ page }) => {
  await openSettings(page);
  await page.locator('#crossTenToggle').uncheck();

  await setNumber(page, 'firstMax', 150);
  await expect(page.locator('#firstMax')).toHaveValue('99');
  await setNumber(page, 'secondMin', -4);
  await expect(page.locator('#secondMin')).toHaveValue('0');
});

test('a number left blank keeps its previous value', async ({ page }) => {
  await openSettings(page);

  await setNumber(page, 'firstMax', '');

  await expect(page.locator('#firstMax')).toHaveValue('19');
});

test('the last ticked operation cannot be unticked', async ({ page }) => {
  await openSettings(page);

  // click, not uncheck: uncheck() itself fails when the box stays ticked.
  await page.locator('#subtractToggle').click();

  await expect(page.locator('#subtractToggle')).toBeChecked();
});

test('settings that allow no problem say why and cannot be closed', async ({ page }) => {
  await openSettings(page);
  await page.locator('#crossTenToggle').uncheck();
  await setRange(page, 'first', 0, 5);
  const before = await page.locator('#problemDisplay').textContent();

  // Now every second number is bigger than every first number, so no subtraction fits.
  await setNumber(page, 'secondMin', 6);

  await expect(page.locator('#settingsWarning')).toBeVisible();
  await expect(page.locator('#settingsWarning')).toContainText('No problems fit these settings');
  await expect(page.locator('#settingsDoneBtn')).toBeDisabled();
  expect(await page.locator('#problemDisplay').textContent()).toBe(before);

  await setNumber(page, 'secondMin', 0);

  await expect(page.locator('#settingsWarning')).toBeHidden();
  await expect(page.locator('#settingsDoneBtn')).toBeEnabled();
});

test('when one operation has no problems, the settings say only the other appears', async ({ page }) => {
  await openSettings(page);
  await setOperations(page, 'subtract', 'add');
  await page.locator('#crossTenToggle').uncheck();
  await setRange(page, 'first', 0, 5);
  await setRange(page, 'second', 6, 9);

  await expect(page.locator('#settingsWarning')).toHaveText(
    'No subtraction problems fit these settings, so only addition will appear.',
  );
  await expect(page.locator('#settingsDoneBtn')).toBeEnabled();
  for (const problem of await sampleProblems(page, 50)) {
    expect(problem.op).toBe('+');
  }
});

test('settings are remembered after a reload', async ({ page }) => {
  await openSettings(page);
  await setOperations(page, 'add');
  await setRange(page, 'first', 30, 40);
  await page.locator('#crossTenToggle').uncheck();

  await page.reload();

  for (const problem of await sampleProblems(page, 50)) {
    expect(problem.op).toBe('+');
    expect(problem.a).toBeGreaterThanOrEqual(30);
    expect(problem.a).toBeLessThanOrEqual(40);
  }
  await openSettings(page);
  await expect(page.locator('#addToggle')).toBeChecked();
  await expect(page.locator('#subtractToggle')).not.toBeChecked();
  await expect(page.locator('#crossTenToggle')).not.toBeChecked();
  await expect(page.locator('#firstMin')).toHaveValue('30');
  await expect(page.locator('#firstMax')).toHaveValue('40');
});

test('unreadable saved settings fall back to the defaults', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('math-hero-settings', '{not json'));

  await page.reload();

  await openSettings(page);
  await expect(page.locator('#firstMin')).toHaveValue('11');
  await expect(page.locator('#subtractToggle')).toBeChecked();
});
