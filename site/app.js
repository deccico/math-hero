// Math Hero: the game, its settings and offline support. Loaded as a classic script at the end of
// index.html, so the page's elements exist and the functions are globals the tests can call.

// App State
let streak = 0;
let totalSolved = 0;
let advancing = false; // True while a correct answer waits for the next problem
let currentScreen = 'game';
// The round being played: a game of new problems, or practice of problems to look at again.
// Its questions are the ones answered so far.
let round = null;
// The question on screen: { a, op, b, answer, wrong: [answers], hinted, revealed, startedAt, seconds }
let question = null;
const GAME_LENGTH = 10;
// A question is slow when it took longer than this, and more than twice the round's median
const SLOW_SECONDS = 10;
// Help when stuck: a hint is offered after this long on a question, and shown after this many
// wrong tries; the answer is shown after a few more
const HINT_AFTER_SECONDS = 20;
const HINT_AFTER_WRONG = 2;
const ANSWER_AFTER_WRONG = 3;

// Every finished round, kept on this device, oldest first
const HISTORY_KEY = 'math-hero-history';
const HISTORY_LIMIT = 100;
// The trend compares the older and newer halves of this many recent games with the current settings
const TREND_GAMES = 10;
const TREND_MIN_GAMES = 4;

// Settings, remembered on this device. The defaults are the original game: a teen minus one digit, with borrowing.
const SETTINGS_KEY = 'math-hero-settings';
const DEFAULT_SETTINGS = { subtract: true, add: false, firstMin: 11, firstMax: 19, secondMin: 1, secondMax: 9, crossTen: true };
const LOWEST_NUMBER = 0;
const HIGHEST_NUMBER = 99;
// Each number range, as its lowest and highest setting
const RANGES = [['firstMin', 'firstMax'], ['secondMin', 'secondMax']];
const OPERATIONS = [
  { key: 'subtract', symbol: '-', name: 'subtraction', solve: (a, b) => a - b },
  { key: 'add', symbol: '+', name: 'addition', solve: (a, b) => a + b },
];

// DOM Elements
const problemDisplay = document.getElementById('problemDisplay');
const answerInput = document.getElementById('answerInput');
const streakCount = document.getElementById('streakCount');
const totalCount = document.getElementById('totalCount');
const appCard = document.getElementById('appCard');
const questionCount = document.getElementById('questionCount');
const questionTotal = document.getElementById('questionTotal');
const roundLabel = document.getElementById('roundLabel');
const playAgainBtn = document.getElementById('playAgainBtn');
const practiceBtn = document.getElementById('practiceBtn');
const resultEmoji = document.getElementById('resultEmoji');
const resultTitle = document.getElementById('resultTitle');
const resultScore = document.getElementById('resultScore');
const resultTime = document.getElementById('resultTime');
const reviewBox = document.getElementById('reviewBox');
const reviewList = document.getElementById('reviewList');
const historyOverview = document.getElementById('historyOverview');
const historyList = document.getElementById('historyList');
const historyEmpty = document.getElementById('historyEmpty');
const historyDetail = document.getElementById('historyDetail');
const statGames = document.getElementById('statGames');
const statAccuracy = document.getElementById('statAccuracy');
const statPace = document.getElementById('statPace');
const trendText = document.getElementById('trendText');
const detailTitle = document.getElementById('detailTitle');
const detailSummary = document.getElementById('detailSummary');
const detailReview = document.getElementById('detailReview');
const checkBtn = document.getElementById('checkBtn');
const hintBtn = document.getElementById('hintBtn');
const hintText = document.getElementById('hintText');
const settingsBtn = document.getElementById('settingsBtn');
const settingsDoneBtn = document.getElementById('settingsDoneBtn');
const settingsWarning = document.getElementById('settingsWarning');
const screens = {
  game: document.getElementById('gameScreen'),
  settings: document.getElementById('settingsScreen'),
  celebration: document.getElementById('celebrationScreen'),
  progress: document.getElementById('progressScreen'),
};
// The form control for each setting
const settingControls = {
  subtract: document.getElementById('subtractToggle'),
  add: document.getElementById('addToggle'),
  firstMin: document.getElementById('firstMin'),
  firstMax: document.getElementById('firstMax'),
  secondMin: document.getElementById('secondMin'),
  secondMax: document.getElementById('secondMax'),
  crossTen: document.getElementById('crossTenToggle'),
};

