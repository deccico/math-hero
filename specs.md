# Math Hero: rules

## Game
- A game is 10 questions. A correct answer scores and moves to the next question; a wrong one resets the streak and stays on the question. The solved total carries over between games.
- A right answer counts as soon as it is typed, with no Enter needed. A wrong answer counts only when Enter is pressed or the Check button is tapped (for keyboards with no Enter key, like the iPhone number keypad), so a half-typed answer (the 1 of 13) is never marked wrong.
- Typing and Enter are ignored while the app moves to the next question, so one answer never counts twice.

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
