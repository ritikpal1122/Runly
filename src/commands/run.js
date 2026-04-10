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
import { getReportPath } from '../utils/paths.js';

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
  }

  if (failed > 0) process.exit(1);
}

// ── Run a single test ─────────────────────────────────────────────────────

async function runSingleTest(test, globalVars, options, jsonMode) {
  const testVars = { ...globalVars };
  const instruction = interpolate(test.combined, testVars);

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

  const aiAvailable = isAIAvailable() && options.ai !== false;
  const steps = aiAvailable
    ? await parseWithAI(instruction, options)
    : parse(instruction);

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
