// ═══════════════════════════════════════════════════════════════════════════
// PLAYWRIGHT → .RUNLY CONVERTER
// ═══════════════════════════════════════════════════════════════════════════
//
// Converts a Playwright .spec.ts/.spec.js file into a .runly file.
//
// Approach: regex-based line rewriter. No full AST — Playwright tests have
// a consistent enough shape that pattern matching covers ~90% of real files.
// Lines we can't translate are emitted as `# TODO (unconverted): <source>`
// so the user can fix them manually.
//
// Supported patterns:
//   page.goto(url)                             → open <url>
//   page.click(sel)                            → click <desc>
//   page.fill(sel, val)                        → type <val> in <desc>
//   page.type(sel, val)                        → type <val> in <desc>
//   page.press(sel, 'Enter')                   → press Enter
//   page.locator(sel).click()                  → click <desc>
//   page.locator(sel).fill(val)                → type <val> in <desc>
//   page.getByRole('button', {name: 'X'}).click()  → click X button
//   page.getByLabel('X').fill(val)             → type <val> in X
//   page.getByText('X').click()                → click X
//   page.getByPlaceholder('X').fill(val)       → type <val> in X
//   page.getByTestId('x').click()              → click x
//   page.waitForURL(pattern)                   → verify url contains pattern
//   page.waitForTimeout(ms)                    → wait <seconds>
//   page.screenshot(...)                       → screenshot
//   expect(page).toHaveTitle(X)                → verify title is X
//   expect(page).toHaveURL(X)                  → verify url is X
//   expect(<loc>).toBeVisible()                → verify <desc> is visible
//   expect(<loc>).toContainText(X)             → verify <X> is visible
//   expect(<loc>).toHaveText(X)                → verify <X> is visible
// ═══════════════════════════════════════════════════════════════════════════

// ── Extract blocks: describe/test hierarchy ────────────────────────────────

