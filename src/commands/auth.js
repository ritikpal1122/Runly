import logger from '../utils/logger.js';
import { saveApiKey, isAIAvailable } from '../ai/client.js';

export async function authCommand(key) {
  logger.banner();

  if (!key) {
    if (isAIAvailable()) {
      logger.success('AI mode is enabled');
      logger.dim('  Using API key from environment variable');
    } else {
      logger.warn('No API key configured');
      logger.dim('  Set with: runly auth <your-anthropic-api-key>');
      logger.dim('  Or env:   export ANTHROPIC_API_KEY=sk-ant-...');
    }
    return;
  }

  if (!key.startsWith('sk-ant-')) {
    logger.error('Invalid API key format. Should start with "sk-ant-"');
    return;
  }

  await saveApiKey(key);
  logger.success('API key saved — AI mode enabled');
  logger.dim('  Stored at: ~/.runly/config.json');
}
