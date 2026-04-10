import { KEY_MAP } from './actionMap.js';

// ── URL Resolution ──────────────────────────────────────────────

export function resolveUrl(token) {
  if (!token) return null;

  // Already a full URL
  if (token.startsWith('http://') || token.startsWith('https://')) {
    return token;
  }

  // Has a dot → treat as domain
  if (token.includes('.')) {
    return `https://${token}`;
  }

  // No dot → add .com
  return `https://${token}.com`;
}

// ── Key Resolution ──────────────────────────────────────────────

export function resolveKey(token) {
  if (!token) return null;
  const lower = token.toLowerCase();
  return KEY_MAP[lower] || token;
}

// ── Selector Resolution ─────────────────────────────────────────
// This converts natural language descriptions into Playwright selector strategies
// Returns a selector descriptor that the Smart Selector Engine will use at runtime

const KNOWN_ROLES = new Set([
  'button', 'link', 'textbox', 'checkbox', 'radio',
  'combobox', 'listbox', 'menu', 'menuitem', 'tab',
  'switch', 'slider', 'searchbox', 'spinbutton',
  'heading', 'img', 'dialog', 'alert', 'table',
  'row', 'cell', 'navigation', 'main', 'form',
]);

const ELEMENT_TO_ROLE = {
  // Common words → ARIA roles
  'button': 'button',
  'btn': 'button',
  'link': 'link',
  'anchor': 'link',
  'input': 'textbox',
  'textbox': 'textbox',
  'field': 'textbox',
  'text field': 'textbox',
  'textarea': 'textbox',
  'checkbox': 'checkbox',
  'check box': 'checkbox',
  'radio': 'radio',
  'radio button': 'radio',
  'dropdown': 'combobox',
  'select': 'combobox',
  'combo': 'combobox',
  'combobox': 'combobox',
  'menu': 'menu',
  'menu item': 'menuitem',
  'tab': 'tab',
  'switch': 'switch',
  'toggle': 'switch',
  'slider': 'slider',
  'range': 'slider',
  'heading': 'heading',
  'title': 'heading',
  'image': 'img',
  'img': 'img',
  'picture': 'img',
  'dialog': 'dialog',
  'modal': 'dialog',
  'popup': 'dialog',
  'table': 'table',
  'row': 'row',
  'cell': 'cell',
  'nav': 'navigation',
  'navigation': 'navigation',
  'form': 'form',
};

export function resolveSelector(tokens) {
  if (!tokens || tokens.length === 0) {
    return { strategy: 'text', value: '' };
  }

  const text = tokens.join(' ').trim();

  // Strategy 1: CSS selector passed directly (#id, .class, tag[attr])
  if (text.startsWith('#') || text.startsWith('.') || text.includes('[') || text.includes('>>')) {
    return { strategy: 'css', value: text };
  }

  // Strategy 2: XPath
  if (text.startsWith('/') || text.startsWith('//')) {
    return { strategy: 'xpath', value: text };
  }

  // Strategy 3: "Nth" pattern → "3rd item", "2nd button", "first link"
  const nthMatch = text.match(/^(\d+)(?:st|nd|rd|th)?\s+(.+)$/);
  if (nthMatch) {
    const index = parseInt(nthMatch[1], 10) - 1;
    const rest = resolveSelector(nthMatch[2].split(' '));
    return { ...rest, nth: index };
  }

  // "first", "last" prefix
  if (text.startsWith('first ')) {
    const rest = resolveSelector(text.replace('first ', '').split(' '));
    return { ...rest, nth: 0 };
  }
  if (text.startsWith('last ')) {
    const rest = resolveSelector(text.replace('last ', '').split(' '));
    return { ...rest, nth: -1 };
  }

  // Strategy 4: Check for role-based patterns
  // "login button" → role=button, name=login
  // "email input" → role=textbox, name=email
  // "submit btn" → role=button, name=submit
  for (const [word, role] of Object.entries(ELEMENT_TO_ROLE)) {
    if (text.endsWith(` ${word}`)) {
      const name = text.slice(0, -(word.length + 1)).trim();
      return { strategy: 'role', role, name: name || undefined };
    }
    if (text.startsWith(`${word} `)) {
      const name = text.slice(word.length + 1).trim();
      return { strategy: 'role', role, name: name || undefined };
    }
    if (text === word) {
      return { strategy: 'role', role };
    }
  }

  // Strategy 5: "X in Y" pattern → scoped selector
  // "pay button in payment frame" → iframe + selector
  const inMatch = text.match(/^(.+?)\s+(?:in|inside|within)\s+(.+)$/);
  if (inMatch) {
    const target = resolveSelector(inMatch[1].trim().split(' '));
    const scope = inMatch[2].trim();

    // Check if scope is an iframe
    if (scope.includes('frame') || scope.includes('iframe')) {
      return { ...target, iframe: scope };
    }

    return { ...target, scope };
  }

  // Strategy 6: Just text — let Smart Selector Engine figure it out at runtime
  return { strategy: 'text', value: text };
}

