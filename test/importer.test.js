import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  convertLine,
  simplifySelector,
  extractTests,
  convert,
} from '../src/importer/playwright.js';

test('convertLine: page.goto', () => {
  assert.equal(
    convertLine("  await page.goto('https://example.com');"),
    'open https://example.com'
  );
});

test('convertLine: page.click(selector) uses simplifySelector', () => {
  assert.equal(
    convertLine("await page.click('#login-button');"),
    'click login button'
  );
});

test('convertLine: page.fill(selector, value)', () => {
  assert.equal(
    convertLine("await page.fill('#user', 'admin');"),
    'type admin in user'
  );
});

test('convertLine: page.getByRole with name', () => {
  assert.equal(
    convertLine("await page.getByRole('button', { name: 'Login' }).click();"),
    'click Login button'
  );
});

test('convertLine: page.getByLabel', () => {
  assert.equal(
    convertLine("await page.getByLabel('Email').fill('a@b.co');"),
    'type a@b.co in Email'
  );
});

test('convertLine: page.getByPlaceholder', () => {
  assert.equal(
    convertLine("await page.getByPlaceholder('Username').fill('alice');"),
    'type alice in Username'
  );
});

test('convertLine: expect(page).toHaveURL with regex', () => {
  assert.equal(
    convertLine("await expect(page).toHaveURL(/inventory/);"),
    'verify url contains inventory'
  );
});

test('convertLine: expect(locator).toBeVisible', () => {
  const out = convertLine(
    "await expect(page.getByText('Welcome')).toBeVisible();"
  );
  assert.equal(out, 'verify Welcome is visible');
});

test('convertLine: waitForTimeout → wait Ns', () => {
  assert.equal(
    convertLine('await page.waitForTimeout(2000);'),
    'wait 2s'
  );
});

test('convertLine: page.screenshot', () => {
  assert.equal(
    convertLine("await page.screenshot({ path: 'out.png' });"),
    'screenshot'
  );
});

test('convertLine: drops imports and test.beforeEach lines', () => {
  assert.equal(convertLine("import { test, expect } from '@playwright/test';"), null);
  assert.equal(convertLine('test.beforeEach(async () => {});'), null);
  assert.equal(convertLine('});'), null);
  assert.equal(convertLine(''), null);
  assert.equal(convertLine('// a comment'), null);
});

test('convertLine: unknown page.* line is flagged TODO', () => {
  const out = convertLine('await page.mouse.wheel(0, 100);');
  assert.match(out, /^# TODO/);
});

test('simplifySelector: #id → words', () => {
  assert.equal(simplifySelector('#login-button'), 'login button');
});

test('simplifySelector: [data-test="error"] extracts the value', () => {
  assert.equal(simplifySelector('[data-test="error"]'), 'error');
});

test('simplifySelector: [data-testid="cart"] also works', () => {
  assert.equal(simplifySelector('[data-testid="cart"]'), 'cart');
});

test('simplifySelector: .primary-btn → "primary btn"', () => {
  assert.equal(simplifySelector('.primary-btn'), 'primary btn');
});

test('simplifySelector: empty → "element"', () => {
  assert.equal(simplifySelector(''), 'element');
});

test('extractTests: finds tests inside describe and at top level', () => {
  const src = `
test.describe('Auth', () => {
  test('standard user', async ({ page }) => {
    await page.goto('https://x.com');
  });
  test('locked user', async ({ page }) => {
    await page.click('#login');
  });
});

test('homepage', async ({ page }) => {
  await page.goto('https://y.com');
});
`;
  const tests = extractTests(src);
  assert.equal(tests.length, 3);
  assert.equal(tests[0].name, 'standard user');
  assert.deepEqual(tests[0].tags, ['Auth']);
  assert.equal(tests[2].name, 'homepage');
  assert.deepEqual(tests[2].tags, []);
});

test('convert: full round trip produces a .runly string', () => {
  const src = `
test('login', async ({ page }) => {
  await page.goto('https://example.com');
  await page.click('#login');
});
`;
  const result = convert(src);
  assert.equal(result.testsFound, 1);
  assert.ok(result.content.includes('@name: login'));
  assert.ok(result.content.includes('open https://example.com'));
  assert.ok(result.content.includes('click login'));
});

test('convert: source with no tests emits a friendly notice', () => {
  const result = convert('const x = 1;');
  assert.equal(result.testsFound, 0);
  assert.match(result.content, /No test\(\.\.\.\)/);
});
