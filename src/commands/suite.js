// runly suite run <file> [--parallel N] [--tag critical]
// Runs a test suite from a JSON or YAML config file

import { readFileSync, existsSync } from 'fs';
import { spawn } from 'child_process';
import logger from '../utils/logger.js';
import chalk from 'chalk';

export async function suiteCommand(action, file, options) {
  logger.banner();

  if (action !== 'run') {
    logger.error(`Unknown suite action: ${action}. Use "runly suite run <file>"`);
    return;
  }

  if (!file || !existsSync(file)) {
    logger.error(`Suite file not found: ${file}`);
    return;
  }

  // Parse suite file (JSON; simple YAML-ish also supported)
  const raw = readFileSync(file, 'utf8');
  let suite;
  try {
    suite = JSON.parse(raw);
  } catch {
    suite = parseSimpleYaml(raw);
  }

  if (!suite || !Array.isArray(suite.tests)) {
    logger.error('Invalid suite file. Expected: { "tests": [ { "name": "...", "instruction": "..." } ] }');
    return;
  }

  // Filter by tag if requested
  let tests = suite.tests;
  if (options.tag) {
    tests = tests.filter(t => (t.tags || []).includes(options.tag));
    if (tests.length === 0) {
      logger.warn(`No tests with tag "${options.tag}"`);
      return;
    }
  }

  logger.info(`Running suite: ${suite.name || 'unnamed'}`);
  logger.dim(`  ${tests.length} tests (parallel: ${options.parallel || 1})`);

  const parallel = parseInt(options.parallel || '1', 10);
  const results = [];
  const startTime = Date.now();

  // Execute in batches
  for (let i = 0; i < tests.length; i += parallel) {
    const batch = tests.slice(i, i + parallel);
    const batchResults = await Promise.all(batch.map(t => runOneTest(t, options)));
    results.push(...batchResults);
  }

  const totalDuration = Date.now() - startTime;

  // Summary table
  console.log('\n' + chalk.bold('  Suite Results:'));
  console.log('  ' + '─'.repeat(70));
  console.log('  ' + chalk.bold('# Test                              Status  Duration'));
  console.log('  ' + '─'.repeat(70));

  results.forEach((r, i) => {
    const status = r.success ? chalk.green('✓ pass') : chalk.red('✗ fail');
    const name = (r.name || 'unnamed').padEnd(35).substring(0, 35);
    console.log(`  ${String(i + 1).padStart(2)} ${name}  ${status}   ${r.duration}ms`);
  });

  console.log('  ' + '─'.repeat(70));

  const passed = results.filter(r => r.success).length;
  const failed = results.length - passed;
  const passRate = Math.round((passed / results.length) * 100);

  console.log('');
  if (failed === 0) {
    logger.success(`All ${results.length} tests passed (${totalDuration}ms)`);
  } else {
    logger.error(`${failed}/${results.length} tests failed (${passRate}% pass rate)`);
  }

  if (failed > 0) process.exit(1);
}

async function runOneTest(test, options) {
  return new Promise((resolve) => {
    const start = Date.now();
    const args = ['test', test.instruction];
    if (options.noAi) args.push('--no-ai');

    const child = spawn('runly', args, { stdio: 'pipe' });
    let output = '';

    child.stdout.on('data', (d) => { output += d.toString(); });
    child.stderr.on('data', (d) => { output += d.toString(); });

    child.on('exit', (code) => {
      resolve({
        name: test.name,
        instruction: test.instruction,
        success: code === 0,
        duration: Date.now() - start,
        output,
      });
    });
  });
}

// Very simple YAML-ish parser for tests: [{name: X, instruction: Y, tags: [...]}]
function parseSimpleYaml(text) {
  try {
    // Convert very basic YAML to JSON — user should really use JSON for reliability
    const lines = text.split('\n').filter(l => !l.trim().startsWith('#'));
    const jsonLike = lines.join('\n')
      .replace(/^(\s*)([a-z_]+):\s*$/gim, '$1"$2":')
      .replace(/^(\s*)([a-z_]+):\s*(.+)$/gim, '$1"$2": $3');
    return JSON.parse('{' + jsonLike + '}');
  } catch {
    return null;
  }
}
