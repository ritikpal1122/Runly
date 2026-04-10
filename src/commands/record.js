// runly record — opens a browser, captures user actions, outputs English instruction

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import logger from '../utils/logger.js';
import { getSpecPath } from '../utils/paths.js';

export async function recordCommand(url, options) {
  logger.banner();

  const fullUrl = url ? (url.startsWith('http') ? url : `https://${url}`) : 'about:blank';
  logger.info(`Recording: ${fullUrl}`);
  logger.dim('  Interact with the browser. Press Ctrl+C when done.');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const actions = [];
  if (fullUrl !== 'about:blank') {
    actions.push(`open ${url}`);
  }

  // Inject event listeners to capture interactions
  await page.exposeFunction('__runlyCapture', (event) => {
    actions.push(event);
    console.log('  → ' + event);
  });

  await page.addInitScript(() => {
    function describe(el) {
      if (!el) return 'element';
      const tag = el.tagName?.toLowerCase() || 'element';
      const testid = el.getAttribute?.('data-testid');
      if (testid) return `${tag} ${testid}`;
      const ariaLabel = el.getAttribute?.('aria-label');
      if (ariaLabel) return `${ariaLabel} ${tag}`;
      const text = el.textContent?.trim().substring(0, 30);
      const placeholder = el.getAttribute?.('placeholder');
      if (placeholder) return `${placeholder} field`;
      const name = el.getAttribute?.('name');
      if (name) return `${name} field`;
      if (text) return `${text} ${tag}`;
      return tag;
    }

    document.addEventListener('click', (e) => {
      const desc = describe(e.target);
      window.__runlyCapture?.(`click ${desc}`);
    }, true);

    document.addEventListener('change', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        const desc = describe(e.target);
        const value = e.target.value;
        if (value) window.__runlyCapture?.(`type ${value} in ${desc}`);
      }
    }, true);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        window.__runlyCapture?.(`press Enter`);
      }
    }, true);
  });

  if (fullUrl !== 'about:blank') {
    await page.goto(fullUrl, { waitUntil: 'domcontentloaded' });
  }

  // Wait for Ctrl+C
  process.on('SIGINT', async () => {
    console.log('\n');
    const instruction = actions.join(' and ');
    logger.success('Recording complete');
    console.log('');
    logger.info('Captured instruction:');
    console.log(`  runly test "${instruction}"`);
    console.log('');

    if (options.save) {
      const path = getSpecPath('recorded');
      writeFileSync(path, `# Recorded: ${new Date().toISOString()}\nrunly test "${instruction}"\n`);
      logger.success(`Saved: ${path}`);
    }

    await browser.close();
    process.exit(0);
  });

  // Keep alive
  await new Promise(() => {});
}
