import chalk from 'chalk';
import ora from 'ora';

// ═══════════════════════════════════════════════════════════════
// RUNLY CLI — BRANDING & LOGO
// ═══════════════════════════════════════════════════════════════

// ASCII logo (block style) + gradient cyan→blue coloring
const LOGO_LINES = [
  '██████╗ ██╗   ██╗███╗   ██╗██╗  ██╗   ██╗',
  '██╔══██╗██║   ██║████╗  ██║██║  ╚██╗ ██╔╝',
  '██████╔╝██║   ██║██╔██╗ ██║██║   ╚████╔╝ ',
  '██╔══██╗██║   ██║██║╚██╗██║██║    ╚██╔╝  ',
  '██║  ██║╚██████╔╝██║ ╚████║███████╗██║   ',
  '╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝╚═╝   ',
];

const TAGLINE = 'Natural Language → Browser Automation';
const VERSION = 'v0.3.0';

// Gradient effect: each line a slightly different cyan/blue shade
function renderLogo() {
  const colors = [
    chalk.hex('#00d9ff'),
    chalk.hex('#00c6ff'),
    chalk.hex('#00b3ff'),
    chalk.hex('#009fff'),
    chalk.hex('#008cff'),
    chalk.hex('#0078ff'),
  ];
  return LOGO_LINES.map((line, i) => '  ' + colors[i](line)).join('\n');
}

// ── Full branded banner ─────────────────────────────────────────
// Can be suppressed by setting RUNLY_NO_BANNER env var (used by REPL)

let bannerSuppressed = false;

function suppressBanner() { bannerSuppressed = true; }
function allowBanner() { bannerSuppressed = false; }

function banner() {
  if (bannerSuppressed || process.env.RUNLY_NO_BANNER === '1') return;
  console.log('');
  console.log(renderLogo());
  console.log('');
  console.log(
    '  ' +
    chalk.bold.white(TAGLINE) +
    chalk.dim('  ·  ') +
    chalk.dim(VERSION)
  );
  console.log(
    '  ' +
    chalk.dim('─────────────────────────────────────────────')
  );
  console.log('');
}

// ── Compact banner (for sub-commands to keep output short) ─────

function compact() {
  console.log('');
  console.log(
    '  ' +
    chalk.bold.hex('#00d9ff')('⚡ RUNLY') +
    chalk.dim(' · ') +
    chalk.dim('Natural Language → Browser Automation')
  );
  console.log('');
}

// ── Section divider ─────────────────────────────────────────────

function divider() {
  console.log('  ' + chalk.dim('─'.repeat(58)));
}

// ── Box around content ──────────────────────────────────────────

function box(title, lines) {
  const maxLen = Math.max(title.length, ...lines.map(l => stripAnsi(l).length));
  const width = Math.min(maxLen + 4, 62);

  console.log('  ' + chalk.dim('┌' + '─'.repeat(width - 2) + '┐'));
  console.log('  ' + chalk.dim('│ ') + chalk.bold(title.padEnd(width - 4)) + chalk.dim(' │'));
  console.log('  ' + chalk.dim('├' + '─'.repeat(width - 2) + '┤'));
  for (const line of lines) {
    const visible = stripAnsi(line);
    const padding = ' '.repeat(Math.max(0, width - 4 - visible.length));
    console.log('  ' + chalk.dim('│ ') + line + padding + chalk.dim(' │'));
  }
  console.log('  ' + chalk.dim('└' + '─'.repeat(width - 2) + '┘'));
}

function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*[mK]/g, '');
}

// ── Core log methods ───────────────────────────────────────────

const logger = {
  banner,
  suppressBanner,
  allowBanner,
  compact,
  divider,
  box,

  info(msg) {
    console.log('  ' + chalk.cyan('ℹ') + '  ' + msg);
  },

  success(msg) {
    console.log('  ' + chalk.green('✓') + '  ' + msg);
  },

  error(msg) {
    console.log('  ' + chalk.red('✗') + '  ' + msg);
  },

  warn(msg) {
    console.log('  ' + chalk.yellow('⚠') + '  ' + msg);
  },

  step(num, msg) {
    console.log('  ' + chalk.dim(`${String(num).padStart(2)}.`) + '  ' + msg);
  },

  dim(msg) {
    console.log('  ' + chalk.dim(msg));
  },

  label(key, value) {
    console.log('  ' + chalk.dim(key.padEnd(14)) + chalk.white(value));
  },

  section(title) {
    console.log('');
    console.log('  ' + chalk.bold.white(title));
    console.log('  ' + chalk.dim('─'.repeat(title.length + 4)));
  },

  spinner(msg) {
    return ora({
      text: msg,
      color: 'cyan',
      prefixText: '  ',
      spinner: 'dots',
    }).start();
  },

  // Raw console passthrough
  raw(msg) {
    console.log(msg);
  },

  blank() {
    console.log('');
  },
};

export default logger;
