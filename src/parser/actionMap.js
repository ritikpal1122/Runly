// Each rule: keyword pattern → action type + what to capture next
// Order matters — first match wins

export const ACTION_RULES = [
  // Navigation
  {
    action: 'goto',
    patterns: [/^(open|goto|go|navigate|visit|launch|load|browse)$/],
    captureAs: 'url',
  },

  // Click
  {
    action: 'click',
    patterns: [/^(click|tap|hit|press)$/],
    captureAs: 'selector',
    // "press" is overridden below if followed by a key name
  },

  // Double click
  {
    action: 'dblclick',
    patterns: [/^(doubleclick|double-click|dblclick)$/],
    captureAs: 'selector',
  },

  // Right click
  {
    action: 'rightclick',
    patterns: [/^(rightclick|right-click)$/],
    captureAs: 'selector',
  },

  // Type / Fill
  {
    action: 'type',
    patterns: [/^(type|enter|fill|input|write)$/],
    captureAs: 'value',
  },

  // Search (compound: type + press Enter)
  {
    action: 'search',
    patterns: [/^(search)$/],
    captureAs: 'value',
    compound: true,
  },

  // Keyboard press
  {
    action: 'press',
    patterns: [/^(press|keystroke)$/],
    captureAs: 'key',
    requireKey: true,
  },

  // Select / Dropdown
  {
    action: 'select',
    patterns: [/^(select|choose|pick)$/],
    captureAs: 'value',
  },

  // Hover
  {
    action: 'hover',
    patterns: [/^(hover|mouseover|mouse-over)$/],
    captureAs: 'selector',
  },

  // Scroll
  {
    action: 'scroll',
    patterns: [/^(scroll)$/],
    captureAs: 'direction',
  },

  // Wait
  {
    action: 'wait',
    patterns: [/^(wait|pause|sleep|delay)$/],
    captureAs: 'duration',
  },

  // Assertion - visibility
  {
    action: 'assert-visible',
    patterns: [/^(verify|check|assert|see|expect|confirm|ensure)$/],
    captureAs: 'condition',
  },

  // Screenshot
  {
    action: 'screenshot',
    patterns: [/^(screenshot|capture|snap|photo)$/],
    captureAs: null,
  },

  // Upload
  {
    action: 'upload',
    patterns: [/^(upload|attach)$/],
    captureAs: 'filepath',
  },

  // Accept alert/popup
  {
    action: 'accept',
    patterns: [/^(accept|ok|confirm|allow)$/],
    captureAs: null,
  },

  // Dismiss alert/popup
  {
    action: 'dismiss',
    patterns: [/^(dismiss|cancel|deny|reject|close)$/],
    captureAs: 'selector',
  },

  // Clear input
  {
    action: 'clear',
    patterns: [/^(clear|erase|empty|reset)$/],
    captureAs: 'selector',
  },

  // Focus
  {
    action: 'focus',
    patterns: [/^(focus|activate)$/],
    captureAs: 'selector',
  },

  // Drag
  {
    action: 'drag',
    patterns: [/^(drag|move)$/],
    captureAs: 'selector',
  },

  // Go back
  {
    action: 'back',
    patterns: [/^(back|goback|go-back)$/],
    captureAs: null,
  },

  // Go forward
  {
    action: 'forward',
    patterns: [/^(forward|goforward|go-forward)$/],
    captureAs: null,
  },

  // Reload
  {
    action: 'reload',
    patterns: [/^(reload|refresh)$/],
    captureAs: null,
  },

  // Login (compound: goto + fill user + fill pass + click login)
  {
    action: 'login',
    patterns: [/^(login|signin|sign-in|log-in)$/],
    captureAs: 'url',
    compound: true,
  },
];

// Known keyboard keys
export const KEY_MAP = {
  enter: 'Enter',
  return: 'Enter',
  tab: 'Tab',
  escape: 'Escape',
  esc: 'Escape',
  space: 'Space',
  spacebar: 'Space',
  backspace: 'Backspace',
  delete: 'Delete',
  del: 'Delete',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  f1: 'F1', f2: 'F2', f3: 'F3', f4: 'F4', f5: 'F5',
  f6: 'F6', f7: 'F7', f8: 'F8', f9: 'F9', f10: 'F10',
  f11: 'F11', f12: 'F12',
};

// Check if a word is a known key name
export function isKeyName(word) {
  return word.toLowerCase() in KEY_MAP;
}
