// runly diff reportA.json reportB.json
// Compares two test reports side by side

import { readFileSync, existsSync } from 'fs';
import chalk from 'chalk';
import logger from '../utils/logger.js';

export async function diffCommand(pathA, pathB) {
  logger.banner();

  if (!existsSync(pathA)) {
    logger.error(`Report not found: ${pathA}`);
    process.exit(1);
  }
  if (!existsSync(pathB)) {
    logger.error(`Report not found: ${pathB}`);
    process.exit(1);
  }

  const a = JSON.parse(readFileSync(pathA, 'utf8'));
  const b = JSON.parse(readFileSync(pathB, 'utf8'));

  console.log('');
  console.log(chalk.bold('  Rerun Comparison'));
  console.log(chalk.dim(`  A: ${pathA}`));
  console.log(chalk.dim(`  B: ${pathB}`));
  console.log('');

  const row = (label, va, vb) => {
    const match = va === vb;
    const delta = match ? chalk.green('=') : chalk.red('≠');
    console.log(`  ${delta} ${chalk.bold(label.padEnd(14))} ${String(va).padEnd(30)} ${vb}`);
  };

  row('Status', a.success ? '✓ passed' : '✗ failed', b.success ? '✓ passed' : '✗ failed');
  row('Duration', `${a.duration}ms`, `${b.duration}ms`);
  row('Steps', `${a.passedSteps}/${a.totalSteps}`, `${b.passedSteps}/${b.totalSteps}`);
  row('URL', a.url || '-', b.url || '-');
  row('Title', a.title || '-', b.title || '-');

  console.log('');
  console.log(chalk.bold('  Step-by-Step Diff:'));

  const maxSteps = Math.max(a.steps?.length || 0, b.steps?.length || 0);
  for (let i = 0; i < maxSteps; i++) {
    const sa = a.steps?.[i];
    const sb = b.steps?.[i];
    const samePass = sa?.success === sb?.success;
    const indicator = samePass ? chalk.green('✓') : chalk.red('✗');
    const left = sa ? `${sa.success ? '✓' : '✗'} ${sa.message.substring(0, 40)}` : '-';
    const right = sb ? `${sb.success ? '✓' : '✗'} ${sb.message.substring(0, 40)}` : '-';
    console.log(`  ${indicator} Step ${String(i + 1).padEnd(3)} ${left.padEnd(45)} ${right}`);
  }
  console.log('');

  if (a.success !== b.success) {
    const which = b.success ? 'Run A regressed, Run B fixed' : 'Run A passed, Run B regressed';
    logger.warn(which);
  }
}
