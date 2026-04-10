// ═══════════════════════════════════════════════════════════════════════════
// SESSION STORE — Auto-reuse auth state per domain
// ═══════════════════════════════════════════════════════════════════════════
//
// After a successful login, save the browser's storageState (cookies,
// localStorage) keyed by domain. On the next test for the same domain,
// load the session automatically — skip login entirely.
//
// ═══════════════════════════════════════════════════════════════════════════

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const SESSIONS_DIR = join(homedir(), '.runly', 'sessions');

function ensureDir() {
  mkdirSync(SESSIONS_DIR, { recursive: true });
}

// Extract domain from URL
export function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function getSessionPath(domain) {
  return join(SESSIONS_DIR, `${domain}.json`);
}

// ── Save session state for a domain ────────────────────────────────────────

export async function saveSession(context, domain) {
  if (!domain) return false;
  ensureDir();
  try {
    await context.storageState({ path: getSessionPath(domain) });
    return true;
  } catch {
    return false;
  }
}

// ── Load saved session for a domain (returns path or null) ─────────────────

export function loadSession(domain) {
  if (!domain) return null;
  const path = getSessionPath(domain);
  if (!existsSync(path)) return null;

  // Check if session is stale (older than 7 days)
  try {
    const stat = statSync(path);
    const age = Date.now() - stat.mtimeMs;
    if (age > 7 * 24 * 60 * 60 * 1000) {
      unlinkSync(path);
      return null;
    }
    return path;
  } catch {
    return null;
  }
}

// ── List all saved sessions ────────────────────────────────────────────────

export function listSessions() {
  ensureDir();
  try {
    return readdirSync(SESSIONS_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const domain = f.replace('.json', '');
        const stat = statSync(join(SESSIONS_DIR, f));
        return {
          domain,
          path: join(SESSIONS_DIR, f),
          savedAt: stat.mtime,
          ageHours: (Date.now() - stat.mtimeMs) / (1000 * 60 * 60),
        };
      });
  } catch {
    return [];
  }
}

// ── Delete a saved session ─────────────────────────────────────────────────

export function clearSession(domain) {
  const path = getSessionPath(domain);
  if (existsSync(path)) {
    unlinkSync(path);
    return true;
  }
  return false;
}

export function clearAllSessions() {
  const sessions = listSessions();
  for (const s of sessions) {
    try { unlinkSync(s.path); } catch {}
  }
  return sessions.length;
}
