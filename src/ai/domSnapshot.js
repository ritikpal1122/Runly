// ═══════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE DOM SNAPSHOT
// ═══════════════════════════════════════════════════════════════════════════
//
// Captures a simplified, LLM-friendly representation of the page DOM that
// includes:
//
//   • All interactive element types (buttons, links, inputs, ARIA roles)
//   • Form elements with state (disabled, checked, value)
//   • Tables and grids with structural context
//   • Modals, dialogs, alerts
//   • Media elements (img, svg, video, audio)
//   • Rich text editors (contenteditable)
//   • Drag-drop targets
//   • Iframe contents (recursive, one level deep)
//   • Shadow DOM (pierced where possible)
//   • Position/index info ("button #3 of 5")
//   • Element state markers (disabled, checked, expanded, focused)
//   • Smart truncation by importance score
//
// Output format: Simplified pseudo-HTML strings that LLMs can parse easily.
// ═══════════════════════════════════════════════════════════════════════════

export async function captureDomSnapshot(page, options = {}) {
  const maxElements = options.maxElements || 120;
  const includeIframes = options.includeIframes !== false;

  // Capture main page DOM
  const mainDom = await page.evaluate(captureFromContext, { maxElements });

  // Capture iframe DOMs (one level deep)
  let iframeDoms = '';
  if (includeIframes) {
    try {
      const frames = page.frames();
      for (const frame of frames) {
        if (frame === page.mainFrame()) continue;
        try {
          const frameUrl = frame.url();
          const frameName = frame.name() || 'unnamed';
          const frameDom = await frame.evaluate(captureFromContext, { maxElements: 30 });
          if (frameDom.trim()) {
            iframeDoms += `\n<!-- IFRAME name="${frameName}" url="${frameUrl}" -->\n${frameDom}\n<!-- END IFRAME -->\n`;
          }
        } catch {
          // Cross-origin iframes will throw — that's okay
        }
      }
    } catch {}
  }

  return mainDom + iframeDoms;
}

// ───────────────────────────────────────────────────────────────────────────
// This function runs INSIDE the browser context (page.evaluate).
// It must be self-contained — no external imports allowed.
// ───────────────────────────────────────────────────────────────────────────

