# Math Hero

Addition and subtraction practice for kids (rules in `specs.md`): one static page, `site/index.html`, run by `site/app.js` and styled by a compiled Tailwind stylesheet, `site/tailwind.css`, with the Fredoka font in `site/fonts/`. Everything the page loads comes from `site/`.

## Test
- Set up once with `npm install && npx playwright install chromium`, then run `npm test`. It rebuilds `site/tailwind.css` first (`pretest`).
- The tests open `site/index.html` from disk and need no network. They fail on any console error, and on any request outside the page's own files.
- `tests/fixtures.js` holds the shared fixtures and helpers. `tests/offline.spec.js` serves a copy of `site/` over HTTP instead (`tests/static-server.js`), the way GitHub Pages does: under `/math-hero/`, with `Cache-Control: max-age=600`.
- The tests call the page's global `generateProblem()` to sample many problems. Keep `site/app.js` a classic (non-module) script, or change `sampleProblems` in `tests/app.spec.js` with it.

## Tailwind
- Tailwind 3.4.17 is compiled, not loaded from a CDN: `npm run build:css` builds `src/tailwind.css` with `tailwind.config.js` into a minified `site/tailwind.css`. The built file is committed, so `index.html` works straight from disk; after changing classes, rebuild and commit it. CI fails if the committed copy differs from a fresh build.
- Classes are found by scanning `site/**/*.{html,js}` as text. Write class names as whole strings in the code (`'hidden'`, never `'hid' + 'den'` or `` `bg-${color}` ``), or they are left out of the build.
- The page loads no third-party scripts, only its own `app.js` (a test enforces it). Don't go back to the Play CDN (`cdn.tailwindcss.com`): it is development-only and logs a production warning, it builds the CSS in the browser on every load, and it sends no CORS headers, so it cannot be locked with an `integrity` (SRI) hash.
- `overrides` in `package.json` forces `postcss-selector-parser` 7.1.6, the release that fixes GHSA-rj75-hqrm-r3gf. Tailwind 3.4.17 asks for 6.x, but its output was byte-identical with 7.1.6. Remove the override once the Tailwind version in use depends on a fixed release itself.

## Font
- Fredoka is self-hosted: `site/fonts/fredoka-latin-wght-normal.woff2`, one variable file covering weights 300-700, taken from `@fontsource-variable/fredoka` 5.3.0 and declared by the `@font-face` in `src/tailwind.css`. It renders pixel-identically to the Google Fonts copy it replaced.
- It covers Latin characters only; anything else falls back to the system sans-serif. If the app ever needs other scripts, add that subset's file from the same package.
- The font's OFL license requires `site/fonts/Fredoka-OFL.txt` to ship with it; keep the two together.

## Offline
- `site/sw.js` (a service worker) makes the app work offline after one visit: its install stores every file in `FILES`. Keep `FILES` in step with what the page loads; the offline tests fail if a file is missing.
- Network first: every request asks the server, revalidating past the HTTP cache (`cache: 'no-cache'`), so a new deploy shows on the next load. The stored copy answers only when the network fails, returns an error, or takes over 3 seconds; after a timeout, the next 30 seconds use stored copies straight away, so a dead connection costs one wait per page, not one per file. Deploys never need a change to `sw.js` or a version bump.
- Without `no-cache`, GitHub Pages' `max-age=600` would hide a new version for up to 10 minutes. Navigations are fetched by URL with `redirect: 'manual'`, because Chrome refuses to copy a navigation request and rejects a followed redirect for one.
- Service workers need http(s), so the page skips registration when opened from disk. Their scope is `/math-hero/`: the address without the trailing slash is outside it and doesn't work offline.
- In the offline tests, go offline with `stop()` and `reload()`: a reload revalidates, so the browser's HTTP cache cannot pass for the service worker. Check updates with `goto()`, which the HTTP cache would answer with the old version.
- Safari deletes a site's storage, service worker cache included, after 7 days of Safari use without visiting it. Apps added to the Home Screen with a manifest are exempt.

## Deploy
- GitHub Pages, from `.github/workflows/deploy.yml`: every push to `master` runs the tests and, only if they pass, publishes the `site/` folder. The Pages source is "GitHub Actions", not a branch.
- Only `site/` is published, so anything the page loads from the repo must live there.
- Live at https://deccico.github.io/math-hero/
