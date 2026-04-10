import { writeFileSync } from 'fs';
import logger from '../utils/logger.js';
import { getReportPath } from '../utils/paths.js';

export function reportResult(result) {
  console.log('');

  // ── Step-by-step results ──────────────────────────────────
  if (result.results && result.results.length > 0) {
    console.log('  Steps:');
    result.results.forEach((r, i) => {
      if (r.success) {
        logger.success(`  Step ${i + 1}: ${r.message}`);
      } else {
        logger.error(`  Step ${i + 1}: ${r.message}`);
      }
    });
    console.log('');
  }

  // ── Summary box ───────────────────────────────────────────
  const line = '─'.repeat(50);
  console.log(`  ${line}`);

  if (result.success) {
    logger.success(`  PASSED — ${result.totalSteps || 0} steps in ${result.duration}ms`);
  } else {
    logger.error(`  FAILED at step ${result.failedStep || '?'}/${result.totalSteps || '?'}`);
    logger.error(`  Reason: ${result.error}`);
  }

  console.log(`  ${line}`);

  // ── Details ───────────────────────────────────────────────
  const details = [];
  if (result.url) details.push(`  URL:         ${result.url}`);
  if (result.title) details.push(`  Title:       ${result.title}`);
  if (result.totalSteps) details.push(`  Steps:       ${result.passedSteps || 0}/${result.totalSteps} passed`);
  if (result.duration) details.push(`  Duration:    ${result.duration}ms`);
  if (result.screenshot) details.push(`  Screenshot:  ${result.screenshot}`);

  if (details.length > 0) {
    details.forEach(d => logger.dim(d));
  }

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
    logger.dim(`  Report:      ${reportPath}`);
  } catch {
    // Report saving is best-effort
  }
}