// Generate a random integer between min and max (inclusive)
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Crossing ten means borrowing for a subtraction (12 - 7) and carrying for an addition (8 + 5)
function crossesTen(op, a, b) {
  return op.key === 'add' ? (a % 10) + (b % 10) >= 10 : (a % 10) < (b % 10);
}

// Every problem the settings allow for one operation, as [a, b] pairs
function problemsFor(op, s) {
  const problems = [];
  for (let a = s.firstMin; a <= s.firstMax; a++) {
    for (let b = s.secondMin; b <= s.secondMax; b++) {
      if (op.key === 'subtract' && a < b) continue; // Answers are never negative
      if (s.crossTen && !crossesTen(op, a, b)) continue;
      problems.push([a, b]);
    }
  }
  return problems;
}

// The ticked operations, each with the problems it allows
function problemPools(s) {
  return OPERATIONS.filter((op) => s[op.key]).map((op) => ({ op, problems: problemsFor(op, s) }));
}

// Makes settings usable: whole numbers within the limits, each range's lowest no higher than
// its highest (the end just edited stays put), and at least one operation ticked
function sanitizeSettings(s, editedKey) {
  const clean = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(clean)) {
    if (typeof clean[key] === 'boolean' && typeof s[key] === 'boolean') clean[key] = s[key];
    if (typeof clean[key] === 'number' && Number.isInteger(s[key])) {
      clean[key] = Math.min(HIGHEST_NUMBER, Math.max(LOWEST_NUMBER, s[key]));
    }
  }
  for (const [low, high] of RANGES) {
    if (clean[low] > clean[high]) {
      if (editedKey === high) clean[low] = clean[high];
      else clean[high] = clean[low];
    }
  }
  if (!clean.subtract && !clean.add) clean[editedKey === 'add' ? 'add' : 'subtract'] = true;
  return clean;
}

// Explains settings that leave an operation, or everything, without problems
function settingsProblem(s) {
  const pools = problemPools(s);
  const empty = pools.filter((pool) => pool.problems.length === 0);
  if (empty.length === pools.length) {
    return { usable: false, message: 'No problems fit these settings. Widen a range, or untick "Must cross ten".' };
  }
  if (empty.length > 0) {
    const other = pools.find((pool) => pool.problems.length > 0);
    return { usable: true, message: `No ${empty[0].op.name} problems fit these settings, so only ${other.op.name} will appear.` };
  }
  return { usable: true, message: '' };
}

function loadSettings() {
  try {
    const saved = sanitizeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {});
    if (settingsProblem(saved).usable) return saved;
  } catch (err) {
    console.warn('Saved settings could not be read, so the defaults are used:', err);
  }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Settings could not be saved on this device:', err);
  }
}

let settings = loadSettings();

function showSettingsInForm(s) {
  for (const [key, control] of Object.entries(settingControls)) {
    if (control.type === 'checkbox') control.checked = s[key];
    else control.value = s[key];
  }
  const { usable, message } = settingsProblem(s);
  settingsWarning.textContent = message;
  settingsWarning.classList.toggle('hidden', !message);
  settingsDoneBtn.disabled = !usable;
}

// Reads the form; a blank or unreadable number keeps the value in use
function readSettingsForm() {
  const s = {};
  for (const [key, control] of Object.entries(settingControls)) {
    if (control.type === 'checkbox') {
      s[key] = control.checked;
    } else {
      const value = parseInt(control.value, 10);
      s[key] = Number.isNaN(value) ? settings[key] : value;
    }
  }
  return s;
}

// Applies a settings change at once, unless it leaves no problem to ask
function handleSettingsChange(e) {
  const editedKey = Object.keys(settingControls).find((key) => settingControls[key] === e.target);
  const next = sanitizeSettings(readSettingsForm(), editedKey);
  showSettingsInForm(next);
  if (settingsProblem(next).usable) {
    settings = next;
    saveSettings();
    // Practice problems may not fit the new settings, so a change during practice starts a game
    if (round.kind === 'practice') startRound('game');
    else generateProblem();
  }
}

function showScreen(name) {
  for (const [key, screen] of Object.entries(screens)) {
    screen.classList.toggle('hidden', key !== name);
  }
  currentScreen = name;
}

