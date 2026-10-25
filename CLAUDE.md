# Math Hero

Subtraction practice for kids: one static page, `site/index.html`, with no build step.

## Test
- Set up once with `npm install && npx playwright install chromium`, then run `npm test`.
- The tests open `site/index.html` from disk, but they need network access: Tailwind (Play CDN) and the Fredoka font load at runtime, and Tailwind's `hidden` class is what hides the game and celebration screens, so visibility assertions fail without it.
- The tests call the page's global `generateProblem()` to sample many problems. Keep the app script a classic (non-module) script, or change `sampleProblems` in `tests/app.spec.js` with it.

## Tailwind
- Pin every external script to an exact version (a test enforces it). The Play CDN, unpinned, redirects to whatever it currently considers latest.
- The Play CDN only serves the versions it lists, and v3 stops at 3.4.17 even though npm has later 3.4.x releases. An unknown version still returns HTTP 200, with a script that only logs `Unknown Tailwind version` and loads no styles, so check a version bump by running the tests (they fail on console errors), not with `curl`.
- The Play CDN sends no CORS headers, so it cannot be locked with an `integrity` (SRI) hash, and it always logs a "should not be used in production" warning. Leave that warning visible. The way to remove it is to compile the CSS instead of using the CDN.

## Deploy
- GitHub Pages, from `.github/workflows/deploy.yml`: every push to `master` runs the tests and, only if they pass, publishes the `site/` folder. The Pages source is "GitHub Actions", not a branch.
- Only `site/` is published, so anything the page loads from the repo must live there.
- Live at https://deccico.github.io/math-hero/
