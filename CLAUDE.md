# Math Hero

Subtraction practice for kids: one static page, `site/index.html`, with no build step.

## Test
- Set up once with `npm install && npx playwright install chromium`, then run `npm test`.
- The tests open `site/index.html` from disk, but they need network access: Tailwind (Play CDN) and the Fredoka font load at runtime, and Tailwind's `hidden` class is what hides the game and celebration screens, so visibility assertions fail without it.
- The tests call the page's global `generateProblem()` to sample many problems. Keep the app script a classic (non-module) script, or change `sampleProblems` in `tests/app.spec.js` with it.

## Deploy
- GitHub Pages, from `.github/workflows/deploy.yml`: every push to `master` runs the tests and, only if they pass, publishes the `site/` folder. The Pages source is "GitHub Actions", not a branch.
- Only `site/` is published, so anything the page loads from the repo must live there.
- Live at https://deccico.github.io/math-hero/