function captureFromContext({ maxElements }) {
  // ── Selectors for ALL meaningful element types ────────────────────────
  const SELECTORS = [
    // Interactive native elements
    'button',
    'a[href]',
    'input',
    'textarea',
    'select',
    'option',
    'label',

    // Form-related
    'form',
    'fieldset',
    'legend',

    // ARIA interactive roles
    '[role="button"]',
    '[role="link"]',
    '[role="textbox"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="combobox"]',
    '[role="listbox"]',
    '[role="menuitem"]',
    '[role="menuitemcheckbox"]',
    '[role="menuitemradio"]',
    '[role="tab"]',
    '[role="tabpanel"]',
    '[role="switch"]',
    '[role="slider"]',
    '[role="spinbutton"]',
    '[role="searchbox"]',
    '[role="treeitem"]',
    '[role="option"]',

    // ARIA structural roles
    '[role="dialog"]',
    '[role="alertdialog"]',
    '[role="alert"]',
    '[role="status"]',
    '[role="banner"]',
    '[role="navigation"]',
    '[role="main"]',
    '[role="contentinfo"]',
    '[role="complementary"]',
    '[role="form"]',
    '[role="search"]',
    '[role="grid"]',
    '[role="row"]',
    '[role="cell"]',
    '[role="columnheader"]',
    '[role="rowheader"]',
    '[role="tree"]',
    '[role="menu"]',
    '[role="menubar"]',
    '[role="tablist"]',
    '[role="toolbar"]',
    '[role="region"]',

    // Table elements
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'caption',

    // Media
    'img[alt]',
    'img[role="button"]',
    'svg[aria-label]',
    'svg[role]',
    'video',
    'audio',
    'figure',
    'figcaption',

    // Editable content
    '[contenteditable="true"]',
    '[contenteditable=""]',

    // Native HTML5 interactive
    'dialog',
    'details',
    'summary',
    'menu',
    'menuitem',
    'progress',
    'meter',
    'output',

    // Drag and drop
    '[draggable="true"]',
    '[ondrop]',

    // Click handlers
    '[onclick]',

    // Headings (for context/landmarks)
    'h1', 'h2', 'h3', 'h4',

    // Navigation landmarks
    'nav',
    'header',
    'footer',
    'main',
    'aside',
    'section[aria-label]',
    'section[aria-labelledby]',

    // Modals/popups (common patterns)
    '.modal',
    '.popup',
    '.dropdown',
    '.tooltip',
    '[aria-modal="true"]',
    '[aria-haspopup]',

    // Test IDs (always include)
    '[data-testid]',
    '[data-test]',
    '[data-cy]',
    '[data-qa]',

    // ARIA labelled
    '[aria-label]',
    '[aria-labelledby]',
    '[aria-describedby]',
  ];

  // ── Collect all matching elements (deduplicated) ──────────────────────
  const elementSet = new Set();
  for (const sel of SELECTORS) {
    try {
      document.querySelectorAll(sel).forEach(el => elementSet.add(el));
    } catch {}
  }

  // ── Pierce Shadow DOM (one level) ─────────────────────────────────────
  function piercingQuery(root, depth = 0) {
    if (depth > 3) return; // prevent infinite recursion
    const all = root.querySelectorAll('*');
    for (const el of all) {
      if (el.shadowRoot) {
        for (const sel of SELECTORS) {
          try {
            el.shadowRoot.querySelectorAll(sel).forEach(s => elementSet.add(s));
          } catch {}
        }
        piercingQuery(el.shadowRoot, depth + 1);
      }
    }
  }
  piercingQuery(document);

  const allElements = Array.from(elementSet);

  // ── Visibility check ──────────────────────────────────────────────────
  function isVisible(el) {
    try {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 &&
             rect.height > 0 &&
             style.visibility !== 'hidden' &&
             style.display !== 'none' &&
             style.opacity !== '0';
    } catch {
      return false;
    }
  }

  const visible = allElements.filter(isVisible);

  // ── Importance scoring (for smart truncation) ─────────────────────────
  // Higher score = more important, included first
  function importanceScore(el) {
    let score = 0;
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role') || '';
    const testid = el.getAttribute('data-testid') || el.getAttribute('data-test') || el.getAttribute('data-cy');

    // Test IDs are extremely important
    if (testid) score += 100;

    // Interactive elements are very important
    if (['button', 'a', 'input', 'textarea', 'select'].includes(tag)) score += 50;
    if (['button', 'link', 'textbox', 'checkbox', 'radio', 'combobox'].includes(role)) score += 50;

    // Form fields with names
    if (el.getAttribute('name')) score += 30;

    // Labelled elements
    if (el.getAttribute('aria-label')) score += 25;
    if (el.getAttribute('aria-labelledby')) score += 20;

    // Visible text (more text = more context)
    const textLen = (el.textContent || '').trim().length;
    if (textLen > 0 && textLen < 100) score += 15;

    // Headings give context
    if (['h1', 'h2', 'h3'].includes(tag)) score += 20;

    // Modal/dialog elements are critical when present
    if (['dialog'].includes(tag) || ['dialog', 'alertdialog', 'alert'].includes(role)) score += 80;

    // Disabled elements still matter (might need to wait for them)
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') score += 10;

    return score;
  }

  // Sort by importance descending, then truncate
  visible.sort((a, b) => importanceScore(b) - importanceScore(a));
  const limited = visible.slice(0, maxElements);

  // ── Element state extraction ──────────────────────────────────────────
  function getState(el) {
    const states = [];
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') states.push('disabled');
    if (el.checked || el.getAttribute('aria-checked') === 'true') states.push('checked');
    if (el.required || el.getAttribute('aria-required') === 'true') states.push('required');
    if (el.readOnly || el.getAttribute('aria-readonly') === 'true') states.push('readonly');
    if (el.getAttribute('aria-expanded') === 'true') states.push('expanded');
    if (el.getAttribute('aria-selected') === 'true') states.push('selected');
    if (el.getAttribute('aria-pressed') === 'true') states.push('pressed');
    if (el.getAttribute('aria-hidden') === 'true') states.push('aria-hidden');
    if (document.activeElement === el) states.push('focused');
    return states;
  }

  // ── Position info (for "first/last/Nth" descriptions) ─────────────────
  function getPositionContext(el) {
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role') || '';
    const sameType = Array.from(document.querySelectorAll(tag))
      .filter(e => isVisible(e));
    if (sameType.length > 1) {
      const idx = sameType.indexOf(el);
      if (idx !== -1) return `${idx + 1}of${sameType.length}`;
    }
    return null;
  }

  // ── Render each element to a compact pseudo-HTML string ───────────────
  function renderElement(el) {
    const tag = el.tagName.toLowerCase();
    const attrs = [];

    // Critical attributes (always include)
    const criticalAttrs = [
      'id', 'name', 'type', 'role', 'href', 'src', 'alt', 'title',
      'placeholder', 'value', 'for',
      'aria-label', 'aria-labelledby', 'aria-describedby',
      'data-testid', 'data-test', 'data-cy', 'data-qa',
    ];

    for (const attr of criticalAttrs) {
      const val = el.getAttribute(attr);
      if (val !== null && val !== '') {
        const safe = val.substring(0, 80).replace(/"/g, '&quot;');
        attrs.push(`${attr}="${safe}"`);
      }
    }

    // Class (only if non-generated and short)
    const className = el.className && typeof el.className === 'string'
      ? el.className.trim()
      : '';
    if (className && className.length < 80 && !/^css-|^sc-|^_/.test(className)) {
      attrs.push(`class="${className.substring(0, 60)}"`);
    }

    // Element state
    const states = getState(el);
    if (states.length > 0) {
      attrs.push(`state="${states.join(',')}"`);
    }

    // Position context
    const pos = getPositionContext(el);
    if (pos) attrs.push(`position="${pos}"`);

    // For inputs: include current value
    if ((tag === 'input' || tag === 'textarea') && el.value && !attrs.find(a => a.startsWith('value='))) {
      attrs.push(`value="${el.value.substring(0, 50).replace(/"/g, '&quot;')}"`);
    }

    // For selects: include selected option
    if (tag === 'select') {
      const selected = el.options[el.selectedIndex];
      if (selected) attrs.push(`selected="${selected.text.substring(0, 40)}"`);
    }

    // Text content (truncated)
    const text = (el.textContent || '').trim().replace(/\s+/g, ' ').substring(0, 80);

    const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

    // Self-closing for void elements
    const voidElements = ['input', 'img', 'br', 'hr', 'meta', 'link'];
    if (voidElements.includes(tag)) {
      return `<${tag}${attrStr}/>`;
    }

    return text ? `<${tag}${attrStr}>${text}</${tag}>` : `<${tag}${attrStr}/>`;
  }

  // ── Build final output ────────────────────────────────────────────────
  return limited.map(renderElement).join('\n');
}
