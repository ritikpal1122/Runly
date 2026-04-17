// ═══════════════════════════════════════════════════════════════════════════
// runly run <path>
// ═══════════════════════════════════════════════════════════════════════════
//
// Runs .runly test files. The core of "tests-as-code":
//   runly run tests/                     # all tests in directory
//   runly run tests/login.runly          # single file
//   runly run tests/ --tag critical       # filter by tag
//   runly run tests/ --parallel 4        # run 4 at a time
//   runly run tests/ --grep login        # filter by name/content
//   runly run tests/ --json              # NDJSON output for piping
//
// ═══════════════════════════════════════════════════════════════════════════

import { writeFileSync } from 'fs';
import chalk from 'chalk';
import logger from '../utils/logger.js';
import { loadTests, filterTests } from '../parser/fileParser.js';
import { parse } from '../parser/index.js';
import { parseWithAI } from '../ai/parser.js';
import { isAIAvailable } from '../ai/client.js';
import { runSteps } from '../runner/index.js';
import { runWithRetry } from '../runner/retry.js';
import { interpolate, mergeVars } from '../parser/interpolate.js';
import { getReportPath, getSpecPath } from '../utils/paths.js';
import { generate } from '../generator/index.js';
import { generateDashboard } from './report.js';
import { saveReport } from '../reporter/index.js';

export async function runCommand(path, options) {
  if (!options.json) logger.banner();

  // Load and filter tests
  let tests;
  try {
    tests = loadTests(path);
  } catch (err) {
    logger.error(err.message);
    process.exit(1);
  }

  if (tests.length === 0) {
    logger.warn(`No .runly files found in ${path}`);
    process.exit(1);
  }

  tests = filterTests(tests, options);

  if (tests.length === 0) {
    logger.warn('No tests match the filter criteria');
    process.exit(1);
  }

  // Variable substitution
  const vars = mergeVars(options);

  // JSON mode — pipe-friendly NDJSON output
  const jsonMode = !!options.json;

  if (!jsonMode) {
    logger.info(`Found ${tests.length} test${tests.length === 1 ? '' : 's'}`);
    if (options.tag) logger.dim(`  Filter: tag=${options.tag}`);
    if (options.grep) logger.dim(`  Filter: grep=${options.grep}`);
    console.log('');
  } else {
    emitJson({ type: 'run_start', testCount: tests.length });
  }

  // Execute tests
  const parallel = parseInt(options.parallel || '1', 10);
  const results = [];
  const startTime = Date.now();

  if (parallel === 1) {
    // Sequential
    for (const test of tests) {
      const r = await runSingleTest(test, vars, options, jsonMode);
      results.push(r);
    }
  } else {
    // Parallel batches
    for (let i = 0; i < tests.length; i += parallel) {
      const batch = tests.slice(i, i + parallel);
      const batchResults = await Promise.all(batch.map(t => runSingleTest(t, vars, options, jsonMode)));
      results.push(...batchResults);
    }
  }

  const totalDuration = Date.now() - startTime;
  const passed = results.filter(r => r.success).length;
  const failed = results.length - passed;
  const passRate = Math.round((passed / results.length) * 100);

  // ── Summary ──────────────────────────────────────────────────
  if (jsonMode) {
    emitJson({
      type: 'run_end',
      total: results.length,
      passed,
      failed,
      passRate,
      duration: totalDuration,
      results,
    });
  } else {
    console.log('');
    console.log('  ' + chalk.dim('─'.repeat(60)));
    console.log(
      '  ' +
      chalk.bold('Suite Results') +
      chalk.dim('   ') +
      `${passed} passed, ${failed} failed, ${totalDuration}ms total`
    );
    console.log('  ' + chalk.dim('─'.repeat(60)));
    console.log('');

    results.forEach((r, i) => {
      const num = chalk.dim(`${String(i + 1).padStart(2)}.`);
      const status = r.success ? chalk.green('✓') : chalk.red('✗');
      const name = chalk.white(r.name.padEnd(40).substring(0, 40));
      const time = chalk.dim(`${r.duration}ms`);
      const tags = r.tags.length > 0 ? chalk.dim(` [${r.tags.join(',')}]`) : '';
      console.log(`  ${num} ${status} ${name} ${time}${tags}`);
      if (!r.success && r.error) {
        console.log(`      ${chalk.red('→')} ${chalk.dim(r.error.substring(0, 70))}`);
      }
    });

    console.log('');
    if (failed === 0) {
      console.log('  ' + chalk.bgGreen.black.bold(' ALL PASSED ') + chalk.dim('   ') + `${passed}/${results.length} tests`);
    } else {
      console.log('  ' + chalk.bgRed.white.bold(' FAILED ') + chalk.dim('   ') + `${failed}/${results.length} tests failed (${passRate}% pass rate)`);
    }
    console.log('');

    // Auto-update HTML dashboard after suite run
    if (options.dashboard !== false) {
      try {
        const dash = generateDashboard({ limit: 50, silent: true });
        if (dash) {
          logger.dim(`  Dashboard:    ${dash.path}`);
          logger.dim(`                ${dash.total} runs · ${dash.passRate}% pass rate · avg ${dash.avgDuration}ms`);
        }
      } catch {}
      console.log('');
    }
  }

  if (failed > 0) process.exit(1);
}

