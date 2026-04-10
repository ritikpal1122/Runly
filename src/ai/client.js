import Anthropic from '@anthropic-ai/sdk';
import { readConfig, writeConfig } from '../utils/config.js';
import logger from '../utils/logger.js';

let client = null;

export async function getClient() {
  if (client) return client;

  // Check env var first, then saved config
  let apiKey = process.env.RUNLY_AI_KEY || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    const config = await readConfig();
    apiKey = config.apiKey;
  }

  if (!apiKey) {
    return null;
  }

  client = new Anthropic({ apiKey });
  return client;
}

export async function saveApiKey(key) {
  const config = await readConfig();
  config.apiKey = key;
  await writeConfig(config);
}

export function isAIAvailable() {
  return !!(process.env.RUNLY_AI_KEY || process.env.ANTHROPIC_API_KEY);
}

// Core function — send prompt to Claude, get response
export async function ask(systemPrompt, userMessage, options = {}) {
  const ai = await getClient();
  if (!ai) return null;

  try {
    const response = await ai.messages.create({
      model: options.model || 'claude-sonnet-4-20250514',
      max_tokens: options.maxTokens || 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = response.content[0]?.text || '';
    return text;
  } catch (err) {
    if (options.verbose) {
      logger.error(`AI error: ${err.message}`);
    }
    return null;
  }
}

// Ask and parse JSON response
export async function askJSON(systemPrompt, userMessage, options = {}) {
  const text = await ask(systemPrompt, userMessage, options);
  if (!text) return null;

  try {
    // Extract JSON from response (handles markdown code blocks)
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, text];
    const cleaned = jsonMatch[1].trim();
    return JSON.parse(cleaned);
  } catch {
    // Try to find JSON array or object directly
    try {
      const arrayMatch = text.match(/\[[\s\S]*\]/);
      if (arrayMatch) return JSON.parse(arrayMatch[0]);
      const objMatch = text.match(/\{[\s\S]*\}/);
      if (objMatch) return JSON.parse(objMatch[0]);
    } catch {}
    return null;
  }
}
