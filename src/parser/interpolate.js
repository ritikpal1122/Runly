// Variable substitution: {{varname}} → value
// Loads vars from ~/.runly/vars/*.json and CLI --vars flag
//
// Also supports {{faker.*}} expressions that resolve to synthetic data:
//   {{faker.person.firstName}}  → "Liam"
//   {{faker.internet.email}}    → "dylan.hansen@example.com"
//   {{faker.location.zipCode}}  → "12345"
// Each occurrence produces a fresh value at interpolation time.

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { faker } from '@faker-js/faker';

const VARS_DIR = join(homedir(), '.runly', 'vars');

export function loadGlobalVars() {
  if (!existsSync(VARS_DIR)) return {};
  const vars = {};
  try {
    for (const f of readdirSync(VARS_DIR).filter(f => f.endsWith('.json')).sort()) {
      try {
        Object.assign(vars, JSON.parse(readFileSync(join(VARS_DIR, f), 'utf8')));
      } catch {}
    }
  } catch {}
  return vars;
}

export function loadVarsFile(path) {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}

export function parseInlineVars(jsonStr) {
  if (!jsonStr) return {};
  try {
    return JSON.parse(jsonStr);
  } catch {
    return {};
  }
}

// Substitute {{var}} with values. Also resolves {{faker.x.y}} expressions.
//
// Resolution order:
//   1. faker.* paths             — {{faker.person.firstName}} → "Liam"
//   2. explicit vars from caller — {{user}} if vars.user exists
//   3. leave token unreplaced    — so downstream layers can still fill it
export function interpolate(template, vars) {
  if (!template || typeof template !== 'string') return template;
  return template.replace(/\{\{([\w.]+)\}\}/g, (match, path) => {
    if (path.startsWith('faker.')) {
      const val = resolveFakerPath(path.slice('faker.'.length));
      if (val != null) return String(val);
      return match;
    }
    if (path in vars) {
      const val = vars[path];
      if (typeof val === 'object' && val !== null && 'value' in val) {
        return val.value;
      }
      return val;
    }
    return match;
  });
}

// Walk a dotted path on the faker namespace and, if it lands on a function,
// call it. Returns undefined when the path is unknown or throws.
function resolveFakerPath(path) {
  try {
    const parts = path.split('.');
    let node = faker;
    for (const p of parts) {
      if (node == null) return undefined;
      node = node[p];
    }
    if (typeof node === 'function') return node.call(faker);
    return node;
  } catch {
    return undefined;
  }
}

// Merge variables from all sources
export function mergeVars(options) {
  const vars = { ...loadGlobalVars() };

  if (options.varsFile) {
    Object.assign(vars, loadVarsFile(options.varsFile));
  }

  if (options.vars) {
    Object.assign(vars, parseInlineVars(options.vars));
  }

  return vars;
}