// ── Run a single test ─────────────────────────────────────────────────────

async function runSingleTest(test, globalVars, options, jsonMode) {
  const testVars = { ...globalVars };

  // Interpolate each instruction separately so directives like `verify ai: X`
  // stay as single atomic lines (they'd otherwise be fragmented when joined
  // with " and " and run through the tokenizer).
  const interpolatedLines = (test.instructions || [test.combined]).map((line) =>
    interpolate(line, testVars)
  );
  const instruction = interpolatedLines.join(' and ');

  // Check required vars
  const missing = test.requiredVars.filter(v => !(v in testVars));
  if (missing.length > 0) {
    return {
      name: test.name,
      tags: test.tags,
      source: test.source,
      success: false,
      error: `Missing required variables: ${missing.join(', ')}`,
      duration: 0,
    };
  }

  if (jsonMode) {
    emitJson({ type: 'test_start', name: test.name, source: test.source });
  } else if (options.verbose) {
    logger.dim(`  → ${test.name}`);
  }

  // Parse per-line: regex parser first (handles AI assertions, normal actions),
  // fall back to Claude-powered parser only for lines the regex can't.
  const aiAvailable = isAIAvailable() && options.ai !== false;
  const steps = [];
  for (const line of interpolatedLines) {
    let lineSteps = parse(line);
    if (lineSteps.length === 0 && aiAvailable) {
      lineSteps = (await parseWithAI(line, options)) || [];
    }
    if (lineSteps.length > 0) steps.push(...lineSteps);
  }

  if (!steps || steps.length === 0) {
    return {
      name: test.name,
      tags: test.tags,
      source: test.source,
      success: false,
      error: 'Could not parse any steps from instruction',
      duration: 0,
    };
  }

  const runOpts = { ...options, pool: true };
  const result = (test.retry || options.retry)
    ? await runWithRetry(steps, { ...runOpts, retry: test.retry || options.retry })
    : await runSteps(steps, runOpts);

  // Auto-save JSON report
  try { saveReport(result, instruction); } catch {}

  // Auto-save Playwright spec file per test
  if (options.spec !== false && steps && steps.length > 0) {
    try {
      const code = generate(steps, { rawInput: instruction, headless: !options.headed });
      const namePrefix = (test.name || 'test').replace(/[^a-z0-9]/gi, '-').substring(0, 40);
      const specPath = getSpecPath(namePrefix);
      writeFileSync(specPath, code);
      if (!jsonMode && options.verbose) logger.dim(`    Spec: ${specPath}`);
    } catch {}
  }

  const summary = {
    name: test.name,
    tags: test.tags,
    source: test.source,
    success: result.success,
    duration: result.duration,
    totalSteps: result.totalSteps,
    passedSteps: result.passedSteps,
    error: result.error || null,
    url: result.url || null,
    screenshot: result.screenshot || null,
  };

  if (jsonMode) {
    emitJson({ type: 'test_end', ...summary });
  }

  return summary;
}

function emitJson(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}
