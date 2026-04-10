// runly watch "instruction" --interval 60
// Re-runs the test every N seconds

import logger from '../utils/logger.js';
import { testCommand } from './test.js';

export async function watchCommand(instruction, options) {
  const interval = parseInt(options.interval || '60', 10) * 1000;

  logger.banner();
  logger.info(`Watching: "${instruction}"`);
  logger.dim(`  Running every ${interval / 1000}s (Ctrl+C to stop)`);

  let runCount = 0;
  let passCount = 0;

  const runOnce = async () => {
    runCount++;
    console.log(`\n${'─'.repeat(50)}`);
    logger.info(`Run #${runCount} at ${new Date().toLocaleTimeString()}`);
    console.log('─'.repeat(50));

    try {
      await testCommand(instruction, { ...options, _watching: true });
      passCount++;
    } catch {}

    logger.dim(`  Total runs: ${runCount} | Passed: ${passCount} | Pass rate: ${Math.round(passCount / runCount * 100)}%`);
  };

  await runOnce();
  setInterval(runOnce, interval);
}