function problemText({ a, op, b }) {
  return `${a} ${op} ${b}`;
}

// Puts a problem ({ a, op, b }) on screen as the question, replacing any unanswered one
function ask({ a, op, b }) {
  const operation = OPERATIONS.find((o) => o.symbol === op);
  question = { a, op, b, answer: operation.solve(a, b), wrong: [], hinted: false, revealed: false, startedAt: Date.now(), seconds: 0 };
  problemDisplay.textContent = problemText(question);
  hintBtn.classList.add('hidden');
  hintText.classList.add('hidden');
  answerInput.value = '';
  answerInput.focus();
}

// A hint that fits the problem: through ten when it crosses ten, counting for small numbers,
// otherwise tens and ones separately
function hintFor({ a, op, b }) {
  const add = op === '+';
  if (b === 0) return add ? `Adding 0 leaves ${a} as it is.` : `Taking away 0 leaves ${a} as it is.`;
  if (crossesTen(OPERATIONS.find((o) => o.symbol === op), a, b)) {
    if (add) {
      const toTen = 10 - (a % 10);
      return `Make ten first: ${a} + ${b} = ${a} + ${toTen} + ${b - toTen} = ${a + toTen} + ${b - toTen}`;
    }
    const ones = a % 10;
    return `Go down to ten first: ${a} - ${b} = ${a} - ${ones} - ${b - ones} = ${a - ones} - ${b - ones}`;
  }
  if (a < 10 && b < 10) {
    const steps = Array.from({ length: b }, (_, i) => (add ? a + i + 1 : a - i - 1));
    return `Count ${add ? 'on' : 'back'} ${b} from ${a}: ${steps.join(', ')}`;
  }
  const tens = (n) => n - (n % 10);
  const sum = (x, y) => (add ? x + y : x - y);
  return `Tens and ones: ${tens(a)} ${op} ${tens(b)} = ${sum(tens(a), tens(b))} and ${a % 10} ${op} ${b % 10} = ${sum(a % 10, b % 10)}`;
}

function showHelp(text) {
  hintText.textContent = text;
  hintText.classList.remove('hidden');
  hintBtn.classList.add('hidden');
}

// Shows a hint's label on one line and its steps below, wrapping only between steps ("= ..."),
// so a narrow screen never splits "30 - 13" across lines
function showHint() {
  question.hinted = true;
  const hint = hintFor(question);
  const colon = hint.indexOf(': ');
  const steps = hint.slice(colon + 2).split(' = ').map((step) => step.replace(/ /g, '\u00a0')).join(' = ');
  showHelp(`${hint.slice(0, colon + 1)}\n${steps}`);
}

function showAnswer() {
  question.revealed = true;
  showHelp(`The answer is ${question.answer}. Type it in to go on.`);
}

// Once a second: offer a hint when the question on screen has taken a while
function tick() {
  if (currentScreen !== 'game' || advancing || question.hinted || question.revealed) return;
  if (Date.now() - question.startedAt >= HINT_AFTER_SECONDS * 1000) hintBtn.classList.remove('hidden');
}

// Asks a new problem that fits the settings
function generateProblem() {
  const pools = problemPools(settings).filter((pool) => pool.problems.length > 0);
  const total = pools.reduce((sum, pool) => sum + pool.problems.length, 0);
  let op, a, b;
  // Pick the operation first, so a mixed game is half of each,
  // and never ask the same problem twice in a row when there is another
  do {
    const pool = pools[getRandomInt(0, pools.length - 1)];
    op = pool.op;
    [a, b] = pool.problems[getRandomInt(0, pool.problems.length - 1)];
  } while (total > 1 && question && op.symbol === question.op && a === question.a && b === question.b);
  ask({ a, op: op.symbol, b });
}

