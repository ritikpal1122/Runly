import { askJSON, isAIAvailable } from './client.js';
import { DOM_ANALYZER_SYSTEM, buildDomAnalyzerPrompt, HEALER_SYSTEM, buildHealerPrompt } from './prompts.js';
import { captureDomSnapshot } from './domSnapshot.js';
import logger from '../utils/logger.js';

// ── Find element using AI when normal selectors fail ────────────

export async function findElementWithAI(page, targetDescription, options = {}) {
  if (!isAIAvailable()) return null;

  if (options.verbose) logger.dim(`  AI searching for: "${targetDescription}"`);

  const dom = await captureDomSnapshot(page);

  const result = await askJSON(
    DOM_ANALYZER_SYSTEM,
    buildDomAnalyzerPrompt(dom, targetDescription),
    { maxTokens: 512, verbose: options.verbose }
  );

  if (!result || !result.selector) return null;

  if (options.verbose) {
    logger.dim(`  AI suggested: ${result.selector} (confidence: ${result.confidence})`);
  }

  // Try the suggested selector
  try {
    const el = page.locator(result.selector);
    const count = await el.count();
    if (count > 0) {
      return { element: el.first(), selector: result.selector, reason: result.reason };
    }
  } catch {}

  return null;
}

// ── Heal a failed step ──────────────────────────────────────────
// Returns: { strategy, action, selector, reason } or null if cannot heal

export async function healFailedStep(page, failedStep, errorMessage, options = {}) {
  if (!isAIAvailable()) return null;

  if (options.verbose) logger.dim('  Attempting AI self-heal...');

  const dom = await captureDomSnapshot(page);

  const result = await askJSON(
    HEALER_SYSTEM,
    buildHealerPrompt(failedStep, errorMessage, dom),
    { maxTokens: 512, verbose: options.verbose }
  );

  if (!result) return null;

  if (options.verbose) {
    logger.dim(`  AI heal strategy: ${result.strategy} — ${result.reason}`);
  }

  return result;
}
