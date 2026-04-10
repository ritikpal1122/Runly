import logger from '../utils/logger.js';

export async function loginCommand(url, options) {
  logger.banner();
  logger.warn('Login command coming in Phase 3 — session reuse');
  logger.dim(`  Will save auth session for: ${url}`);
}