function shuffled(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = getRandomInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Starts a round: a game, or practice of the given problems in a random order
function startRound(kind, problems = []) {
  round = {
    kind,
    practice: shuffled(problems),
    length: kind === 'practice' ? problems.length : GAME_LENGTH,
    questions: [],
    startedAt: Date.now(),
  };
  streak = 0;
  streakCount.textContent = streak;
  roundLabel.textContent = kind === 'practice' ? 'Practice' : 'Question';
  questionTotal.textContent = round.length;
  nextQuestion();
}

function nextQuestion() {
  questionCount.textContent = round.questions.length + 1;
  if (round.kind === 'practice') ask(round.practice[round.questions.length]);
  else generateProblem();
}

// Right the first time, with no hint
function firstTry(q) {
  return q.wrong.length === 0 && !q.hinted && !q.revealed;
}

function median(values) {
  const sorted = [...values].sort((x, y) => x - y);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

// "7", "7 and 9", "7, 9 and 12"
function listAnswers(values) {
  return values.length === 1 ? String(values[0]) : `${values.slice(0, -1).join(', ')} and ${values[values.length - 1]}`;
}

// A problem asked more than once in a round, as one question: every wrong answer, any hint or
// answer shown, and its longest time
function mergeRepeats(questions) {
  const byProblem = new Map();
  for (const q of questions) {
    const seen = byProblem.get(problemText(q));
    byProblem.set(problemText(q), !seen ? q : {
      ...seen,
      wrong: [...new Set([...seen.wrong, ...q.wrong])],
      hinted: seen.hinted || q.hinted,
      revealed: seen.revealed || q.revealed,
      seconds: Math.max(seen.seconds, q.seconds),
    });
  }
  return [...byProblem.values()];
}

// The problems worth another look, each with why: not right first time, or much slower than
// the rest. A problem asked twice is listed once.
function reviewOf(questions) {
  const slow = Math.max(SLOW_SECONDS, 2 * median(questions.map((q) => q.seconds)));
  return mergeRepeats(questions).map((q) => {
    const reasons = [];
    if (q.wrong.length > 0) reasons.push(`You tried ${listAnswers(q.wrong)}`);
    if (q.hinted) reasons.push('Used a hint');
    if (q.revealed) reasons.push('Answer shown');
    if (q.seconds > slow) reasons.push(`Took ${Math.round(q.seconds)} s`);
    return { question: q, reasons };
  }).filter((item) => item.reasons.length > 0);
}

// "1:05"
function formatTime(seconds) {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function reviewItem({ question: q, reasons }) {
  const item = document.createElement('li');
  item.dataset.problem = problemText(q);
  item.className = 'flex items-center justify-between gap-3 rounded-2xl border-2 border-rose-100 bg-rose-50 px-4 py-2';
  const sum = document.createElement('span');
  sum.className = 'text-2xl font-bold text-slate-800 whitespace-nowrap';
  sum.textContent = `${problemText(q)} = ${q.answer}`;
  const why = document.createElement('span');
  why.className = 'text-sm font-semibold text-rose-700 text-right';
  why.textContent = reasons.join(' · ');
  item.append(sum, why);
  return item;
}

// Shows the results of a finished round, with the problems to practise
function showResults(kind, questions, seconds) {
  const right = questions.filter(firstTry).length;
  const total = questions.length;
  const perfect = right === total;
  round.review = reviewOf(questions);

  resultEmoji.textContent = perfect ? '🏆' : right >= total * 0.7 ? '🌟' : '💪';
  resultTitle.textContent = kind === 'practice' ? 'Practice done!' : perfect ? 'Perfect!' : 'You did it!';
  resultScore.textContent = `${right} of ${total} right first time`;
  resultTime.textContent = `Time: ${formatTime(seconds)}`;
  reviewList.replaceChildren(...round.review.map(reviewItem));
  reviewBox.classList.toggle('hidden', round.review.length === 0);
  practiceBtn.classList.toggle('hidden', round.review.length === 0);
  showScreen('celebration');
}

function finishRound() {
  const seconds = (Date.now() - round.startedAt) / 1000;
  saveToHistory(round, seconds);
  showResults(round.kind, round.questions, seconds);
}

// "Subtraction, 11-19 and 1-9, crossing ten"
function settingsSummary(s) {
  const operations = [s.subtract && 'subtraction', s.add && 'addition'].filter(Boolean).join(' and ');
  const ranges = `${s.firstMin}-${s.firstMax} and ${s.secondMin}-${s.secondMax}`;
  const summary = `${operations}, ${ranges}${s.crossTen ? ', crossing ten' : ''}`;
  return summary[0].toUpperCase() + summary.slice(1);
}

// Games with equal keys had the same kind of problems, so their scores and times compare
function settingsKey(s) {
  return JSON.stringify([s.subtract, s.add, s.firstMin, s.firstMax, s.secondMin, s.secondMax, s.crossTen]);
}

function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch (err) {
    console.warn('The saved progress could not be read, so it starts empty:', err);
    return [];
  }
}

function saveToHistory({ kind, questions }, seconds) {
  const record = {
    date: new Date().toISOString(),
    kind,
    label: kind === 'practice' ? 'Practice' : settingsSummary(settings),
    key: settingsKey(settings),
    seconds,
    questions: questions.map(({ startedAt, ...q }) => q),
  };
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([...loadHistory(), record].slice(-HISTORY_LIMIT)));
  } catch (err) {
    console.warn('This round could not be saved on this device:', err);
  }
}

