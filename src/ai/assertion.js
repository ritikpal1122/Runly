// ═══════════════════════════════════════════════════════════════════════════
// AI ASSERTIONS
// ═══════════════════════════════════════════════════════════════════════════
//
// Runs fuzzy semantic assertions against the page by sending a DOM snapshot
// and the assertion text to Claude, getting back a structured pass/fail.
//
// Parser recognizes:  verify ai: <English assertion>
//                     assert ai: <English assertion>
//
// Examples:
//   verify ai: the cart total equals the sum of all item prices
//   verify ai: a welcome banner with the user's name is shown
//   verify ai: the page has no error messages
// ═══════════════════════════════════════════════════════════════════════════

import { askJSON, isAIAvailable } from './client.js';
import { captureDomSnapshot } from './domSnapshot.js';

const SYSTEM_PROMPT = `You are a QA verification agent. Given a DOM snapshot of a web page and an English assertion to verify, decide whether the assertion is TRUE or FALSE based only on the evidence in the DOM.

You will respond with a JSON object of the form:
{
  "passed": boolean,
  "reasoning": "one short sentence on why",
  "evidence": "the specific text or element from the DOM that supports your decision"
}

Guardrails:
- If the DOM does not contain enough information to decide, set "passed": false and explain in "reasoning".
- Do NOT hallucinate elements or text that are not in the snapshot.
- Numeric assertions (e.g. "total equals sum of items") require you to actually compute the sum from visible prices.
- Be strict. If the assertion is ambiguous, err on the side of FALSE with a clear reasoning message.
- Respond with ONLY the JSON object, no prose before or after.`;

export async function aiAssertion(page, assertion, options = {}) {
  if (!isAIAvailable()) {
    return {
      passed: false,
      reasoning:
        'AI assertion requires ANTHROPIC_API_KEY. Run `runly auth sk-ant-...` first.',
      evidence: null,
      aiUnavailable: true,
    };
  }

  const dom = await captureDomSnapshot(page, { maxElements: 120 });
  const url = page.url();
  const title = await page.title().catch(() => '');

  const userMessage = `URL: ${url}
Title: ${title}

ASSERTION TO VERIFY:
${assertion}

DOM SNAPSHOT:
${dom}`;

  const response = await askJSON(SYSTEM_PROMPT, userMessage, {
    maxTokens: 512,
    model: options.model || 'claude-sonnet-4-20250514',
  });

  if (!response || typeof response.passed !== 'boolean') {
    return {
      passed: false,
      reasoning: 'AI did not return a valid verdict — treating as failure.',
      evidence: null,
    };
  }

  return {
    passed: response.passed,
    reasoning: response.reasoning || '',
    evidence: response.evidence || null,
  };
}
