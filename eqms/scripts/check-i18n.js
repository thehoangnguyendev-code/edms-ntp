import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const flatten = (value, prefix = '') => Object.entries(value).flatMap(([key, child]) => {
  const path = prefix ? `${prefix}.${key}` : key;
  return child && typeof child === 'object' && !Array.isArray(child)
    ? flatten(child, path)
    : [path];
});

const readCatalog = (file) => JSON.parse(readFileSync(new URL(`../src/i18n/${file}`, import.meta.url), 'utf8'));
const english = new Set(flatten(readCatalog('en.json')));
const vietnamese = new Set(flatten(readCatalog('vi.json')));
const onlyEnglish = [...english].filter((key) => !vietnamese.has(key));
const onlyVietnamese = [...vietnamese].filter((key) => !english.has(key));

if (onlyEnglish.length || onlyVietnamese.length) {
  console.error('i18n catalogs must expose the same leaf keys.');
  if (onlyEnglish.length) console.error(`Missing from vi.json: ${onlyEnglish.join(', ')}`);
  if (onlyVietnamese.length) console.error(`Missing from en.json: ${onlyVietnamese.join(', ')}`);
  process.exit(1);
}

const sourceFiles = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  if (entry.isDirectory()) return sourceFiles(path);
  return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
});
const usedKeys = new Set();
const translationCall = /\bt\(\s*["']([A-Za-z0-9_.-]+)["']/g;
for (const file of sourceFiles(fileURLToPath(new URL('../src', import.meta.url)))) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(translationCall)) usedKeys.add(match[1]);
}
const missingKeys = [...usedKeys].filter((key) => !english.has(key));
if (missingKeys.length) {
  console.error(`Missing static i18n keys: ${missingKeys.join(', ')}`);
  process.exit(1);
}

console.log(`i18n catalogs aligned (${english.size} leaf keys); ${usedKeys.size} static calls verified.`);