// Right first time and time per question, over some saved rounds
function totals(records) {
  const questions = records.flatMap((r) => r.questions);
  const seconds = records.reduce((sum, r) => sum + r.seconds, 0);
  return {
    accuracy: questions.length ? `${Math.round((100 * questions.filter(firstTry).length) / questions.length)}%` : '-',
    pace: questions.length ? `${(seconds / questions.length).toFixed(1)} s` : '-',
  };
}

function trendFor(games) {
  const recent = games.filter((g) => g.key === settingsKey(settings)).slice(-TREND_GAMES);
  if (recent.length < TREND_MIN_GAMES) return 'Finish a few more games with these settings to see a trend.';
  const older = totals(recent.slice(0, Math.floor(recent.length / 2)));
  const newer = totals(recent.slice(Math.floor(recent.length / 2)));
  return `With these settings lately: ${older.accuracy} → ${newer.accuracy} right first time, ${older.pace} → ${newer.pace} per question.`;
}

function firstTryScore(questions) {
  return `${questions.filter(firstTry).length}/${questions.length}`;
}

function line(className, text) {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

function historyItem(record) {
  const item = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'w-full flex items-center justify-between gap-3 rounded-2xl border-2 border-slate-100 bg-slate-50 px-4 py-2 text-left hover:border-indigo-200 hover:bg-indigo-50 transition-colors';
  const what = document.createElement('span');
  what.className = 'flex flex-col';
  what.append(
    line('text-sm font-semibold text-slate-700', record.label),
    line('text-xs text-slate-400', new Date(record.date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })),
  );
  const score = document.createElement('span');
  score.className = 'flex flex-col items-end whitespace-nowrap';
  score.append(
    line('text-lg font-bold text-slate-800', firstTryScore(record.questions)),
    line('text-xs text-slate-400', formatTime(record.seconds)),
  );
  button.append(what, score);
  button.addEventListener('click', () => showHistoryDetail(record));
  item.append(button);
  return item;
}

function showHistoryDetail(record) {
  detailTitle.textContent = record.label;
  detailSummary.textContent = `${firstTryScore(record.questions)} right first time · Time: ${formatTime(record.seconds)}`;
  const review = reviewOf(record.questions);
  if (review.length) {
    detailReview.replaceChildren(...review.map(reviewItem));
  } else {
    const item = document.createElement('li');
    item.className = 'rounded-2xl border-2 border-emerald-100 bg-emerald-50 px-4 py-2 font-semibold text-emerald-800';
    item.textContent = 'Everything right first time!';
    detailReview.replaceChildren(item);
  }
  historyOverview.classList.add('hidden');
  historyDetail.classList.remove('hidden');
}

// The screen Back returns to from the progress screen
let progressReturn = 'game';

function showProgress() {
  const history = loadHistory();
  const games = history.filter((r) => r.kind === 'game');
  const all = totals(games);
  statGames.textContent = games.length;
  statAccuracy.textContent = all.accuracy;
  statPace.textContent = all.pace;
  trendText.textContent = trendFor(games);
  historyList.replaceChildren(...history.slice().reverse().map(historyItem));
  historyEmpty.classList.toggle('hidden', history.length > 0);
  historyOverview.classList.remove('hidden');
  historyDetail.classList.add('hidden');
  progressReturn = currentScreen;
  showScreen('progress');
}

