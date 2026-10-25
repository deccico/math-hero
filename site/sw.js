// Math Hero service worker: the newest version when online, the stored copy when offline.
// Every request goes to the network first; the stored copy answers only if the network
// fails, returns an error, or takes longer than NETWORK_TIMEOUT_MS. So a new deploy shows
// on the next load, and changing the site never needs a change here.

const CACHE = 'math-hero';
// Everything the page loads, stored at install so one visit is enough to work offline.
const FILES = ['./', 'app.js', 'tailwind.css', 'fonts/fredoka-latin-wght-normal.woff2'];
const NETWORK_TIMEOUT_MS = 3000;
// After one request times out, later ones use the stored copy straight away for this long,
// so a page on a dead connection waits out the timeout once, not once per file.
const SLOW_NETWORK_MS = 30000;
let skipNetworkWaitUntil = 0;

self.addEventListener('install', (event) => {
  // no-cache: revalidate with the server rather than store a stale HTTP-cached copy.
  const requests = FILES.map((file) => new Request(file, { cache: 'no-cache' }));
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(requests))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  const isPage = request.mode === 'navigate';
  // Every address of the page (with or without index.html or a query string) shares one stored copy.
  const key = isPage ? self.registration.scope : request.url;
  // no-cache: GitHub Pages sends max-age=600, which would otherwise hide a new version for 10 minutes.
  // A navigation can't be copied into a new Request, so it is fetched by URL, handing redirects back to the browser.
  const fromNetwork = isPage
    ? fetch(request.url, { cache: 'no-cache', redirect: 'manual' })
    : fetch(request, { cache: 'no-cache' });

  // Keep the stored copy current. A rejected fetch means offline, which networkOrStored handles.
  event.waitUntil(fromNetwork.then(
    (response) => {
      if (!response.ok) return undefined;
      const copy = response.clone(); // Clone now, before the page starts reading the body
      return caches.open(CACHE).then((cache) => cache.put(key, copy));
    },
    () => undefined,
  ));

  event.respondWith(networkOrStored(fromNetwork, key));
});

// The network's response, or the stored copy if the network fails, errors or is too slow.
// With nothing stored yet, it waits for the network whatever happens.
async function networkOrStored(fromNetwork, key) {
  const cache = await caches.open(CACHE);
  const stored = await cache.match(key, { ignoreSearch: true });
  if (!stored) return fromNetwork;

  const usable = (response) => response.ok || response.type === 'opaqueredirect';
  const network = fromNetwork.then((response) => (usable(response) ? response : stored), () => stored);
  let timer;
  const timeout = new Promise((resolve) => {
    const wait = Date.now() < skipNetworkWaitUntil ? 0 : NETWORK_TIMEOUT_MS;
    timer = setTimeout(() => {
      if (wait) skipNetworkWaitUntil = Date.now() + SLOW_NETWORK_MS;
      resolve(stored);
    }, wait);
  });
  return Promise.race([network.finally(() => clearTimeout(timer)), timeout]);
}
