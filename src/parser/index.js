import { tokenize } from './tokenizer.js';
import { ACTION_RULES, isKeyName } from './actionMap.js';
import {
  resolveUrl,
  resolveKey,
  resolveSelector,
  resolveDuration,
  resolveScroll,
  resolveAssertion,
} from './resolver.js';

// Primary action keywords — these ALWAYS start a new action
const PRIMARY_ACTIONS = new Set([
  'open', 'goto', 'go', 'navigate', 'visit', 'launch', 'load', 'browse',
  'click', 'tap',
  'doubleclick', 'double-click', 'dblclick',
  'rightclick', 'right-click',
  'type', 'fill', 'input', 'write',
  'search',
  'select', 'choose', 'pick',
  'hover', 'mouseover',
  'scroll',
  'wait', 'pause', 'sleep', 'delay',
  'verify', 'check', 'assert', 'see', 'expect', 'confirm', 'ensure',
  'screenshot', 'capture', 'snap',
  'upload', 'attach',
  'accept',
  'dismiss', 'cancel',
  'clear', 'erase', 'empty',
  'focus', 'activate',
  'drag',
  'back', 'goback',
  'forward', 'goforward',
  'reload', 'refresh',
]);

// Words that can be both action AND target — only treat as new action at boundaries
const AMBIGUOUS_WORDS = new Set([
  'enter', 'press', 'hit', 'login', 'signin', 'sign-in', 'log-in',
  'close', 'submit', 'reset',
]);

export function parse(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return [];

  // AI assertion short-circuit — `verify ai: <free-form English>` is parsed
  // as a single atomic step. The assertion text may contain "and", commas,
  // etc., which would otherwise confuse the regex tokenizer.
  const trimmed = rawInput.trim();
  const aiMatch = trimmed.match(/^(?:verify|assert|check|ensure|confirm)\s+ai\s*:\s*(.+)$/i);
  if (aiMatch) {
    return [{
      action: 'ai-assert',
      assertion: aiMatch[1].trim(),
      raw: trimmed,
    }];
  }

  const tokens = tokenize(rawInput); // [{lower, original}, ...]
  if (tokens.length === 0) return [];

  const steps = [];
  let i = 0;

  while (i < tokens.length) {
    const lower = tokens[i].lower;

    const rule = findMatchingRule(lower);
    if (!rule) {
      i++;
      continue;
    }

    // Special: "press/hit" + key name → keyboard press
    if ((lower === 'press' || lower === 'hit') &&
        i + 1 < tokens.length && isKeyName(tokens[i + 1].lower)) {
      steps.push({
        action: 'press',
        key: resolveKey(tokens[i + 1].lower),
        raw: `press ${tokens[i + 1].lower}`,
      });
      i += 2;
      continue;
    }

    // Collect argument tokens
    i++;
    const argLower = [];    // for matching/parsing
    const argOriginal = []; // for values (preserve case)

    while (i < tokens.length) {
      const t = tokens[i].lower;

      // Skip "on" right after click/tap
      if (t === 'on' && argLower.length === 0 &&
          (lower === 'click' || lower === 'tap' || lower === 'hit')) {
        i++;
        continue;
      }

      // Skip "to" right after go/navigate/scroll/drag
      if (t === 'to' && argLower.length === 0 &&
          (lower === 'go' || lower === 'navigate' || lower === 'scroll' || lower === 'drag')) {
        i++;
        continue;
      }

      // Skip "for" right after search/wait
      if (t === 'for' && argLower.length === 0 &&
          (lower === 'search' || lower === 'wait')) {
        i++;
        continue;
      }

      // "in" / "into" / "on" in MIDDLE → keep as field separator
      if ((t === 'in' || t === 'into' || t === 'on') && argLower.length > 0) {
        argLower.push(t);
        argOriginal.push(tokens[i].original);
        i++;
        continue;
      }

      // New PRIMARY action → break
      if (PRIMARY_ACTIONS.has(t)) {
        break;
      }

      // AMBIGUOUS word
      if (AMBIGUOUS_WORDS.has(t)) {
        if (argLower.length === 0) {
          // No args yet → this is a target ("click on login button")
          argLower.push(t);
          argOriginal.push(tokens[i].original);
          i++;
          continue;
        }

        // Has args → check if it's a new action
        // "enter X in Y enter Z in W" — second "enter" starts new action
        if (t === 'enter' && i + 1 < tokens.length && !PRIMARY_ACTIONS.has(tokens[i + 1].lower)) {
          break;
        }

        argLower.push(t);
        argOriginal.push(tokens[i].original);
        i++;
        continue;
      }

      argLower.push(t);
      argOriginal.push(tokens[i].original);
      i++;
    }

    const step = buildStep(rule, argLower, argOriginal, lower, rawInput);
    if (step) {
      if (Array.isArray(step)) {
        steps.push(...step);
      } else {
        steps.push(step);
      }
    }
  }

  return steps;
}

function findMatchingRule(token) {
  for (const rule of ACTION_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(token)) {
        return rule;
      }
    }
  }
  return null;
}

