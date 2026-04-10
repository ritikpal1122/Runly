// Interactive debugger — step through each action with prompts

import readline from 'readline';
import { chromium } from 'playwright';
import { executeStep } from './stepExecutor.js';
import logger from '../utils/logger.js';

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

export async function debugRun(steps, options = {}) {
  logger.info('Interactive debugger — press Enter to step, "s" to skip, "q" to quit, "i" to inspect');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = [];

  try {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log('');
      logger.info(`Step ${i + 1}/${steps.length}: ${step.raw}`);

      const action = await prompt('  [Enter=run / s=skip / i=inspect / q=quit] > ');

      if (action === 'q' || action === 'quit') {
        logger.warn('Aborted by user');
        break;
      }

      if (action === 's' || action === 'skip') {
        logger.dim('  Skipped');
        results.push({ step: step.raw, success: true, message: 'Skipped by user' });
        continue;
      }

      if (action === 'i' || action === 'inspect') {
        const url = page.url();
        const title = await page.title();
        logger.dim(`  URL: ${url}`);
        logger.dim(`  Title: ${title}`);
        i--; // retry same step
        continue;
      }

      const result = await executeStep(page, step, options);
      if (result.success) {
        logger.success(`  ${result.message}`);
      } else {
        logger.error(`  ${result.message}`);
        const retry = await prompt('  Failed. Retry? [y/N] > ');
        if (retry === 'y') {
          i--;
          continue;
        }
      }
      results.push({ step: step.raw, ...result });
    }
  } finally {
    await browser.close();
  }

  return results;
}