export function extractTests(source) {
  const tests = [];
  const lines = source.split('\n');

  // Active describes: [{ name, endLine }]. Popped when current line > endLine.
  const describeStack = [];

  let i = 0;
  while (i < lines.length) {
    // Pop describes whose body we've walked past
    while (describeStack.length > 0 && i > describeStack[describeStack.length - 1].endLine) {
      describeStack.pop();
    }

    const line = lines[i];

    // test.describe('X', () => { ... }) or describe(...)
    const descMatch = line.match(/\b(?:test\.)?describe\s*\(\s*(['"`])([^'"`]+)\1/);
    if (descMatch) {
      const { endIdx } = extractBody(lines, i);
      describeStack.push({ name: descMatch[2], endLine: endIdx });
      i++;
      continue;
    }

    // Real test call — NOT test.describe, NOT test.use/beforeEach/etc.
    // Allowed: test(, test.only(, test.skip(, test.fixme(, test.fail(
    const testMatch = line.match(
      /\btest(?:\.(?:only|skip|fixme|fail|slow))?\s*\(\s*(['"`])([^'"`]+)\1/
    );
    if (testMatch) {
      const { body, endIdx } = extractBody(lines, i);
      tests.push({
        name: testMatch[2],
        tags: describeStack.map((d) => d.name),
        body,
        startLine: i,
      });
      i = endIdx + 1;
      continue;
    }

    i++;
  }

  return tests;
}

// Walk forward from the `test(...)` or `describe(...)` line, skip past the
// call's argument list (which may contain `{ page }` destructuring), then
// find the `{` that opens the actual body and return its contents.
function extractBody(lines, startIdx) {
  let buf = '';
  for (let k = startIdx; k < lines.length; k++) buf += lines[k] + '\n';

  // Find start of the call — test(, test.only(, describe(, test.describe(
  const callMatch = buf.match(/\b(?:test|describe)(?:\.\w+)?\s*\(/);
  if (!callMatch) return { body: '', endIdx: startIdx };

  // Step 1: balance parens from the first `(` of the call to find where the
  // call's argument list ends.
  let p = callMatch.index + callMatch[0].length - 1; // position of first `(`
  let parenDepth = 1;
  let j = p + 1;
  const state = { str: null, tmpl: false, lc: false, bc: false };

  while (j < buf.length && parenDepth > 0) {
    const c = buf[j];
    const prev = buf[j - 1];
    if (state.lc) { if (c === '\n') state.lc = false; }
    else if (state.bc) { if (c === '/' && prev === '*') state.bc = false; }
    else if (state.str) { if (c === state.str && prev !== '\\') state.str = null; }
    else if (state.tmpl) { if (c === '`' && prev !== '\\') state.tmpl = false; }
    else if (c === '/' && buf[j + 1] === '/') { state.lc = true; j++; }
    else if (c === '/' && buf[j + 1] === '*') { state.bc = true; j++; }
    else if (c === '"' || c === "'") state.str = c;
    else if (c === '`') state.tmpl = true;
    else if (c === '(') parenDepth++;
    else if (c === ')') parenDepth--;
    j++;
  }

  // The `}` that closes the call's `(...)` is at j-1. Body starts AT or AFTER this.
  // But common forms are:
  //   test('name', async ({ page }) => { body })           ← body `{` is INSIDE the call's ()
  //   test('name', async function ({ page }) { body })     ← body `{` is INSIDE the call's ()
  // So we actually need the body `{` *inside* the call, AFTER the `=>` or the function's
  // parameter list. Strategy: scan backwards from the call's closing `)` to find the
  // last `{` at the right brace-depth.
  //
  // Simpler alternative that works for both arrow and function forms: restart from the
  // first `(` and track paren depth — when we cross `=> ` at paren depth == 1, or `)`
  // closing the fn parameter list at depth == 1, the next `{` is the body.

  // Reset and scan — start looking for the body `{` from p (first `(`), tracking
  // paren depth. We want a `{` encountered while paren depth is inside the outer
  // call (== 1), AFTER we've seen either `=>` or `)` closing a nested `(...)`.
  parenDepth = 0;
  j = p;
  let sawArrowOrFnClose = false;
  let bodyOpen = -1;
  const s = { str: null, tmpl: false, lc: false, bc: false };

  while (j < buf.length) {
    const c = buf[j];
    const prev = buf[j - 1];
    if (s.lc) { if (c === '\n') s.lc = false; j++; continue; }
    if (s.bc) { if (c === '/' && prev === '*') s.bc = false; j++; continue; }
    if (s.str) { if (c === s.str && prev !== '\\') s.str = null; j++; continue; }
    if (s.tmpl) { if (c === '`' && prev !== '\\') s.tmpl = false; j++; continue; }

    if (c === '/' && buf[j + 1] === '/') { s.lc = true; j++; }
    else if (c === '/' && buf[j + 1] === '*') { s.bc = true; j++; }
    else if (c === '"' || c === "'") s.str = c;
    else if (c === '`') s.tmpl = true;
    else if (c === '(') parenDepth++;
    else if (c === ')') {
      parenDepth--;
      if (parenDepth === 1) sawArrowOrFnClose = true; // fn params closed
      if (parenDepth === 0) break; // whole call closed without finding body `{`
    }
    else if (c === '=' && buf[j + 1] === '>' && parenDepth === 1) {
      sawArrowOrFnClose = true;
      j++;
    }
    else if (c === '{' && parenDepth === 1 && sawArrowOrFnClose) {
      bodyOpen = j;
      break;
    }
    j++;
  }

  if (bodyOpen < 0) return { body: '', endIdx: startIdx };

  // Step 2: balance braces starting from bodyOpen+1 until matching `}`.
  let depth = 1;
  j = bodyOpen + 1;
  const t = { str: null, tmpl: false, lc: false, bc: false };
  while (j < buf.length && depth > 0) {
    const c = buf[j];
    const prev = buf[j - 1];
    if (t.lc) { if (c === '\n') t.lc = false; }
    else if (t.bc) { if (c === '/' && prev === '*') t.bc = false; }
    else if (t.str) { if (c === t.str && prev !== '\\') t.str = null; }
    else if (t.tmpl) { if (c === '`' && prev !== '\\') t.tmpl = false; }
    else if (c === '/' && buf[j + 1] === '/') { t.lc = true; j++; }
    else if (c === '/' && buf[j + 1] === '*') { t.bc = true; j++; }
    else if (c === '"' || c === "'") t.str = c;
    else if (c === '`') t.tmpl = true;
    else if (c === '{') depth++;
    else if (c === '}') depth--;
    j++;
  }

  const body = buf.substring(bodyOpen + 1, j - 1);
  const beforeEnd = buf.substring(0, j);
  const endIdx = startIdx + (beforeEnd.split('\n').length - 1);
  return { body, endIdx };
}

// ── Line conversion rules (ordered — first match wins) ─────────────────────

const RULES = [
  // ── expect(page).toHave* ──────────────────────────────────────────────
  { re: /expect\s*\(\s*page\s*\)\s*\.toHaveTitle\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/,
    out: (m) => `verify title contains ${m[1]}` },
  { re: /expect\s*\(\s*page\s*\)\s*\.toHaveTitle\s*\(\s*\/([^/]+)\/[gimsuy]*\s*\)/,
    out: (m) => `verify title contains ${m[1]}` },
  { re: /expect\s*\(\s*page\s*\)\s*\.toHaveURL\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/,
    out: (m) => `verify url contains ${m[1]}` },
  { re: /expect\s*\(\s*page\s*\)\s*\.toHaveURL\s*\(\s*\/([^/]+)\/[gimsuy]*\s*\)/,
    out: (m) => `verify url contains ${m[1]}` },

  // ── expect(<locator>).toBeVisible / toContainText / toHaveText ───────
  { re: /expect\s*\(\s*(.+?)\s*\)\s*\.toBeVisible\s*\(\s*\)/,
    out: (m) => {
      const desc = describeLocator(m[1]);
      return desc ? `verify ${desc} is visible` : `# TODO (expect toBeVisible): ${m[0]}`;
    },
  },
  { re: /expect\s*\(\s*(.+?)\s*\)\s*\.(?:toContainText|toHaveText)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/,
    out: (m) => `verify ${m[2]} is visible` },

  // ── page.goto ────────────────────────────────────────────────────────
  { re: /page\.goto\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/,
    out: (m) => `open ${m[1]}` },

  // ── page.getByRole('button', {name: 'X'}).click() / fill() ───────────
  { re: /page\.getByRole\s*\(\s*['"`](\w+)['"`]\s*,\s*\{\s*name:\s*['"`]([^'"`]+)['"`]\s*\}\s*\)\s*\.click\s*\(\s*\)/,
    out: (m) => `click ${m[2]} ${m[1]}` },
  { re: /page\.getByRole\s*\(\s*['"`](\w+)['"`]\s*,\s*\{\s*name:\s*['"`]([^'"`]+)['"`]\s*\}\s*\)\s*\.fill\s*\(\s*['"`]([^'"`]*)['"`]\s*\)/,
    out: (m) => `type ${m[3]} in ${m[2]} ${m[1]}` },

  // ── page.getByLabel('X') / getByText / getByPlaceholder / getByTestId
  { re: /page\.(getByLabel|getByText|getByPlaceholder|getByTestId)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)\s*\.click\s*\(\s*\)/,
    out: (m) => `click ${m[2]}` },
  { re: /page\.(getByLabel|getByText|getByPlaceholder|getByTestId)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)\s*\.fill\s*\(\s*['"`]([^'"`]*)['"`]\s*\)/,
    out: (m) => `type ${m[3]} in ${m[2]}` },
  { re: /page\.(getByLabel|getByText|getByPlaceholder|getByTestId)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)\s*\.(?:type|pressSequentially)\s*\(\s*['"`]([^'"`]*)['"`]\s*\)/,
    out: (m) => `type ${m[3]} in ${m[2]}` },

  // ── page.locator(sel).click() / .fill() ──────────────────────────────
  // Use (['"])(body)\1 so inner quotes (e.g. [data-test="error"]) are fine.
  { re: /page\.locator\s*\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*\)\s*\.click\s*\(\s*\)/,
    out: (m) => `click ${simplifySelector(m[2])}` },
  { re: /page\.locator\s*\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*\)\s*\.fill\s*\(\s*(['"])((?:\\.|(?!\3).)*)\3\s*\)/,
    out: (m) => `type ${m[4]} in ${simplifySelector(m[2])}` },
  { re: /page\.locator\s*\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*\)\s*\.(?:type|pressSequentially)\s*\(\s*(['"])((?:\\.|(?!\3).)*)\3\s*\)/,
    out: (m) => `type ${m[4]} in ${simplifySelector(m[2])}` },

  // ── page.click(sel) / page.fill(sel, val) / page.type(sel, val) ──────
  { re: /page\.click\s*\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*\)/,
    out: (m) => `click ${simplifySelector(m[2])}` },
  { re: /page\.fill\s*\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*,\s*(['"])((?:\\.|(?!\3).)*)\3\s*\)/,
    out: (m) => `type ${m[4]} in ${simplifySelector(m[2])}` },
  { re: /page\.type\s*\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*,\s*(['"])((?:\\.|(?!\3).)*)\3\s*\)/,
    out: (m) => `type ${m[4]} in ${simplifySelector(m[2])}` },
  { re: /page\.press\s*\(\s*(['"])(?:(?:\\.|(?!\1).)*)\1\s*,\s*(['"])((?:\\.|(?!\2).)*)\2\s*\)/,
    out: (m) => `press ${m[3]}` },
  { re: /page\.keyboard\.press\s*\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*\)/,
    out: (m) => `press ${m[2]}` },
  { re: /page\.hover\s*\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*\)/,
    out: (m) => `hover ${simplifySelector(m[2])}` },

  // ── page.waitForTimeout / waitForURL / waitForSelector ───────────────
  { re: /page\.waitForTimeout\s*\(\s*(\d+)\s*\)/,
    out: (m) => `wait ${Math.round(parseInt(m[1], 10) / 1000)}s` },
  { re: /page\.waitForURL\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/,
    out: (m) => `verify url contains ${m[1]}` },
  { re: /page\.waitForURL\s*\(\s*\/([^/]+)\/[gimsuy]*\s*\)/,
    out: (m) => `verify url contains ${m[1]}` },
  { re: /page\.waitForSelector\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/,
    out: (m) => `verify ${simplifySelector(m[1])} is visible` },

  // ── screenshot / back / reload ────────────────────────────────────────
  { re: /page\.screenshot\s*\(/,
    out: () => 'screenshot' },
  { re: /page\.goBack\s*\(/,
    out: () => 'go back' },
  { re: /page\.reload\s*\(/,
    out: () => 'reload' },
];

// Strip framework-only lines that shouldn't show up as instructions.
const DROP_PATTERNS = [
  /^\s*$/,                           // blank
  /^\s*\/\//,                        // line comment
  /^\s*\/\*/,                        // start of block comment
  /^\s*\*/,                          // mid/end of block comment
  /^\s*import\s/,                    // import ...
  /^\s*const\s+\{\s*test\s*,/,       // const { test, expect } = require(...)
  /^\s*const\s+\w+\s*=\s*require\(/, // const pw = require('...')
  /^\s*test\.use\s*\(/,
  /^\s*test\.beforeEach\s*\(/,
  /^\s*test\.afterEach\s*\(/,
  /^\s*test\.beforeAll\s*\(/,
  /^\s*test\.afterAll\s*\(/,
  /^\s*\}\s*\)?;?\s*$/,               // closing braces
];

// ── Convert one body line into one .runly instruction (or null/TODO) ──────

export function convertLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  for (const p of DROP_PATTERNS) if (p.test(line)) return null;

  // Strip leading `await `
  const stripped = trimmed.replace(/^await\s+/, '');

  for (const rule of RULES) {
    const m = stripped.match(rule.re);
    if (m) return rule.out(m);
  }

  // Unknown line — only flag if it references page/expect (test-relevant)
  if (/\b(page|expect|browser|context|locator)\b/.test(stripped)) {
    return `# TODO (unconverted): ${stripped}`;
  }
  return null; // boring JS (variables, helpers) — silently drop
}

// ── Turn a CSS selector into a human-readable description ─────────────────

export function simplifySelector(sel) {
  if (!sel) return 'element';

  // id                        #login-button → "login button"
  const idMatch = sel.match(/^#([\w-]+)$/);
  if (idMatch) return idMatch[1].replace(/[-_]/g, ' ');

  // Any data-* attribute       [data-testid="foo"] | [data-test='foo']
  const dataMatch = sel.match(/\[data-[\w-]+=['"]?([^'"\]]+)['"]?\]/);
  if (dataMatch) return dataMatch[1].replace(/[-_]/g, ' ');

  // name="x" / name=x
  const nameMatch = sel.match(/\[name=['"]?([^'"\]]+)['"]?\]/);
  if (nameMatch) return nameMatch[1];

  // aria-label attribute
  const ariaMatch = sel.match(/\[aria-label=['"]?([^'"\]]+)['"]?\]/);
  if (ariaMatch) return ariaMatch[1];

  // text= prefix / text selectors
  const textMatch = sel.match(/^text=['"]?([^'"]+)['"]?$/);
  if (textMatch) return textMatch[1];

  // role=button[name="X"] / role=button
  const roleMatch = sel.match(/^role=(\w+)(?:\[name=['"]?([^'"\]]+)['"]?\])?/);
  if (roleMatch) {
    return roleMatch[2] ? `${roleMatch[2]} ${roleMatch[1]}` : roleMatch[1];
  }

  // :has-text("X") → X
  const hasTextMatch = sel.match(/:has-text\(['"]?([^'")]+)['"]?\)/);
  if (hasTextMatch) return hasTextMatch[1];

  // Element with class  .primary-btn | button.primary → "primary btn"
  const classMatch = sel.match(/^\w*\.([\w-]+)/);
  if (classMatch) return classMatch[1].replace(/[-_]/g, ' ');

  // Fallback: leave raw (user can tidy)
  return sel;
}

// ── Heuristic English description for a Playwright locator expression ─────
// Used only by expect(loc).toBeVisible etc.

function describeLocator(expr) {
  const e = expr.trim();
  let m;

  if ((m = e.match(/page\.getByRole\s*\(\s*(['"])(\w+)\1\s*,\s*\{\s*name:\s*(['"])((?:\\.|(?!\3).)*)\3\s*\}\s*\)/))) {
    return `${m[4]} ${m[2]}`;
  }
  if ((m = e.match(/page\.(?:getByLabel|getByText|getByPlaceholder|getByTestId)\s*\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*\)/))) {
    return m[2];
  }
  if ((m = e.match(/page\.locator\s*\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*\)/))) {
    return simplifySelector(m[2]);
  }
  return null;
}

// ── Convert a whole spec file into a .runly source string ─────────────────

export function convert(source) {
  const tests = extractTests(source);
  if (tests.length === 0) {
    return {
      content: '# No test(...) blocks found in this file.\n',
      testsFound: 0,
      todos: 0,
    };
  }

  const blocks = [];
  let todos = 0;
  let converted = 0;

  for (const t of tests) {
    const instructions = [];
    for (const line of t.body.split('\n')) {
      const out = convertLine(line);
      if (out == null) continue;
      if (out.startsWith('# TODO')) todos++;
      else converted++;
      instructions.push(out);
    }

    if (instructions.length === 0) {
      instructions.push('# TODO: no convertible steps found');
    }

    const header = [`@name: ${t.name}`];
    if (t.tags.length > 0) {
      header.push(`@tags: ${t.tags.map(tagify).join(', ')}`);
    }

    blocks.push([...header, '', ...instructions].join('\n'));
  }

  return {
    content: blocks.join('\n\n---\n\n') + '\n',
    testsFound: tests.length,
    converted,
    todos,
  };
}

function tagify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}
