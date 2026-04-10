// Variable substitution: {{varname}} → value
// Loads vars from ~/.runly/vars/*.json and CLI --vars flag

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

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

// Substitute {{var}} with values
export function interpolate(template, vars) {
  if (!template || typeof template !== 'string') return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name) => {
    if (name in vars) {
      const val = vars[name];
      if (typeof val === 'object' && val !== null && 'value' in val) {
        return val.value;
      }
      return val;
    }
    return match;
  });
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
