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
  showResults(round.kind, round.questions, (Date.now() - round.startedAt) / 1000);
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