// Handle correct answer visually
function handleSuccess() {
  advancing = true;
  question.seconds = (Date.now() - question.startedAt) / 1000;
  round.questions.push(question);
  // A hint keeps the streak going; being shown the answer does not
  streak = question.revealed ? 0 : streak + 1;
  totalSolved++;

  // Update score display
  streakCount.textContent = streak;
  totalCount.textContent = totalSolved;

  // Add success visual feedback
  appCard.classList.add('success-flash', 'animate-pop');

  // Remove visual feedback and generate new problem after a short delay
  setTimeout(() => {
    appCard.classList.remove('success-flash', 'animate-pop');
    advancing = false;

    if (round.questions.length >= round.length) {
      finishRound();
    } else {
      nextQuestion();
    }
  }, 350);
}

// Handle wrong answer visually
function handleError(wrongAnswer) {
  question.wrong.push(wrongAnswer);
  if (question.wrong.length >= ANSWER_AFTER_WRONG) showAnswer();
  else if (question.wrong.length >= HINT_AFTER_WRONG) showHint();
  streak = 0;
  streakCount.textContent = streak;

  // Remove animation class if it exists to allow re-triggering
  answerInput.classList.remove('animate-shake');

  // Trigger reflow to restart animation
  void answerInput.offsetWidth;

  // Add error animation
  answerInput.classList.add('animate-shake');

  // Select the text so the kid can easily type over their wrong answer
  answerInput.select();

  // Remove class after animation finishes
  setTimeout(() => {
    answerInput.classList.remove('animate-shake');
  }, 400);
}

// The typed answer, or NaN while the box is empty
function typedAnswer() {
  return parseInt(answerInput.value, 10);
}

function isRight(answer) {
  return answer === question.answer;
}

// A right answer counts as soon as it is typed; a wrong one only when Enter is pressed.
// While advancing, input is ignored, so one answer can't count twice.
answerInput.addEventListener('input', () => {
  if (!advancing && isRight(typedAnswer())) handleSuccess();
});

// Marks the typed answer right or wrong: on Enter, or the Check button where there is no Enter key
function submitAnswer() {
  if (advancing) return;
  const userAnswer = typedAnswer();

  // Ignore empty submissions
  if (isNaN(userAnswer)) return;

  if (isRight(userAnswer)) {
    handleSuccess();
  } else {
    handleError(userAnswer);
  }
}

answerInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitAnswer();
});

// Keep the focus, and the on-screen keyboard, on the answer box when Check or the hint is tapped
for (const button of [checkBtn, hintBtn]) {
  button.addEventListener('mousedown', (e) => e.preventDefault());
}
checkBtn.addEventListener('click', submitAnswer);
hintBtn.addEventListener('click', showHint);

// Settings: the gear opens them, Done goes back to the same question
for (const control of Object.values(settingControls)) {
  control.addEventListener('change', handleSettingsChange);
}

settingsBtn.addEventListener('click', () => {
  showSettingsInForm(settings);
  showScreen('settings');
});

settingsDoneBtn.addEventListener('click', () => {
  showScreen('game');
  answerInput.focus();
});

// Play Again starts a new game; Practice these again, a round of the problems under review
playAgainBtn.addEventListener('click', () => {
  showScreen('game');
  startRound('game');
});

document.getElementById('resultsProgressBtn').addEventListener('click', showProgress);
document.getElementById('settingsProgressBtn').addEventListener('click', showProgress);

// Back leaves an old round's review for the list, then the list for where it was opened from
document.getElementById('progressBackBtn').addEventListener('click', () => {
  if (!historyDetail.classList.contains('hidden')) {
    historyDetail.classList.add('hidden');
    historyOverview.classList.remove('hidden');
  } else {
    showScreen(progressReturn);
  }
});

practiceBtn.addEventListener('click', () => {
  showScreen('game');
  startRound('practice', round.review.map((item) => item.question));
});

// During a game, keep the answer box focused when the background is clicked
document.body.addEventListener('click', (e) => {
  if (currentScreen === 'game' && !e.target.closest('button, input, label')) {
    answerInput.focus();
  }
});

// Start the first game on load
startRound('game');
setInterval(tick, 1000);

// Offline support (sw.js): the newest version when online, the stored one when offline.
// Service workers need http(s), so opening the file from disk skips this.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .catch((err) => console.error('Offline support unavailable:', err));
  });
}