// ── Duration Resolution ─────────────────────────────────────────

export function resolveDuration(token) {
  if (!token) return 1000;

  const num = parseInt(token, 10);
  if (isNaN(num)) return 1000;

  // If small number, treat as seconds
  if (num <= 30) return num * 1000;

  // Otherwise treat as ms
  return num;
}

// ── Scroll Direction Resolution ─────────────────────────────────

export function resolveScroll(tokens) {
  const text = tokens.join(' ');

  if (text.includes('top') || text.includes('up')) return 'top';
  if (text.includes('bottom') || text.includes('down')) return 'bottom';
  if (text.includes('left')) return 'left';
  if (text.includes('right')) return 'right';

  return 'bottom'; // default: scroll down
}

// ── Assertion Resolution ────────────────────────────────────────
// "verify login button is visible" → { type: 'visible', target: 'login button' }
// "verify url contains dashboard"  → { type: 'url-contains', value: 'dashboard' }
// "verify title is Home"           → { type: 'title', value: 'Home' }
// "check 5 items in list"          → { type: 'count', target: 'items', count: 5 }
// "verify button is disabled"      → { type: 'disabled', target: 'button' }
// "verify input has value admin"   → { type: 'value', target: 'input', value: 'admin' }

export function resolveAssertion(tokens) {
  const text = tokens.join(' ');

  // URL assertion
  if (text.includes('url') && text.includes('contain')) {
    const value = text.split('contain')[1]?.trim().split(' ')[0];
    return { type: 'url-contains', value };
  }
  if (text.includes('url') && text.includes('is')) {
    const value = text.split('is')[1]?.trim();
    return { type: 'url-equals', value };
  }

  // Title assertion
  if (text.match(/^title\s/)) {
    const value = text.replace(/^title\s+(is|equals|contains|has)?\s*/i, '').trim();
    return { type: 'title', value };
  }

  // Count assertion: "5 items in list", "3 buttons"
  const countMatch = text.match(/^(\d+)\s+(.+)/);
  if (countMatch) {
    return {
      type: 'count',
      count: parseInt(countMatch[1], 10),
      target: resolveSelector(countMatch[2].split(' ')),
    };
  }

  // State assertions: disabled, enabled, hidden, checked, unchecked
  if (text.includes('disabled') || text.includes('not enabled')) {
    const target = text.replace(/\s*(is\s+)?disabled.*/, '').trim();
    return { type: 'disabled', target: resolveSelector(target.split(' ')) };
  }
  if (text.includes('enabled') || text.includes('not disabled')) {
    const target = text.replace(/\s*(is\s+)?enabled.*/, '').trim();
    return { type: 'enabled', target: resolveSelector(target.split(' ')) };
  }
  if (text.includes('hidden') || text.includes('not visible') || text.includes('invisible')) {
    const target = text.replace(/\s*(is\s+)?(hidden|not visible|invisible).*/, '').trim();
    return { type: 'hidden', target: resolveSelector(target.split(' ')) };
  }
  if (text.includes('checked')) {
    const target = text.replace(/\s*(is\s+)?checked.*/, '').trim();
    return { type: 'checked', target: resolveSelector(target.split(' ')) };
  }

  // Value assertion: "input has value admin"
  const valueMatch = text.match(/(.+?)\s+(?:has|contains|equals)\s+value\s+(.+)/);
  if (valueMatch) {
    return {
      type: 'value',
      target: resolveSelector(valueMatch[1].trim().split(' ')),
      value: valueMatch[2].trim(),
    };
  }

  // Text contains: "page contains welcome"
  if (text.includes('contain') || text.includes('has text')) {
    const value = text.split(/contain(?:s)?|has text/)[1]?.trim();
    return { type: 'text-contains', value };
  }

  // Default: check visibility of text/element
  // "verify dashboard" → dashboard should be visible
  const target = text.replace(/\s*(is\s+)?(visible|shown|displayed|present|exists?)/, '').trim();
  return { type: 'visible', target: resolveSelector(target.split(' ')) };
}
