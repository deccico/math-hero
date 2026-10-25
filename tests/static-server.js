// A static server for the offline tests that behaves like GitHub Pages: the site under
// /math-hero/, with Cache-Control: max-age=600 on every file.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PREFIX = '/math-hero/';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

// Serves the directory root. hang() leaves every later request unanswered (a network
// that connects but never responds); stop() cuts the network entirely.
async function startServer(root) {
  let hanging = false;
  const server = http.createServer((req, res) => {
    if (hanging) return;
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.join(root, urlPath.slice(PREFIX.length), urlPath.endsWith('/') ? 'index.html' : '');
    if (!urlPath.startsWith(PREFIX) || !file.startsWith(root)) {
      res.writeHead(404).end();
      return;
    }
    fs.readFile(file, (err, body) => {
      if (err) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'max-age=600',
      });
      res.end(body);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  return {
    url: `http://127.0.0.1:${server.address().port}${PREFIX}`,
    hang: () => {
      hanging = true;
    },
    stop: () => new Promise((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    }),
  };
}

module.exports = { startServer };
