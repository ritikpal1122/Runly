// ═══════════════════════════════════════════════════════════════════════════
// runly import <path> — Playwright → .runly migrator
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, mkdirSync } from 'fs';
import { join, basename, extname, dirname, relative, resolve } from 'path';
import { convert } from './playwright.js';

export function importFile(filePath, options = {}) {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const source = readFileSync(filePath, 'utf8');
  const { content, testsFound, converted, todos } = convert(source);

  const outDir = options.outDir ? resolve(options.outDir) : dirname(resolve(filePath));
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const base = basename(filePath).replace(/\.(spec|test)\.(ts|js|mjs|cjs|tsx|jsx)$/, '');
  const outPath = join(outDir, `${base}.runly`);

  writeFileSync(outPath, content);

  return {
    source: filePath,
    output: outPath,
    testsFound,
    converted,
    todos,
  };
}

export function importPath(p, options = {}) {
  if (!existsSync(p)) throw new Error(`Path not found: ${p}`);
  const s = statSync(p);

  if (s.isFile()) {
    return [importFile(p, options)];
  }

  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (entry === 'node_modules' || entry === '.git' || entry === 'output') continue;
        walk(full);
      } else if (/\.(spec|test)\.(ts|js|mjs|cjs|tsx|jsx)$/.test(entry)) {
        files.push(full);
      }
    }
  };
  walk(p);

  return files.map((f) => importFile(f, options));
}
