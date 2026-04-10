// ═══════════════════════════════════════════════════════════════════════════
// AI LEARNING CACHE
// ═══════════════════════════════════════════════════════════════════════════
//
// When the AI successfully heals a failed step, save the result so future
// runs can reuse it without calling the LLM. Keyed by {domain, description}.
//
// Also: Intent Memory — save completed instruction → step breakdowns so
// similar future instructions can reuse past successful flows.
//
// ═══════════════════════════════════════════════════════════════════════════

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CACHE_DIR = join(homedir(), '.runly', 'cache');
const SELECTOR_CACHE_FILE = join(CACHE_DIR, 'healed-selectors.json');
const INTENT_CACHE_FILE = join(CACHE_DIR, 'intent-memory.json');

function ensureDir() {
  mkdirSync(CACHE_DIR, { recursive: true });
}

// ── Healed Selector Cache ─────────────────────────────────────────────────

export function loadSelectorCache() {
  if (!existsSync(SELECTOR_CACHE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(SELECTOR_CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

export function saveHealedSelector(domain, description, selector) {
  if (!domain || !description || !selector) return;
  ensureDir();
  const cache = loadSelectorCache();
  if (!cache[domain]) cache[domain] = {};
  cache[domain][description.toLowerCase()] = {
    selector,
    learnedAt: Date.now(),
    useCount: (cache[domain][description.toLowerCase()]?.useCount || 0) + 1,
  };
  writeFileSync(SELECTOR_CACHE_FILE, JSON.stringify(cache, null, 2));
}

export function getCachedSelector(domain, description) {
  if (!domain || !description) return null;
  const cache = loadSelectorCache();
  const entry = cache[domain]?.[description.toLowerCase()];
  if (!entry) return null;

  // Expire after 30 days
  if (Date.now() - entry.learnedAt > 30 * 24 * 60 * 60 * 1000) return null;

  return entry.selector;
}

export function incrementSelectorUsage(domain, description) {
  const cache = loadSelectorCache();
  if (cache[domain]?.[description.toLowerCase()]) {
    cache[domain][description.toLowerCase()].useCount++;
    writeFileSync(SELECTOR_CACHE_FILE, JSON.stringify(cache, null, 2));
  }
}

// ── Intent Memory ─────────────────────────────────────────────────────────

export function loadIntentMemory() {
  if (!existsSync(INTENT_CACHE_FILE)) return [];
  try {
    return JSON.parse(readFileSync(INTENT_CACHE_FILE, 'utf8'));
  } catch {
    return [];
  }
}

export function rememberIntent(instruction, steps, domain) {
  if (!instruction || !steps || steps.length === 0) return;
  ensureDir();
  const memory = loadIntentMemory();

  // Avoid duplicates — check if same instruction already exists
  const existing = memory.findIndex(m => m.instruction === instruction);
  if (existing !== -1) {
    memory[existing].lastUsed = Date.now();
    memory[existing].useCount = (memory[existing].useCount || 1) + 1;
  } else {
    memory.push({
      instruction,
      steps: steps.map(s => s.raw),
      domain,
      learnedAt: Date.now(),
      lastUsed: Date.now(),
      useCount: 1,
    });
  }

  // Keep last 500 entries max
  if (memory.length > 500) {
    memory.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
    memory.splice(500);
  }

  writeFileSync(INTENT_CACHE_FILE, JSON.stringify(memory, null, 2));
}

// Find similar past instructions using simple string similarity
export function findSimilarIntent(instruction, threshold = 0.7) {
  const memory = loadIntentMemory();
  const target = instruction.toLowerCase();
  const targetWords = new Set(target.split(/\s+/));

  let best = null;
  let bestScore = 0;

  for (const entry of memory) {
    const entryWords = new Set(entry.instruction.toLowerCase().split(/\s+/));
    const intersection = new Set([...targetWords].filter(w => entryWords.has(w)));
    const union = new Set([...targetWords, ...entryWords]);
    const score = intersection.size / union.size;

    if (score > bestScore && score >= threshold) {
      bestScore = score;
      best = { ...entry, similarity: score };
    }
  }

  return best;
}
