import { askJSON, isAIAvailable } from './client.js';
import { PARSER_SYSTEM, buildParserPrompt } from './prompts.js';
import { parse as regexParse } from '../parser/index.js';
import { resolveSelector } from '../parser/resolver.js';
import logger from '../utils/logger.js';

// Parse with AI, fallback to regex on failure or unavailable

export async function parseWithAI(userInput, options = {}) {
  // If AI not available, use regex parser
  if (!isAIAvailable()) {
    if (options.verbose) logger.dim('  AI unavailable — using regex parser');
    return regexParse(userInput);
  }

  if (options.verbose) logger.dim('  Parsing with AI...');

  const aiSteps = await askJSON(
    PARSER_SYSTEM,
    buildParserPrompt(userInput),
    { maxTokens: 2048, verbose: options.verbose }
  );

  // AI failed — fallback to regex
  if (!aiSteps || !Array.isArray(aiSteps) || aiSteps.length === 0) {
    if (options.verbose) logger.warn('  AI parsing failed — falling back to regex');
    return regexParse(userInput);
  }

  // Convert AI output to Runly's internal step format
  return aiSteps.map(step => normalizeAIStep(step)).filter(Boolean);
}

// Convert AI step format to Runly's step format
function normalizeAIStep(aiStep) {
  const action = aiStep.action;

  switch (action) {
    case 'goto':
      return {
        action: 'goto',
        url: aiStep.url,
        raw: `goto ${aiStep.url}`,
      };

    case 'click':
      return {
        action: 'click',
        selector: targetToSelector(aiStep.target),
        raw: `click ${aiStep.target}`,
      };

    case 'type':
      return {
        action: 'type',
        value: aiStep.value,
        selector: aiStep.target ? targetToSelector(aiStep.target) : null,
        raw: `type ${aiStep.value} into ${aiStep.target || 'input'}`,
      };

    case 'press':
      return {
        action: 'press',
        key: aiStep.key,
        raw: `press ${aiStep.key}`,
      };

    case 'select':
      return {
        action: 'select',
        value: aiStep.value,
        selector: aiStep.target ? targetToSelector(aiStep.target) : null,
        raw: `select ${aiStep.value} from ${aiStep.target || 'dropdown'}`,
      };

    case 'hover':
      return {
        action: 'hover',
        selector: targetToSelector(aiStep.target),
        raw: `hover ${aiStep.target}`,
      };

    case 'scroll':
      return {
        action: 'scroll',
        direction: aiStep.direction || 'down',
        raw: `scroll ${aiStep.direction || 'down'}`,
      };

    case 'wait':
      return {
        action: 'wait',
        duration: aiStep.duration || 1000,
        raw: `wait ${aiStep.duration || 1000}ms`,
      };

    case 'screenshot':
      return { action: 'screenshot', raw: 'screenshot' };

    case 'upload':
      return {
        action: 'upload',
        filepath: aiStep.filepath,
        selector: null,
        raw: `upload ${aiStep.filepath}`,
      };

    case 'assert':
      return {
        action: 'assert',
        assertion: {
          type: aiStep.type || 'visible',
          target: aiStep.target ? targetToSelector(aiStep.target) : null,
          value: aiStep.value,
          count: aiStep.count,
        },
        raw: `assert ${aiStep.type || 'visible'} ${aiStep.target || aiStep.value || ''}`,
      };

    case 'back':
      return { action: 'back', raw: 'go back' };

    case 'forward':
      return { action: 'forward', raw: 'go forward' };

    case 'reload':
      return { action: 'reload', raw: 'reload' };

    default:
      return null;
  }
}

// Convert AI's natural language target into Runly's selector format
function targetToSelector(target) {
  if (!target) return { strategy: 'text', value: '' };

  // If it's already a CSS selector
  if (target.startsWith('#') || target.startsWith('.') || target.startsWith('[')) {
    return { strategy: 'css', value: target };
  }

  // Use the existing regex resolver for natural language → selector
  return resolveSelector(target.split(' '));
}
