// ═══════════════════════════════════════════════════════════════════════════
// RUNLY MCP TOOL HANDLERS
// ═══════════════════════════════════════════════════════════════════════════
//
// Pure functions that wrap Runly internals (parser, runner, inspector) and
// return JSON-serializable results. Called from src/mcp/server.js.
//
// None of these may write to stdout — MCP stdio transport owns stdout.
// Internal logger calls are redirected to stderr before the server starts.
// ═══════════════════════════════════════════════════════════════════════════

import { chromium } from 'playwright';
import { parse } from '../parser/index.js';
import { parseWithAI } from '../ai/parser.js';
import { runSteps } from '../runner/index.js';
import { isAIAvailable } from '../ai/client.js';
import { interpolate, mergeVars } from '../parser/interpolate.js';
import {
  discoverTestFiles,
  parseRunlyFile,
  filterTests,
} from '../parser/fileParser.js';
import { findElement } from '../runner/selectorEngine.js';
import { resolveSelector } from '../parser/resolver.js';
import { getLastRun } from '../utils/config.js';

// ── 1. runly_test — run an English instruction ─────────────────────────────

export async function handleTest({
  instruction,
  browser = 'chromium',
  headed = false,
  vars = {},
  noAi = false,
}) {
  if (!instruction || typeof instruction !== 'string') {
    throw new Error('instruction is required (string)');
  }

  const merged = mergeVars({ vars: JSON.stringify(vars) });
  const interpolated = interpolate(instruction, merged);

  let steps = parse(interpolated);
  if (steps.length === 0 && isAIAvailable() && !noAi) {
    steps = (await parseWithAI(interpolated)) || [];
  }

  if (steps.length === 0) {
    return {
      success: false,
      error: 'Could not parse instruction into steps',
      instruction: interpolated,
    };
  }

  const result = await runSteps(steps, {
    browser,
    headed,
    ai: !noAi,
    verbose: false,
    pool: !headed,
  });

  return {
    success: result.success,
    duration_ms: result.duration,
    steps: result.steps,
    step_results: result.results,
    url: result.url,
    title: result.title || null,
    screenshot: result.screenshot || null,
    total_steps: result.totalSteps,
    passed_steps: result.passedSteps,
    failed_step: result.failedStep || null,
    error: result.error || null,
    pooled_browser: !!result.pooled,
    instruction: interpolated,
  };
}

// ── 2. runly_run_file — run a .runly file ──────────────────────────────────

export async function handleRunFile({
  path,
  browser = 'chromium',
  headed = false,
  vars = {},
  tag = null,
  grep = null,
  noAi = false,
}) {
  if (!path || typeof path !== 'string') {
    throw new Error('path is required (string)');
  }

  const files = discoverTestFiles(path);
  if (files.length === 0) {
    return { success: false, error: `No .runly files found at ${path}`, results: [] };
  }

  const allTests = files.flatMap((f) => {
    try {
      return parseRunlyFile(f);
    } catch {
      return [];
    }
  });

  const selected = filterTests(allTests, { tag, grep });
  if (selected.length === 0) {
    return {
      success: false,
      error: 'No tests matched the filter',
      total: allTests.length,
      filtered: 0,
      results: [],
    };
  }

  const merged = mergeVars({ vars: JSON.stringify(vars) });
  const results = [];

  for (const t of selected) {
    const interpolated = interpolate(t.combined, merged);
    let steps = parse(interpolated);
    if (steps.length === 0 && isAIAvailable() && !noAi) {
      steps = (await parseWithAI(interpolated)) || [];
    }

    if (steps.length === 0) {
      results.push({
        name: t.name,
        source: t.source,
        success: false,
        error: 'Failed to parse',
      });
      continue;
    }

    const result = await runSteps(steps, {
      browser,
      headed,
      ai: !noAi,
      verbose: false,
      pool: !headed,
    });

    results.push({
      name: t.name,
      tags: t.tags,
      source: t.source,
      success: result.success,
      duration_ms: result.duration,
      total_steps: result.totalSteps,
      passed_steps: result.passedSteps,
      failed_step: result.failedStep || null,
      url: result.url,
      title: result.title || null,
      error: result.error || null,
      screenshot: result.screenshot || null,
    });
  }

  const passed = results.filter((r) => r.success).length;
  return {
    success: passed === results.length,
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}

// ── 3. runly_list_tests — discover .runly files ────────────────────────────

export async function handleListTests({ path = '.' }) {
  const files = discoverTestFiles(path);
  const all = [];
  for (const f of files) {
    try {
      const tests = parseRunlyFile(f);
      for (const t of tests) {
        all.push({
          name: t.name,
          description: t.description,
          tags: t.tags,
          file: t.source,
          instructions: t.instructions,
          required_vars: t.requiredVars,
        });
      }
    } catch (err) {
      all.push({ file: f, error: err.message });
    }
  }
  return { count: all.length, tests: all };
}

// ── 4. runly_inspect — find elements on a URL ──────────────────────────────

export async function handleInspect({
  url,
  description,
  headed = false,
  limit = 5,
}) {
  if (!url) throw new Error('url is required');
  if (!description) throw new Error('description is required');

  const fullUrl = /^https?:\/\//.test(url) ? url : `https://${url}`;
  const b = await chromium.launch({ headless: !headed });
  const page = await b.newPage();

  try {
    await page.goto(fullUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    const selector = resolveSelector(description.split(' '));
    const element = await findElement(page, selector);

    if (!element) {
      return {
        url: fullUrl,
        description,
        selector_descriptor: selector,
        count: 0,
        elements: [],
      };
    }

    const count = await element.count();
    const matches = [];

    for (let i = 0; i < Math.min(count, limit); i++) {
      const el = element.nth(i);
      const tag = await el.evaluate((e) => e.tagName.toLowerCase()).catch(() => '?');
      const text = (await el.textContent().catch(() => '') || '').trim().substring(0, 80);
      const id = await el.getAttribute('id').catch(() => null);
      const className = await el.getAttribute('class').catch(() => null);
      const testid = await el.getAttribute('data-testid').catch(() => null);
      const ariaLabel = await el.getAttribute('aria-label').catch(() => null);

      matches.push({
        index: i + 1,
        tag,
        text: text || null,
        id,
        testid,
        aria_label: ariaLabel,
        class_name: className ? className.substring(0, 120) : null,
      });
    }

    return {
      url: fullUrl,
      description,
      selector_descriptor: selector,
      count,
      shown: matches.length,
      elements: matches,
    };
  } finally {
    await b.close().catch(() => {});
  }
}

// ── 5. runly_open_url — quick health check ─────────────────────────────────

export async function handleOpenUrl({ url, browser = 'chromium' }) {
  if (!url) throw new Error('url is required');
  const fullUrl = /^https?:\/\//.test(url) ? url : `https://${url}`;

  const start = Date.now();
  const b = await chromium.launch({ headless: true });
  const page = await b.newPage();
  try {
    const response = await page.goto(fullUrl, { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    return {
      url: page.url(),
      requested_url: fullUrl,
      status: response ? response.status() : null,
      title,
      duration_ms: Date.now() - start,
    };
  } finally {
    await b.close().catch(() => {});
  }
}

// ── 6. runly_last_run — fetch last run summary ─────────────────────────────

export async function handleLastRun() {
  try {
    const last = await getLastRun();
    if (!last) return { exists: false };
    return { exists: true, ...last };
  } catch (err) {
    return { exists: false, error: err.message };
  }
}
