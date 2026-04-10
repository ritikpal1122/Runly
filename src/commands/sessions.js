// runly sessions list | clear
// Manage saved auth sessions

import logger from '../utils/logger.js';
import { listSessions, clearSession, clearAllSessions } from '../runner/sessionStore.js';

export async function sessionsCommand(action, target) {
  logger.banner();

  if (!action || action === 'list') {
    const sessions = listSessions();
    if (sessions.length === 0) {
      logger.dim('  No saved sessions');
      return;
    }
    logger.info(`${sessions.length} saved session(s):`);
    sessions.forEach(s => {
      const age = s.ageHours < 1
        ? `${Math.round(s.ageHours * 60)}m`
        : s.ageHours < 24
          ? `${Math.round(s.ageHours)}h`
          : `${Math.round(s.ageHours / 24)}d`;
      logger.dim(`  ${s.domain.padEnd(30)} saved ${age} ago`);
    });
    return;
  }

  if (action === 'clear') {
    if (target) {
      const removed = clearSession(target);
      if (removed) {
        logger.success(`Cleared session for ${target}`);
      } else {
        logger.warn(`No session for ${target}`);
      }
    } else {
      const count = clearAllSessions();
      logger.success(`Cleared ${count} session(s)`);
    }
    return;
  }

  logger.error(`Unknown action: ${action}. Use "runly sessions list" or "runly sessions clear [domain]"`);
}
