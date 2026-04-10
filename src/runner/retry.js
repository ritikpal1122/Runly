// Retry logic — wrap runSteps with automatic retry on failure

import { runSteps } from './index.js';
import logger from '../utils/logger.js';

export async function runWithRetry(steps, options = {}) {
  const maxRetries = options.retry || 0;
  const retryDelay = (options.retryDelay || 2) * 1000;

  let result = await runSteps(steps, options);
  let attempt = 1;

  while (!result.success && attempt <= maxRetries) {
    if (options.verbose) {
      logger.warn(`Attempt ${attempt}/${maxRetries + 1} failed, retrying in ${retryDelay / 1000}s...`);
    }
    await new Promise(r => setTimeout(r, retryDelay));
    result = await runSteps(steps, options);
    attempt++;
  }

  if (attempt > 1 && result.success) {
    result.retriedSuccess = true;
    result.attempts = attempt;
  } else if (attempt > 1) {
    result.attempts = attempt;
  }

  return result;
}