// argLower = lowercase tokens (for parsing logic)
// argOrig  = original case tokens (for values like emails/passwords)

function buildStep(rule, argLower, argOrig, keyword, raw) {
  const argText = argLower.join(' ');
  const argOrigText = argOrig.join(' ');

  switch (rule.action) {
    case 'goto':
      return {
        action: 'goto',
        url: resolveUrl(argOrig[0] || ''),
        raw: `goto ${argOrigText}`,
      };

    case 'click':
      return {
        action: 'click',
        selector: resolveSelector(argLower),
        raw: `click ${argText}`,
      };

    case 'dblclick':
      return {
        action: 'dblclick',
        selector: resolveSelector(argLower),
        raw: `dblclick ${argText}`,
      };

    case 'rightclick':
      return {
        action: 'rightclick',
        selector: resolveSelector(argLower),
        raw: `rightclick ${argText}`,
      };

    case 'type': {
      // "type/enter VALUE in/into FIELD"
      const inIdx = findSeparatorIndex(argLower);
      if (inIdx > 0) {
        const value = argOrig.slice(0, inIdx).join(' ');       // preserve case
        const field = argLower.slice(inIdx + 1).join(' ');     // lowercase for selector
        return {
          action: 'type',
          value,
          selector: resolveSelector(argLower.slice(inIdx + 1)),
          raw: `type ${argOrigText}`,
        };
      }
      return {
        action: 'type',
        value: argOrigText, // preserve case for passwords/emails
        selector: null,
        raw: `type ${argOrigText}`,
      };
    }

    case 'search':
      return [
        {
          action: 'type',
          value: argOrigText,
          selector: null,
          raw: `search ${argOrigText}`,
        },
        {
          action: 'press',
          key: 'Enter',
          raw: 'press Enter',
        },
      ];

    case 'press':
      return {
        action: 'press',
        key: resolveKey(argLower[0] || 'Enter'),
        raw: `press ${argText}`,
      };

    case 'select': {
      const fromMatch = argText.match(/^(.+?)\s+from\s+(.+)$/);
      if (fromMatch) {
        return {
          action: 'select',
          value: fromMatch[1].trim(),
          selector: resolveSelector(fromMatch[2].trim().split(' ')),
          raw: `select ${argText}`,
        };
      }
      return {
        action: 'select',
        value: argOrigText,
        selector: null,
        raw: `select ${argText}`,
      };
    }

    case 'hover':
      return {
        action: 'hover',
        selector: resolveSelector(argLower),
        raw: `hover ${argText}`,
      };

    case 'scroll':
      return {
        action: 'scroll',
        direction: resolveScroll(argLower),
        raw: `scroll ${argText}`,
      };

    case 'wait':
      return {
        action: 'wait',
        duration: resolveDuration(argLower[0]),
        raw: `wait ${argText}`,
      };

    case 'assert-visible':
      return {
        action: 'assert',
        assertion: resolveAssertion(argLower),
        raw: `assert ${argText}`,
      };

    case 'screenshot':
      return { action: 'screenshot', raw: 'screenshot' };

    case 'upload':
      return {
        action: 'upload',
        filepath: argOrigText,
        selector: null,
        raw: `upload ${argOrigText}`,
      };

    case 'accept':
      return { action: 'accept', raw: 'accept dialog' };

    case 'dismiss':
      if (argLower.length === 0) {
        return { action: 'dismiss', raw: 'dismiss dialog' };
      }
      return {
        action: 'click',
        selector: resolveSelector(argLower),
        raw: `close ${argText}`,
      };

    case 'clear':
      return {
        action: 'clear',
        selector: resolveSelector(argLower),
        raw: `clear ${argText}`,
      };

    case 'focus':
      return {
        action: 'focus',
        selector: resolveSelector(argLower),
        raw: `focus ${argText}`,
      };

    case 'drag': {
      const toMatch = argText.match(/^(.+?)\s+to\s+(.+)$/);
      if (toMatch) {
        return {
          action: 'drag',
          source: resolveSelector(toMatch[1].trim().split(' ')),
          target: resolveSelector(toMatch[2].trim().split(' ')),
          raw: `drag ${argText}`,
        };
      }
      return {
        action: 'drag',
        source: resolveSelector(argLower),
        target: null,
        raw: `drag ${argText}`,
      };
    }

    case 'back':
      return { action: 'back', raw: 'go back' };

    case 'forward':
      return { action: 'forward', raw: 'go forward' };

    case 'reload':
      return { action: 'reload', raw: 'reload' };

    case 'login':
      return {
        action: 'goto',
        url: resolveUrl(argOrig[0] || ''),
        raw: `login ${argOrigText}`,
      };

    default:
      return null;
  }
}

// Find "in" / "into" / "on" separator in arg tokens
// Returns index of separator, or -1 if not found
function findSeparatorIndex(argLower) {
  for (let i = argLower.length - 1; i >= 1; i--) {
    if (argLower[i] === 'in' || argLower[i] === 'into' || argLower[i] === 'on') {
      return i;
    }
  }
  return -1;
}
