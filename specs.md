# Math Hero: rules

## Game
- A game is 10 questions. A correct answer scores and moves to the next question; a wrong one resets the streak and stays on the question. The solved total carries over between games.
- A right answer counts as soon as it is typed, with no Enter needed. A wrong answer counts only when Enter is pressed or the Check button is tapped (for keyboards with no Enter key, like the iPhone number keypad), so a half-typed answer (the 1 of 13) is never marked wrong.
- Typing and Enter are ignored while the app moves to the next question, so one answer never counts twice.

## Help when stuck
- After 20 seconds on a question, a "Need a hint?" button appears. After 2 wrong tries the hint shows by itself, and after 3 the answer shows ("The answer is 8. Type it in to go on."); the child types it to move on.
- The hint fits the problem:
  - crossing ten goes through ten: 13 - 5 = 13 - 3 - 2 = 10 - 2, and 8 + 5 = 8 + 2 + 3 = 10 + 3, also with a two-digit second number (32 - 15 = 32 - 2 - 13 = 30 - 13);
  - two one-digit numbers count on or back: Count back 3 from 7: 6, 5, 4;
  - otherwise tens and ones separately: 30 - 10 = 20 and 7 - 2 = 5;
  - adding or taking away 0 says the number stays as it is.
- A hint keeps the streak going (a wrong try has already reset it); a question whose answer was shown resets the streak to 0. Both stop the question counting as right first time.

## Results and practice
- A question is **right first time** when it was answered with no wrong try, no hint and no answer shown.
- At the end of a round the results show how many questions were right first time ("8 of 10 right first time") and the round's time, from its first question appearing to its last answer.
- **Look at these again** lists the questions that were not right first time, or were **slow**: more than 10 seconds, and more than twice the round's median time. Each shows its answer and why it is listed (the wrong answers tried, a hint, the answer shown, the time taken). A problem asked more than once in the round is listed once, with the reasons from every time it was asked.
- **Practice these again** starts a practice round of exactly the listed problems, in a random order, once each. Its results list whatever still needs another look, so practice repeats until everything is right first time. Play Again starts a fresh game.
- Changing a setting during practice ends it and starts a fresh game, since the practice problems may not fit the new settings.

## Progress
- Every finished round is saved on the device (`localStorage`, key `math-hero-history`), the latest 100 kept: its date, the settings it was played with, its time, and each question (the problem, wrong answers, hint, answer shown, time). Unreadable saved progress starts empty.
- The Progress screen opens from the results and from Settings, and Back returns there. It shows:
  - totals over games (practice rounds excluded): games played, the share of questions right first time, and the average time per question;
  - the trend for the current settings: of the latest 10 games played with the same problem settings, the older half against the newer half, once there are at least 4;
  - every saved round, newest first, including practice rounds. Opening one shows its review, the same as the results screen would have.

## Problems
- A problem is `first number - second number` or `first number + second number`.
- Subtraction answers are never negative; zero is allowed (7 - 7).
- **Crossing ten** means borrowing for a subtraction (the first number's ones digit is smaller than the second's: 12 - 7) and carrying for an addition (the ones digits add up to 10 or more: 8 + 5, 27 + 6). With "Must cross ten" ticked, every problem crosses ten; unticked, any problem may appear.
- With both operations ticked, each question picks the operation first, half and half, then a problem of that kind, so the mix stays even whatever the ranges.
- The same problem is never asked twice in a row, unless it is the only one that fits.

## Settings
- Operations: Subtraction and Addition, as checkboxes. At least one stays ticked; unticking the last one is undone.
- Ranges: lowest and highest for the first number and for the second number, whole numbers from 0 to 99. A value outside 0-99 is pulled in to the nearest limit, and a blank one keeps the previous value. Moving one end of a range past the other moves the other end with it.
- Defaults are the original game: subtraction only, first number 11-19, second number 1-9, must cross ten.
- Changes apply at once and start a new problem, keeping the question number.
- Settings that leave no problem show a warning, keep the previous settings in use, and disable Done until fixed. If only one of two ticked operations has problems, a note says only the other will appear.
- Settings are saved on the device (`localStorage`, key `math-hero-settings`). Saved settings that can't be read, or that leave no problem, are replaced by the defaults.
