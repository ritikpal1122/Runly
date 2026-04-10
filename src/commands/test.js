import { writeFileSync } from 'fs';
import logger from '../utils/logger.js';
import { parse } from '../parser/index.js';
import { parseWithAI } from '../ai/parser.js';
import { isAIAvailable } from '../ai/client.js';
import { generate } from '../generator/index.js';
import { runSteps, runUrl } from '../runner/index.js';
import { runWithRetry } from '../runner/retry.js';
import { debugRun } from '../runner/debugger.js';
import { saveBaseline, compareWithBaseline } from '../runner/visualDiff.js';
import { reportResult, saveReport } from '../reporter/index.js';
import { saveLastRun } from '../utils/config.js';
import { getSpecPath } from '../utils/paths.js';
import { interpolate, mergeVars } from '../parser/interpolate.js';
import { rememberIntent } from '../ai/cache.js';
import { getDomain } from '../runner/sessionStore.js';

export async function testCommand(instruction, options) {
  logger.banner();

  // Variable substitution
  const vars = mergeVars(options);
  const interpolated = interpolate(instruction, vars);
  if (interpolated !== instruction && options.verbose) {
    logger.dim(`  Interpolated: ${interpolated}`);
  }

  // Parse (AI or regex)
  const aiAvailable = isAIAvailable() && options.ai !== false;
  const steps = aiAvailable
    ? await parseWithAI(interpolated, options)
    : parse(interpolated);

  if (!steps || steps.length === 0) {
    const url = resolveUrl(interpolated);
    logger.info(`No actions parsed — treating as URL: ${url}`);
    const result = await runUrl(url, options);
    reportResult(result);
    saveReport(result, interpolated);
    await saveLastRun({ instruction: interpolated, url, options });
    if (!result.success) process.exit(1);
    return;
  }

  logger.info(`Parsed ${steps.length} step(s) from: "${interpolated}"`);
  if (options.verbose) {
    steps.forEach((s, i) => logger.step(i + 1, s.raw));
    console.log('');
  }

  // --save: export spec file
  if (options.save) {
    const code = generate(steps, { rawInput: interpolated, headless: !options.headed });
    const specPath = getSpecPath(interpolated.split(' ').slice(0, 4).join('-'));
    writeFileSync(specPath, code);
    logger.success(`Saved: ${specPath}`);
  }

  // --debug: interactive debugger
  if (options.debug) {
    const results = await debugRun(steps, options);
    const allPassed = results.every(r => r.success);
    console.log('');
    if (allPassed) logger.success('Debug run complete — all steps passed');
    else logger.warn('Debug run complete — some steps failed or skipped');
    return;
  }

  // Normal run with retry support
  const spinner = logger.spinner('Running test...');
  try {
    const result = options.retry
      ? await runWithRetry(steps, options)
      : await runSteps(steps, options);

    spinner.stop();

    // Visual regression check
    if (options.baseline && result.success && result.screenshot) {
      const key = interpolated;
      saveBaseline(key, result.screenshot);
      logger.success('Baseline saved');
    } else if (options.diff && result.success && result.screenshot) {
      const key = interpolated;
      const cmp = compareWithBaseline(key, result.screenshot);
      if (!cmp.hasBaseline) {
        logger.warn('No baseline exists — run with --baseline first');
      } else if (cmp.match) {
        logger.success(`Visual match: ${cmp.reason}`);
      } else {
        logger.error(`Visual diff: ${cmp.reason}`);
        result.success = false;
        result.error = `Visual regression: ${cmp.reason}`;
      }
    }

    reportResult(result);
    saveReport(result, interpolated);

    // Remember successful runs
    if (result.success && steps.length > 0) {
      const domain = steps.find(s => s.action === 'goto') ? getDomain(steps.find(s => s.action === 'goto').url) : null;
      rememberIntent(interpolated, steps, domain);
    }

    await saveLastRun({ instruction: interpolated, options });

    if (!result.success) process.exit(1);
  } catch (err) {
    spinner.fail('Test crashed');
    logger.error(err.message);
    if (options.verbose) console.error(err.stack);
    process.exit(1);
  }
}

function resolveUrl(input) {
  if (input.startsWith('http://') || input.startsWith('https://')) return input;
  if (input.includes('.')) return `https://${input}`;
  return `https://${input}.com`;
}
