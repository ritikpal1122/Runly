import { join } from 'path';
import { mkdirSync } from 'fs';

// All output goes into output/ folder at project root
const OUTPUT_DIR = join(process.cwd(), 'output');
const SCREENSHOTS_DIR = join(OUTPUT_DIR, 'screenshots');
const SPECS_DIR = join(OUTPUT_DIR, 'specs');
const REPORTS_DIR = join(OUTPUT_DIR, 'reports');

// Ensure directories exist
function ensureOutputDirs() {
  for (const dir of [OUTPUT_DIR, SCREENSHOTS_DIR, SPECS_DIR, REPORTS_DIR]) {
    mkdirSync(dir, { recursive: true });
  }
}

export function getScreenshotPath(prefix = 'result') {
  ensureOutputDirs();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return join(SCREENSHOTS_DIR, `${prefix}-${timestamp}.png`);
}

export function getSpecPath(name) {
  ensureOutputDirs();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeName = (name || 'test').replace(/[^a-z0-9]/gi, '-').substring(0, 50);
  return join(SPECS_DIR, `${safeName}-${timestamp}.spec.js`);
}

export function getReportPath() {
  ensureOutputDirs();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return join(REPORTS_DIR, `report-${timestamp}.json`);
}

export { OUTPUT_DIR, SCREENSHOTS_DIR, SPECS_DIR, REPORTS_DIR };
