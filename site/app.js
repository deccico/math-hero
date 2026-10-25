// Math Hero: the game, its settings and offline support. Loaded as a classic script at the end of
// index.html, so the page's elements exist and the functions are globals the tests can call.

// App State
let currentA = 0;
let currentB = 0;
let currentOp = null;
let streak = 0;
let totalSolved = 0;
let currentQuestion = 1;
let advancing = false; // True while a correct answer waits for the next problem
let currentScreen = 'game';
const maxQuestions = 10;

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
const playAgainBtn = document.getElementById('playAgainBtn');
const checkBtn = document.getElementById('checkBtn');
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
    generateProblem();
  }
}

function showScreen(name) {
  for (const [key, screen] of Object.entries(screens)) {
    screen.classList.toggle('hidden', key !== name);
  }
  currentScreen = name;
}

// Logic to generate the next math problem based on the settings
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
  } while (total > 1 && op === currentOp && a === currentA && b === currentB);

  currentA = a;
  currentB = b;
  currentOp = op;

  // Update UI
  problemDisplay.textContent = `${currentA} ${currentOp.symbol} ${currentB}`;
  answerInput.value = '';
  answerInput.focus();
}

// Handle correct answer visually
function handleSuccess() {
  advancing = true;
  streak++;
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

    if (currentQuestion >= maxQuestions) {
      showScreen('celebration');
    } else {
      currentQuestion++;
      questionCount.textContent = currentQuestion;
      generateProblem();
    }
  }, 350);
}

// Handle wrong answer visually
function handleError() {
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
  return answer === currentOp.solve(currentA, currentB);
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
    handleError();
  }
}

answerInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitAnswer();
});

// Keep the focus, and the on-screen keyboard, on the answer box when Check is tapped
checkBtn.addEventListener('mousedown', (e) => e.preventDefault());
checkBtn.addEventListener('click', submitAnswer);

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

// Handle Play Again button click
playAgainBtn.addEventListener('click', () => {
  currentQuestion = 1;
  streak = 0;
  questionCount.textContent = currentQuestion;
  streakCount.textContent = streak;

  showScreen('game');

  generateProblem();
});

// During a game, keep the answer box focused when the background is clicked
document.body.addEventListener('click', (e) => {
  if (currentScreen === 'game' && !e.target.closest('button, input, label')) {
    answerInput.focus();
  }
});

// Initialize the first problem on load
generateProblem();

// Offline support (sw.js): the newest version when online, the stored one when offline.
// Service workers need http(s), so opening the file from disk skips this.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .catch((err) => console.error('Offline support unavailable:', err));
  });
}
