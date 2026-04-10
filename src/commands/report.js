// runly report — generate HTML dashboard from JSON reports in output/reports/

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import logger from '../utils/logger.js';

export async function reportCommand(options) {
  logger.banner();

  const reportsDir = join(process.cwd(), 'output', 'reports');
  if (!existsSync(reportsDir)) {
    logger.error(`No reports found at ${reportsDir}`);
    return;
  }

  const files = readdirSync(reportsDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, options.limit || 50);

  if (files.length === 0) {
    logger.warn('No reports to display');
    return;
  }

  const reports = files.map(f => {
    try {
      return { ...JSON.parse(readFileSync(join(reportsDir, f), 'utf8')), file: f };
    } catch {
      return null;
    }
  }).filter(Boolean);

  const passed = reports.filter(r => r.success).length;
  const failed = reports.length - passed;
  const passRate = Math.round((passed / reports.length) * 100);
  const totalDuration = reports.reduce((sum, r) => sum + (r.duration || 0), 0);
  const avgDuration = Math.round(totalDuration / reports.length);

  const rowsHtml = reports.map(r => {
    const status = r.success ? '✅' : '❌';
    const bg = r.success ? '#d1f7c4' : '#ffd2d2';
    const stepsHtml = (r.steps || []).map((s, i) => {
      const step = r.results?.[i];
      const icon = step?.success ? '✓' : '✗';
      const color = step?.success ? '#4caf50' : '#f44336';
      return `<div style="font-family:monospace;font-size:12px;color:${color}"><b>${icon}</b> ${escapeHtml(s)}</div>`;
    }).join('');

    const screenshot = r.screenshot ? `<a href="file://${r.screenshot}" target="_blank">Screenshot</a>` : '-';

    return `
      <tr style="background:${bg}">
        <td>${status}</td>
        <td>${escapeHtml((r.instruction || '').substring(0, 80))}</td>
        <td>${r.duration}ms</td>
        <td>${r.passedSteps}/${r.totalSteps}</td>
        <td>${escapeHtml(r.url || '-').substring(0, 50)}</td>
        <td>${screenshot}</td>
        <td style="max-width:400px">${stepsHtml}</td>
      </tr>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Runly Report Dashboard</title>
  <style>
    body { font-family: -apple-system, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    h1 { margin: 0 0 8px; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }
    .stat { background: white; padding: 16px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .stat .value { font-size: 32px; font-weight: bold; }
    .stat .label { color: #666; font-size: 12px; text-transform: uppercase; }
    table { width: 100%; background: white; border-collapse: collapse; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden; }
    th { background: #333; color: white; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; }
    td { padding: 12px; border-bottom: 1px solid #eee; vertical-align: top; font-size: 14px; }
    .pass { color: #4caf50; }
    .fail { color: #f44336; }
  </style>
</head>
<body>
  <h1>🧪 Runly Dashboard</h1>
  <p style="color:#666;margin:0">Showing ${reports.length} most recent test runs</p>

  <div class="stats">
    <div class="stat">
      <div class="value">${reports.length}</div>
      <div class="label">Total Runs</div>
    </div>
    <div class="stat">
      <div class="value pass">${passed}</div>
      <div class="label">Passed</div>
    </div>
    <div class="stat">
      <div class="value fail">${failed}</div>
      <div class="label">Failed</div>
    </div>
    <div class="stat">
      <div class="value">${passRate}%</div>
      <div class="label">Pass Rate</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Status</th>
        <th>Instruction</th>
        <th>Duration</th>
        <th>Steps</th>
        <th>URL</th>
        <th>Screenshot</th>
        <th>Step Details</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  <p style="color:#666;font-size:12px;margin-top:20px">Generated ${new Date().toISOString()} — Avg duration: ${avgDuration}ms</p>
</body>
</html>`;

  const outputDir = join(process.cwd(), 'output');
  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, 'dashboard.html');
  writeFileSync(outputPath, html);

  logger.success(`Dashboard generated: ${outputPath}`);
  logger.dim(`  ${reports.length} runs | ${passed} passed | ${failed} failed | ${passRate}% pass rate`);
  logger.dim(`  Open: file://${outputPath}`);
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
