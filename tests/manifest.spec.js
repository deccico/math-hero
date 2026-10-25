const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const SITE = path.join(__dirname, '..', 'site');

// A PNG's width and height sit in its IHDR chunk, at bytes 16-23.
function pngSize(file) {
  const bytes = fs.readFileSync(path.join(SITE, file));
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

test('the manifest makes a standalone app with icons of the sizes it claims', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(SITE, 'manifest.webmanifest'), 'utf8'));

  expect(manifest.name).toBe('Math Hero');
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('./');
  expect(manifest.scope).toBe('./');
  for (const icon of manifest.icons) {
    expect(pngSize(icon.src)).toBe(icon.sizes);
  }
  const sizes = (purpose) => manifest.icons.filter((icon) => (icon.purpose || 'any') === purpose).map((icon) => icon.sizes);
  expect(sizes('any')).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(sizes('maskable')).toEqual(['512x512']);
});

test('the page links the manifest and a 180px Apple touch icon', () => {
  const html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');

  expect(html).toContain('<link rel="manifest" href="manifest.webmanifest">');
  const touchIcon = html.match(/<link rel="apple-touch-icon" href="([^"]+)">/);
  expect(touchIcon).not.toBeNull();
  expect(pngSize(touchIcon[1])).toBe('180x180');
});
