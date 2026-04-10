import logger from '../utils/logger.js';
import { ensureConfigDir, CONFIG_DIR } from '../utils/config.js';

export async function doctorCommand() {
  logger.banner();
  console.log('  Running health checks...\n');

  let allGood = true;

  // Check 1: Node.js version >= 18
  const nodeVersion = process.versions.node;
  const major = parseInt(nodeVersion.split('.')[0], 10);
  if (major >= 18) {
    logger.success(`Node.js v${nodeVersion}`);
  } else {
    logger.error(`Node.js v${nodeVersion} — need v18 or higher`);
    allGood = false;
  }

  // Check 2: Playwright installed
  try {
    await import('playwright');
    logger.success('Playwright installed');
  } catch {
    logger.error('Playwright not installed — run: npm install playwright');
    allGood = false;
  }

  // Check 3: Chromium browser binary
  try {
    const pw = await import('playwright');
    const browser = await pw.chromium.launch({ headless: true });
    await browser.close();
    logger.success('Chromium browser ready');
  } catch {
    logger.error('Chromium not found — run: npx playwright install chromium');
    allGood = false;
  }

  // Check 4: Config directory writable
  try {
    await ensureConfigDir();
    logger.success(`Config directory: ${CONFIG_DIR}`);
  } catch {
    logger.error(`Cannot write to ${CONFIG_DIR}`);
    allGood = false;
  }

  // Summary
  console.log('');
  if (allGood) {
    logger.success('All checks passed — runly is ready!\n');
  } else {
    logger.error('Some checks failed — fix the issues above\n');
  }
}
