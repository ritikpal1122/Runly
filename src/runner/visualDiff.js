// Visual regression — compare screenshots pixel-by-pixel
// Uses a simple byte-level comparison (no extra dependencies)

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

const BASELINE_DIR = join(homedir(), '.runly', 'baselines');

function ensureDir() {
  mkdirSync(BASELINE_DIR, { recursive: true });
}

function getBaselinePath(key) {
  const hash = createHash('md5').update(key).digest('hex').substring(0, 12);
  return join(BASELINE_DIR, `baseline-${hash}.png`);
}

export function saveBaseline(key, screenshotPath) {
  ensureDir();
  const baselinePath = getBaselinePath(key);
  const data = readFileSync(screenshotPath);
  writeFileSync(baselinePath, data);
  return baselinePath;
}

export function compareWithBaseline(key, screenshotPath) {
  const baselinePath = getBaselinePath(key);
  if (!existsSync(baselinePath)) {
    return { hasBaseline: false, baselinePath };
  }

  const baseline = readFileSync(baselinePath);
  const current = readFileSync(screenshotPath);

  if (baseline.length !== current.length) {
    return {
      hasBaseline: true,
      match: false,
      baselinePath,
      reason: `Size differs: baseline ${baseline.length}B vs current ${current.length}B`,
      diffPercent: 100,
    };
  }

  // Byte-level comparison (coarse but dependency-free)
  let diffBytes = 0;
  for (let i = 0; i < baseline.length; i++) {
    if (baseline[i] !== current[i]) diffBytes++;
  }

  const diffPercent = (diffBytes / baseline.length) * 100;
  const match = diffPercent < 0.5; // tolerate 0.5% byte difference for JPEG/PNG noise

  return {
    hasBaseline: true,
    match,
    baselinePath,
    diffBytes,
    diffPercent: Math.round(diffPercent * 100) / 100,
    reason: match ? 'Matches baseline' : `Visual diff: ${diffPercent.toFixed(2)}% bytes changed`,
  };
}
