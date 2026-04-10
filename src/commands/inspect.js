// runly inspect URL "description"
// Opens URL, finds all elements matching the description, prints them with selectors

import { chromium } from 'playwright';
import logger from '../utils/logger.js';
import { findElement } from '../runner/selectorEngine.js';
import { resolveSelector } from '../parser/resolver.js';
import { captureDomSnapshot } from '../ai/domSnapshot.js';

export async function inspectCommand(url, description, options) {
  logger.banner();

  const fullUrl = url.startsWith('http') ? url : `https://${url}`;
  logger.info(`Inspecting ${fullUrl} for: "${description}"`);

  const browser = await chromium.launch({ headless: !options.headed });
  const page = await browser.newPage();

  try {
    await page.goto(fullUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    if (description) {
      const selector = resolveSelector(description.split(' '));
      console.log('\n  Parsed selector descriptor:');
      console.log('  ' + JSON.stringify(selector, null, 2).split('\n').join('\n  '));

      const element = await findElement(page, selector);
      if (element) {
        const count = await element.count();
        console.log('');
        logger.success(`Found ${count} matching element(s)`);

        for (let i = 0; i < Math.min(count, 5); i++) {
          const el = element.nth(i);
          const tag = await el.evaluate(e => e.tagName.toLowerCase()).catch(() => '?');
          const text = await el.textContent().catch(() => '').then(t => (t || '').trim().substring(0, 60));
          const id = await el.getAttribute('id').catch(() => null);
          const classes = await el.getAttribute('class').catch(() => null);
          const testid = await el.getAttribute('data-testid').catch(() => null);
          const ariaLabel = await el.getAttribute('aria-label').catch(() => null);

          console.log('');
          logger.dim(`  [${i + 1}] <${tag}>`);
          if (text) logger.dim(`      text:       ${text}`);
          if (id) logger.dim(`      id:         ${id}`);
          if (testid) logger.dim(`      testid:     ${testid}`);
          if (ariaLabel) logger.dim(`      aria-label: ${ariaLabel}`);
          if (classes) logger.dim(`      class:      ${classes.substring(0, 60)}`);
        }
      } else {
        logger.error('No matching elements found');
      }
    }

    if (options.dom) {
      console.log('\n  Full DOM snapshot:');
      const dom = await captureDomSnapshot(page, { maxElements: 50 });
      console.log(dom.split('\n').map(l => '  ' + l).join('\n'));
    }
  } finally {
    await browser.close();
  }
}
