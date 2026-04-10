import { chromium, firefox, webkit } from 'playwright';
import { executeStep } from './stepExecutor.js';
import { acquireBrowser } from './browserPool.js';
import { loadSession, saveSession, getDomain } from './sessionStore.js';
import { healFailedStep } from '../ai/healer.js';
import { isAIAvailable } from '../ai/client.js';
import { getScreenshotPath } from '../utils/paths.js';
import logger from '../utils/logger.js';

const BROWSERS = { chromium, firefox, webkit };

// ── Run parsed steps against a real browser ─────────────────────

export async function runSteps(steps, options = {}) {
  const browserType = options.browser || 'chromium';
  const headless = !options.headed;
  const usePool = options.pool !== false && !options.headed;

  let browser;
  let isPooled = false;
  let ownsBrowser = true;

  // Try persistent browser pool (unless --headed or --fresh)
  if (usePool) {
    try {
      const result = await acquireBrowser(browserType, { headless, fresh: options.fresh });
      browser = result.browser;
      isPooled = result.pooled;
      ownsBrowser = !result.pooled;
    } catch {}
  }

  // Fallback: launch fresh browser
  if (!browser) {
    browser = await BROWSERS[browserType].launch({ headless });
    ownsBrowser = true;
  }

  if (options.verbose && isPooled) {
    logger.dim('  Using pooled browser (fast reconnect)');
  }

  // ── Determine target domain for session loading ──────────────
  const firstGoto = steps.find(s => s.action === 'goto');
  const domain = firstGoto ? getDomain(firstGoto.url) : null;

  // Try to load saved session for this domain
  const contextOptions = {};
  if (domain && !options.noSession) {
    const sessionPath = loadSession(domain);
    if (sessionPath) {
      contextOptions.storageState = sessionPath;
      if (options.verbose) {
        logger.dim(`  Loaded saved session for ${domain}`);
      }
    }
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  const start = Date.now();
  const results = [];
  const aiEnabled = isAIAvailable() && options.ai !== false;

  try {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      if (options.verbose) {
        logger.step(i + 1, step.raw);
      }

      let result = await executeStep(page, step, options);

      // ── AGENTIC RETRY LOOP ───────────────────────────────────
      if (!result.success && aiEnabled) {
        if (options.verbose) logger.dim('  Step failed — engaging AI self-heal...');

        const healSuggestion = await healFailedStep(page, step, result.message, options);

        if (healSuggestion && healSuggestion.strategy !== 'abort') {
          if (healSuggestion.strategy === 'retry') {
            await page.waitForTimeout(1000);
            result = await executeStep(page, step, options);
          } else if (healSuggestion.strategy === 'alternative' && healSuggestion.selector) {
            const healedStep = {
              ...step,
              selector: { strategy: 'css', value: healSuggestion.selector },
              raw: `${step.raw} (AI healed: ${healSuggestion.selector})`,
            };
            result = await executeStep(page, healedStep, options);
            if (result.success) {
              result.message = `${result.message} [self-healed]`;
            }
          } else if (healSuggestion.strategy === 'skip') {
            result = { success: true, message: `Skipped (AI: ${healSuggestion.reason})` };
          }
        }
      }

      results.push({ step: step.raw, ...result });

      if (!result.success) {
        const failScreenshot = getScreenshotPath('failure');
        await page.screenshot({ path: failScreenshot, fullPage: true }).catch(() => {});

        const runResult = {
          success: false,
          duration: Date.now() - start,
          steps: steps.map(s => s.raw),
          results,
          totalSteps: steps.length,
          passedSteps: i,
          failedStep: i + 1,
          error: result.message,
          screenshot: failScreenshot,
          url: page.url(),
        };

        await cleanup(context, browser, ownsBrowser);
        return runResult;
      }
    }

    const screenshotPath = getScreenshotPath('result');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Save session on success if user requested
    if (options.saveSession && domain) {
      await saveSession(context, domain);
      if (options.verbose) logger.dim(`  Saved session for ${domain}`);
    }

    const runResult = {
      success: true,
      duration: Date.now() - start,
      steps: steps.map(s => s.raw),
      results,
      totalSteps: steps.length,
      passedSteps: steps.length,
      screenshot: screenshotPath,
      url: page.url(),
      title: await page.title(),
      pooled: isPooled,
    };

    await cleanup(context, browser, ownsBrowser);
    return runResult;
  } catch (err) {
    await cleanup(context, browser, ownsBrowser).catch(() => {});
    return {
      success: false,
      duration: Date.now() - start,
      steps: steps.map(s => s.raw),
      results,
      totalSteps: steps.length,
      passedSteps: results.filter(r => r.success).length,
      error: err.message,
      url: (() => { try { return page.url(); } catch { return 'unknown'; } })(),
    };
  }
}

async function cleanup(context, browser, ownsBrowser) {
  try { await context.close(); } catch {}
  if (ownsBrowser) {
    try { await browser.close(); } catch {}
  } else {
    // Pooled browser — just disconnect, don't close
    try { await browser.close(); } catch {}
  }
}

export async function runUrl(url, options = {}) {
  const steps = [{ action: 'goto', url, raw: `goto ${url}` }];
  return runSteps(steps, options);
}
