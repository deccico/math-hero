# Math Hero

Subtraction practice for kids: one static page, `site/index.html`, styled by a compiled Tailwind stylesheet, `site/tailwind.css`.

## Test
- Set up once with `npm install && npx playwright install chromium`, then run `npm test`. It rebuilds `site/tailwind.css` first (`pretest`).
- The tests open `site/index.html` from disk and fail on any console error, which includes the Google Fonts request failing when offline.
- The tests call the page's global `generateProblem()` to sample many problems. Keep the app script a classic (non-module) script, or change `sampleProblems` in `tests/app.spec.js` with it.

## Tailwind
- Tailwind 3.4.17 is compiled, not loaded from a CDN: `npm run build:css` builds `src/tailwind.css` with `tailwind.config.js` into a minified `site/tailwind.css`. The built file is committed, so `index.html` works straight from disk; after changing classes, rebuild and commit it. CI fails if the committed copy differs from a fresh build.
- Classes are found by scanning `site/**/*.html` as text, inline script included. Write class names as whole strings in the code (`'hidden'`, never `'hid' + 'den'` or `` `bg-${color}` ``), or they are left out of the build.
- The page loads no third-party scripts (a test enforces it). Don't go back to the Play CDN (`cdn.tailwindcss.com`): it is development-only and logs a production warning, it builds the CSS in the browser on every load, and it sends no CORS headers, so it cannot be locked with an `integrity` (SRI) hash.
- `overrides` in `package.json` forces `postcss-selector-parser` 7.1.6, the release that fixes GHSA-rj75-hqrm-r3gf. Tailwind 3.4.17 asks for 6.x, but its output was byte-identical with 7.1.6. Remove the override once the Tailwind version in use depends on a fixed release itself.

## Deploy
- GitHub Pages, from `.github/workflows/deploy.yml`: every push to `master` runs the tests and, only if they pass, publishes the `site/` folder. The Pages source is "GitHub Actions", not a branch.
- Only `site/` is published, so anything the page loads from the repo must live there.
- Live at https://deccico.github.io/math-hero/
