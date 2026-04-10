import logger from '../utils/logger.js';
import { getLastRun } from '../utils/config.js';
import { testCommand } from './test.js';

export async function replayCommand(which) {
  if (which !== 'last') {
    logger.error(`Unknown replay target: ${which}. Use "runly replay last"`);
    return;
  }

  const lastRun = await getLastRun();

  if (!lastRun) {
    logger.error('No previous run found. Run a test first.');
    return;
  }

  logger.info(`Replaying: ${lastRun.instruction}`);
  await testCommand(lastRun.instruction, lastRun.options || {});
}
