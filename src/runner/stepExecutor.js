import { findElement, findFirstInput, findSelect } from './selectorEngine.js';
import { findElementWithAI } from '../ai/healer.js';
import { aiAssertion } from '../ai/assertion.js';
import { getScreenshotPath } from '../utils/paths.js';
import logger from '../utils/logger.js';

// Try regular selector engine first, fallback to AI
async function smartFind(page, selector, options) {
  // Try normal selector engine
  let el = await findElement(page, selector);
  if (el) {
    try {
      const count = await el.count();
      if (count > 0) return el;
    } catch {}
  }

  // Fallback: AI-powered DOM analysis
  if (options.ai !== false) {
    const description = selector?.value || selector?.name || '';
    if (description) {
      const aiResult = await findElementWithAI(page, description, options);
      if (aiResult) return aiResult.element;
    }
  }

  return null;
}

// Execute a single parsed step against a real Playwright page
// Returns { success, message } for each step

export async function executeStep(page, step, options = {}) {
  const verbose = options.verbose;

  switch (step.action) {
    // ── Navigation ────────────────────────────────────────────
    case 'goto': {
      await page.goto(step.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await smartWait(page);
      return ok(`Navigated to ${step.url}`);
    }

    case 'back': {
      await page.goBack({ waitUntil: 'domcontentloaded' });
      return ok('Went back');
    }

    case 'forward': {
      await page.goForward({ waitUntil: 'domcontentloaded' });
      return ok('Went forward');
    }

    case 'reload': {
      await page.reload({ waitUntil: 'domcontentloaded' });
      return ok('Reloaded page');
    }

    // ── Click Actions ─────────────────────────────────────────
    case 'click': {
      const el = await smartFind(page, step.selector, options);
      if (!el) return fail(`Element not found: ${step.raw}`);
      try {
        await el.click({ timeout: 10000 });
        await smartWait(page);
        return ok(`Clicked: ${step.raw}`);
      } catch (err) {
        return fail(`Click failed (${step.raw}): ${err.message.split('\n')[0]}`);
      }
    }

    case 'dblclick': {
      const el = await findElement(page, step.selector);
      if (!el) return fail(`Element not found: ${step.raw}`);
      await el.dblclick({ timeout: 10000 });
      return ok(`Double-clicked: ${step.raw}`);
    }

    case 'rightclick': {
      const el = await findElement(page, step.selector);
      if (!el) return fail(`Element not found: ${step.raw}`);
      await el.click({ button: 'right', timeout: 10000 });
      return ok(`Right-clicked: ${step.raw}`);
    }

    // ── Type / Fill ───────────────────────────────────────────
    case 'type': {
      try {
        let el;
        if (step.selector) {
          el = await smartFind(page, step.selector, options);
        }
        if (!el) {
          el = await findFirstInput(page);
        }
        if (!el) return fail('No input field found on page');

        await el.click({ timeout: 5000 });
        await el.fill(step.value, { timeout: 5000 });
        return ok(`Typed: "${step.value}"`);
      } catch (err) {
        return fail(`Type failed: ${err.message.split('\n')[0]}`);
      }
    }

    // ── Keyboard Press ────────────────────────────────────────
    case 'press': {
      await page.keyboard.press(step.key);
      await smartWait(page);
      return ok(`Pressed: ${step.key}`);
    }

    // ── Select / Dropdown ─────────────────────────────────────
    case 'select': {
      const selectInfo = await findSelect(page, step.selector);
      if (!selectInfo) return fail('No dropdown/select found');

      if (selectInfo.type === 'native') {
        // Native <select> element
        await selectInfo.element.selectOption({ label: step.value });
        return ok(`Selected: "${step.value}"`);
      } else {
        // Custom dropdown — click to open, then click option
        await selectInfo.element.click();
        await page.waitForTimeout(300); // wait for dropdown animation
        const option = page.getByRole('option', { name: new RegExp(step.value, 'i') })
          .or(page.getByText(step.value, { exact: false }));
        await option.first().click({ timeout: 5000 });
        return ok(`Selected: "${step.value}"`);
      }
    }

    // ── Hover ─────────────────────────────────────────────────
    case 'hover': {
      const el = await findElement(page, step.selector);
      if (!el) return fail(`Element not found: ${step.raw}`);
      await el.hover({ timeout: 5000 });
      return ok(`Hovered: ${step.raw}`);
    }

    // ── Scroll ────────────────────────────────────────────────
    case 'scroll': {
      switch (step.direction) {
        case 'top':
          await page.evaluate(() => window.scrollTo(0, 0));
          break;
        case 'bottom':
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          break;
        case 'left':
          await page.evaluate(() => window.scrollTo(0, window.scrollY));
          break;
        case 'right':
          await page.evaluate(() => window.scrollTo(document.body.scrollWidth, window.scrollY));
          break;
        default:
          await page.evaluate(() => window.scrollBy(0, 500));
      }
      return ok(`Scrolled ${step.direction}`);
    }

    // ── Wait ──────────────────────────────────────────────────
    case 'wait': {
      await page.waitForTimeout(step.duration);
      return ok(`Waited ${step.duration}ms`);
    }

    // ── Screenshot ────────────────────────────────────────────
    case 'screenshot': {
      const ssPath = getScreenshotPath('manual');
      await page.screenshot({ path: ssPath, fullPage: true });
      return ok(`Screenshot saved: ${ssPath}`);
    }

    // ── File Upload ───────────────────────────────────────────
    case 'upload': {
      const input = page.locator('input[type="file"]');
      if (await input.count() === 0) return fail('No file input found');
      await input.first().setInputFiles(step.filepath);
      return ok(`Uploaded: ${step.filepath}`);
    }

    // ── Dialog Handling ───────────────────────────────────────
    case 'accept': {
      page.once('dialog', dialog => dialog.accept());
      return ok('Will accept next dialog');
    }

    case 'dismiss': {
      page.once('dialog', dialog => dialog.dismiss());
      return ok('Will dismiss next dialog');
    }

    // ── Clear Input ───────────────────────────────────────────
    case 'clear': {
      const el = step.selector
        ? await findElement(page, step.selector)
        : await findFirstInput(page);
      if (!el) return fail('No input to clear');
      await el.clear();
      return ok(`Cleared input`);
    }

    // ── Focus ─────────────────────────────────────────────────
    case 'focus': {
      const el = await findElement(page, step.selector);
      if (!el) return fail(`Element not found: ${step.raw}`);
      await el.focus();
      return ok(`Focused: ${step.raw}`);
    }

    // ── Drag and Drop ─────────────────────────────────────────
    case 'drag': {
      const source = await findElement(page, step.source);
      if (!source) return fail(`Drag source not found: ${step.raw}`);

      if (step.target) {
        const target = await findElement(page, step.target);
        if (!target) return fail(`Drag target not found: ${step.raw}`);
        await source.dragTo(target);
      }
      return ok(`Dragged: ${step.raw}`);
    }

    // ── Assertions ────────────────────────────────────────────
    case 'assert': {
      return executeAssertion(page, step.assertion);
    }

    case 'ai-assert': {
      const verdict = await aiAssertion(page, step.assertion, options);
      if (verdict.passed) {
        return ok(`AI verified: ${step.assertion} — ${verdict.reasoning}`);
      }
      const why = verdict.reasoning ? ` — ${verdict.reasoning}` : '';
      return fail(`AI assertion failed: ${step.assertion}${why}`);
    }

    default:
      return fail(`Unknown action: ${step.action}`);
  }
}

// ── Assertion Executor ──────────────────────────────────────────

async function executeAssertion(page, assertion) {
  if (!assertion) return fail('No assertion defined');

  switch (assertion.type) {
    case 'visible': {
      const el = await findElement(page, assertion.target);
      if (!el) return fail(`Element not found for visibility check`);
      try {
        await el.waitFor({ state: 'visible', timeout: 10000 });
        return ok(`Visible: ${assertion.target.value || assertion.target.name || 'element'}`);
      } catch {
        return fail(`Not visible: ${assertion.target.value || assertion.target.name || 'element'}`);
      }
    }

    case 'hidden': {
      const el = await findElement(page, assertion.target);
      if (!el) return ok('Element not found — counts as hidden');
      try {
        await el.waitFor({ state: 'hidden', timeout: 5000 });
        return ok('Element is hidden');
      } catch {
        return fail('Element is still visible');
      }
    }

    case 'disabled': {
      const el = await findElement(page, assertion.target);
      if (!el) return fail('Element not found for disabled check');
      const isDisabled = await el.isDisabled();
      return isDisabled ? ok('Element is disabled') : fail('Element is NOT disabled');
    }

    case 'enabled': {
      const el = await findElement(page, assertion.target);
      if (!el) return fail('Element not found for enabled check');
      const isEnabled = await el.isEnabled();
      return isEnabled ? ok('Element is enabled') : fail('Element is NOT enabled');
    }

    case 'checked': {
      const el = await findElement(page, assertion.target);
      if (!el) return fail('Element not found for checked check');
      const isChecked = await el.isChecked();
      return isChecked ? ok('Element is checked') : fail('Element is NOT checked');
    }

    case 'url-contains': {
      const url = page.url();
      return url.includes(assertion.value)
        ? ok(`URL contains "${assertion.value}"`)
        : fail(`URL "${url}" does not contain "${assertion.value}"`);
    }

    case 'url-equals': {
      const url = page.url();
      return url === assertion.value
        ? ok(`URL matches`)
        : fail(`URL "${url}" !== "${assertion.value}"`);
    }

    case 'title': {
      const title = await page.title();
      const matches = title.toLowerCase().includes(assertion.value.toLowerCase());
      return matches
        ? ok(`Title contains "${assertion.value}"`)
        : fail(`Title "${title}" does not contain "${assertion.value}"`);
    }

    case 'count': {
      const el = await findElement(page, assertion.target);
      if (!el) return fail('Elements not found for count check');
      const count = await el.count();
      return count === assertion.count
        ? ok(`Count matches: ${count}`)
        : fail(`Expected ${assertion.count} elements, found ${count}`);
    }

    case 'value': {
      const el = await findElement(page, assertion.target);
      if (!el) return fail('Element not found for value check');
      const value = await el.inputValue();
      return value === assertion.value
        ? ok(`Value matches: "${value}"`)
        : fail(`Expected value "${assertion.value}", got "${value}"`);
    }

    case 'text-contains': {
      const body = await page.textContent('body');
      return body.includes(assertion.value)
        ? ok(`Page contains "${assertion.value}"`)
        : fail(`Page does not contain "${assertion.value}"`);
    }

    default:
      return fail(`Unknown assertion type: ${assertion.type}`);
  }
}

// ── Smart Wait — wait for page to stabilize ─────────────────────

async function smartWait(page) {
  try {
    // Wait for network to be mostly idle (no pending requests for 500ms)
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    // Quick DOM stability check — compare body length twice
    const len1 = await page.evaluate(() => document.body.innerHTML.length).catch(() => 0);
    await page.waitForTimeout(200);
    const len2 = await page.evaluate(() => document.body.innerHTML.length).catch(() => 0);

    // If DOM is still changing, wait a bit more
    if (len1 !== len2) {
      await page.waitForTimeout(500);
    }
  } catch {
    // Smart wait is best-effort, don't fail the test
  }
}

// ── Helpers ─────────────────────────────────────────────────────

function ok(message) {
  return { success: true, message };
}

function fail(message) {
  return { success: false, message };
}
