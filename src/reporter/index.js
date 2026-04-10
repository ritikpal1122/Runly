import { writeFileSync } from 'fs';
import chalk from 'chalk';
import logger from '../utils/logger.js';
import { getReportPath } from '../utils/paths.js';

export function reportResult(result) {
  console.log('');

  // ── Step-by-step results ──────────────────────────────────
  if (result.results && result.results.length > 0) {
    logger.section('Steps');
    result.results.forEach((r, i) => {
      const num = chalk.dim(`${String(i + 1).padStart(2)}.`);
      if (r.success) {
        console.log(`  ${num}  ${chalk.green('✓')}  ${r.message}`);
      } else {
        console.log(`  ${num}  ${chalk.red('✗')}  ${r.message}`);
      }
    });
  }

  // ── Summary box ───────────────────────────────────────────
  console.log('');
  const statusLine = result.success
    ? chalk.bgGreen.black.bold(' PASSED ') +
      chalk.dim('  ') +
      chalk.white(`${result.totalSteps || 0} steps in ${result.duration}ms`)
    : chalk.bgRed.white.bold(' FAILED ') +
      chalk.dim('  ') +
      chalk.red(`at step ${result.failedStep || '?'}/${result.totalSteps || '?'}`);

  console.log('  ' + statusLine);

  if (!result.success && result.error) {
    console.log('  ' + chalk.red('  → ') + chalk.dim(result.error));
  }

  // ── Details ───────────────────────────────────────────────
  console.log('');
  if (result.url) logger.label('URL', result.url);
  if (result.title) logger.label('Title', result.title);
  if (result.duration) logger.label('Duration', `${result.duration}ms`);
  if (result.screenshot) logger.label('Screenshot', chalk.dim(result.screenshot));
  if (result.pooled) logger.label('Browser', chalk.green('pooled (fast)'));

  console.log('');
}

// ── Save full report as JSON ────────────────────────────────────

export function saveReport(result, instruction) {
  try {
    const reportPath = getReportPath();
    const report = {
      instruction,
      timestamp: new Date().toISOString(),
      success: result.success,
      duration: result.duration,
      totalSteps: result.totalSteps || 0,
      passedSteps: result.passedSteps || 0,
      failedStep: result.failedStep || null,
      error: result.error || null,
      url: result.url || null,
      title: result.title || null,
      screenshot: result.screenshot || null,
      steps: (result.results || []).map((r, i) => ({
        number: i + 1,
        action: result.steps?.[i] || r.step,
        success: r.success,
        message: r.message,
      })),
    };

    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    logger.label('Report', chalk.dim(reportPath));
    console.log('');
  } catch {
    // Report saving is best-effort
  }
}
