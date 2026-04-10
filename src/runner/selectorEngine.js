// Smart Selector Engine
// Given a selector descriptor from the parser, tries multiple strategies
// to find the element on the real page. Falls back gracefully.

export async function findElement(page, selector) {
  if (!selector) return null;

  // Handle iframe scoping
  let target = page;
  if (selector.iframe) {
    const frameName = selector.iframe.replace(/\s*(frame|iframe)\s*/gi, '').trim();
    // Try by name/id first, then by text in src
    target = page.frameLocator(`iframe[name="${frameName}"]`)
      || page.frameLocator(`iframe[id="${frameName}"]`)
      || page.frameLocator(`iframe`).first();
  }

  // Handle scope (element within another element)
  if (selector.scope) {
    const scopeEl = await findElement(page, { strategy: 'text', value: selector.scope });
    if (scopeEl) target = scopeEl;
  }

  let element = null;

  switch (selector.strategy) {
    case 'css':
      element = target.locator(selector.value);
      break;

    case 'xpath':
      element = target.locator(`xpath=${selector.value}`);
      break;

    case 'role':
      element = await findByRole(target, selector);
      break;

    case 'text':
      element = await findByText(target, selector.value);
      break;

    default:
      element = await findByText(target, selector.value || '');
  }

  // Handle nth element
  if (element && selector.nth !== undefined) {
    if (selector.nth === -1) {
      element = element.last();
    } else {
      element = element.nth(selector.nth);
    }
  }

  return element;
}

// ── Strategy: Find by ARIA Role ─────────────────────────────────

async function findByRole(target, selector) {
  const opts = {};
  if (selector.name) opts.name = new RegExp(escapeRegex(selector.name), 'i');

  const el = target.getByRole(selector.role, opts);
  if (await safeCount(el) > 0) return el.first();

  // Fallback: try without name filter
  if (selector.name) {
    const elNoName = target.getByRole(selector.role);
    if (await safeCount(elNoName) > 0) {
      // Try to find one that contains the name text
      const withText = elNoName.filter({ hasText: new RegExp(escapeRegex(selector.name), 'i') });
      if (await safeCount(withText) > 0) return withText.first();
      return elNoName.first();
    }
  }

  // Fallback: try text-based search with the name
  if (selector.name) {
    return findByText(target, selector.name);
  }

  return el;
}

// ── Strategy: Find by Text (multi-strategy fallback) ────────────

async function findByText(target, text) {
  if (!text) return null;

  // 1. Exact text match
  let el = target.getByText(text, { exact: true });
  if (await safeCount(el) > 0) return el.first();

  // 2. Case-insensitive text match
  el = target.getByText(new RegExp(escapeRegex(text), 'i'));
  if (await safeCount(el) > 0) return el.first();

  // 3. Try as button role
  el = target.getByRole('button', { name: new RegExp(escapeRegex(text), 'i') });
  if (await safeCount(el) > 0) return el.first();

  // 4. Try as link role
  el = target.getByRole('link', { name: new RegExp(escapeRegex(text), 'i') });
  if (await safeCount(el) > 0) return el.first();

  // 5. Try as any role with name
  for (const role of ['textbox', 'checkbox', 'menuitem', 'tab', 'heading']) {
    el = target.getByRole(role, { name: new RegExp(escapeRegex(text), 'i') });
    if (await safeCount(el) > 0) return el.first();
  }

  // 6. Try by placeholder
  el = target.getByPlaceholder(new RegExp(escapeRegex(text), 'i'));
  if (await safeCount(el) > 0) return el.first();

  // 7. Try by label
  el = target.getByLabel(new RegExp(escapeRegex(text), 'i'));
  if (await safeCount(el) > 0) return el.first();

  // 8. Try by alt text (images)
  el = target.getByAltText(new RegExp(escapeRegex(text), 'i'));
  if (await safeCount(el) > 0) return el.first();

  // 9. Try by title attribute
  el = target.getByTitle(new RegExp(escapeRegex(text), 'i'));
  if (await safeCount(el) > 0) return el.first();

  // 10. Try by test-id
  el = target.getByTestId(new RegExp(escapeRegex(text), 'i'));
  if (await safeCount(el) > 0) return el.first();

  // 11. CSS fallback — try common patterns
  for (const css of [
    `[data-testid*="${text}" i]`,
    `[aria-label*="${text}" i]`,
    `[name*="${text}" i]`,
    `[id*="${text}" i]`,
    `[class*="${text}" i]`,
  ]) {
    el = target.locator(css);
    if (await safeCount(el) > 0) return el.first();
  }

  // 12. Last resort: broad text search
  el = target.getByText(text);
  return el;
}

// ── Find first visible input on page ────────────────────────────

export async function findFirstInput(page) {
  // Try focused element first
  const focused = page.locator(':focus');
  if (await safeCount(focused) > 0) {
    const tag = await focused.evaluate(el => el.tagName.toLowerCase()).catch(() => '');
    if (tag === 'input' || tag === 'textarea') return focused;
  }

  // Try visible inputs
  const inputs = page.locator('input:visible, textarea:visible, [contenteditable="true"]:visible');
  if (await safeCount(inputs) > 0) return inputs.first();

  // Try any input
  const anyInput = page.locator('input, textarea');
  if (await safeCount(anyInput) > 0) return anyInput.first();

  return null;
}

// ── Find select/dropdown element ────────────────────────────────

export async function findSelect(page, selector) {
  if (selector) {
    const el = await findElement(page, selector);
    if (el) {
      // Check if it's a native select
      const tag = await el.evaluate(e => e.tagName.toLowerCase()).catch(() => '');
      if (tag === 'select') return { type: 'native', element: el };
      return { type: 'custom', element: el };
    }
  }

  // Fallback: find first select on page
  const select = page.locator('select:visible');
  if (await safeCount(select) > 0) {
    return { type: 'native', element: select.first() };
  }

  // Custom dropdown: look for combobox role
  const combo = page.getByRole('combobox');
  if (await safeCount(combo) > 0) {
    return { type: 'custom', element: combo.first() };
  }

  return null;
}

// ── Safe count (doesn't throw on detached elements) ─────────────

async function safeCount(locator) {
  try {
    return await locator.count();
  } catch {
    return 0;
  }
}

// Escape regex special characters in a string
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
