// ═══════════════════════════════════════════════════════════════════════════
// runly import <path> [--out <dir>]
// ═══════════════════════════════════════════════════════════════════════════

import chalk from 'chalk';
import { relative } from 'path';
import logger from '../utils/logger.js';
import { importPath } from '../importer/index.js';

export async function importCommand(path, options = {}) {
  logger.banner();

  let results;
  try {
    results = importPath(path, { outDir: options.out });
  } catch (err) {
    logger.error(err.message);
    process.exit(1);
  }

  if (results.length === 0) {
    logger.warn('No .spec.ts / .spec.js / .test.ts / .test.js files found');
    return;
  }

  let totalTests = 0;
  let totalConverted = 0;
  let totalTodos = 0;

  console.log('');
  for (const r of results) {
    const rel = relative(process.cwd(), r.output);
    const srcRel = relative(process.cwd(), r.source);
    totalTests += r.testsFound;
    totalConverted += r.converted || 0;
    totalTodos += r.todos || 0;

    const status = r.todos > 0 ? chalk.yellow('⚠') : chalk.green('✓');
    console.log(
      `  ${status} ${chalk.dim(srcRel)} ${chalk.dim('→')} ${chalk.cyan(rel)}`
    );
    console.log(
      `      ${chalk.dim(
        `${r.testsFound} test${r.testsFound === 1 ? '' : 's'}, ${
          r.converted || 0
        } steps converted${r.todos ? `, ${r.todos} TODO line${r.todos === 1 ? '' : 's'}` : ''}`
      )}`
    );
  }

  console.log('');
  console.log(
    '  ' +
      chalk.bgGreen.black.bold(' IMPORTED ') +
      chalk.dim('   ') +
      `${results.length} file${results.length === 1 ? '' : 's'} · ${totalTests} tests · ${totalConverted} steps`
  );
  if (totalTodos > 0) {
    console.log(
      '  ' +
        chalk.bgYellow.black.bold(' REVIEW   ') +
        chalk.dim('   ') +
        `${totalTodos} unconverted line${totalTodos === 1 ? '' : 's'} marked # TODO — see output files`
    );
  }
  console.log('');
  console.log(chalk.dim('  Next: runly run <output-path>'));
  console.log('');
}
