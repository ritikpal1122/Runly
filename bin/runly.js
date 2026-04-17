#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { testCommand } from '../src/commands/test.js';
import { doctorCommand } from '../src/commands/doctor.js';
import { loginCommand } from '../src/commands/login.js';
import { replayCommand } from '../src/commands/replay.js';
import { authCommand } from '../src/commands/auth.js';
import { inspectCommand } from '../src/commands/inspect.js';
import { diffCommand } from '../src/commands/diff.js';
import { watchCommand } from '../src/commands/watch.js';
import { reportCommand } from '../src/commands/report.js';
import { recordCommand } from '../src/commands/record.js';
import { suiteCommand } from '../src/commands/suite.js';
import { serveCommand } from '../src/commands/serve.js';
import { sessionsCommand } from '../src/commands/sessions.js';
import { runCommand } from '../src/commands/run.js';
import { replCommand } from '../src/commands/repl.js';
import { mcpCommand } from '../src/commands/mcp.js';
import logger from '../src/utils/logger.js';

// No arguments → launch interactive REPL (don't run commander)
const args = process.argv.slice(2);
if (args.length === 0) {
  replCommand();
  // REPL is async and holds the process open — don't continue to commander
} else {
  if (args[0] === '--help' || args[0] === '-h' || args[0] === 'help') {
    logger.banner();
  }
  main();
}

function main() {

const program = new Command();

program
  .name('runly')
  .description('Natural language to Playwright tests — instantly')
  .version('0.2.0', '-v, --version', 'Show version')
  .helpOption('-h, --help', 'Show help')
  .addHelpText('after', `
${chalk.bold.white('  Quick Examples')}
${chalk.dim('  ──────────────')}
  ${chalk.cyan('runly test')} ${chalk.dim('"open google.com and search playwright"')}
  ${chalk.cyan('runly test')} ${chalk.dim('"open site.com/login and type admin in username"')} --verbose
  ${chalk.cyan('runly inspect')} ${chalk.dim('google.com "search button"')}
  ${chalk.cyan('runly watch')} ${chalk.dim('"open site.com and verify homepage"')} --interval 60
  ${chalk.cyan('runly report')}   ${chalk.dim('# HTML dashboard from past runs')}
  ${chalk.cyan('runly record')}   ${chalk.dim('# Record interactions into instructions')}
  ${chalk.cyan('runly doctor')}   ${chalk.dim('# Health check')}

${chalk.bold.white('  Learn More')}
${chalk.dim('  ──────────')}
  ${chalk.dim('Docs:')}    ${chalk.underline('https://github.com/runly/runly')}
  ${chalk.dim('AI mode:')} ${chalk.cyan('runly auth')} ${chalk.dim('sk-ant-...')}
`);

// ── Primary: runly run <path> (directory/file runner) ─────────
program
  .command('run')
  .description('Run .runly test files from a directory or single file')
  .argument('<path>', 'Path to .runly file or directory')
  .option('--tag <tag>', 'Filter tests by tag')
  .option('--grep <pattern>', 'Filter tests by name/content (regex)')
  .option('--name <pattern>', 'Filter tests by name (regex)')
  .option('--parallel <n>', 'Run N tests in parallel', '1')
  .option('--json', 'Output NDJSON for scripting', false)
  .option('--verbose', 'Show detailed output', false)
  .option('--headed', 'Run browser in headed mode', false)
  .option('--browser <type>', 'Browser (chromium|firefox|webkit)', 'chromium')
  .option('--no-ai', 'Disable AI parsing/healing')
  .option('--no-spec', 'Do not auto-generate Playwright spec files')
  .option('--no-dashboard', 'Do not auto-update HTML dashboard')
  .option('--retry <n>', 'Retry failed tests N times', parseInt)
  .option('--vars <json>', 'Inline variables JSON')
  .option('--vars-file <path>', 'Load variables from JSON file')
  .action(runCommand);

// ── Primary: runly test ────────────────────────────────────────
program
  .command('test')
  .description('Run a test from natural language or URL')
  .argument('<instruction>', 'English instruction or URL to test')
  .option('--headed', 'Run browser in headed mode', false)
  .option('--browser <type>', 'Browser to use (chromium|firefox|webkit)', 'chromium')
  .option('--verbose', 'Show detailed output', false)
  .option('--no-ai', 'Disable AI parsing/healing (use regex only)')
  .option('--no-spec', 'Do not auto-generate Playwright spec file')
  .option('--no-dashboard', 'Do not auto-update HTML dashboard')
  .option('--retry <n>', 'Retry failed tests N times', parseInt)
  .option('--retry-delay <s>', 'Seconds between retries', '2')
  .option('--debug', 'Interactive step-by-step debugger', false)
  .option('--baseline', 'Save current screenshot as visual baseline', false)
  .option('--diff', 'Compare screenshot to visual baseline', false)
  .option('--vars <json>', 'Inline variables JSON')
  .option('--vars-file <path>', 'Load variables from JSON file')
  .option('--save-session', 'Save auth session for domain on success', false)
  .option('--no-session', 'Do not load saved session')
  .option('--no-pool', 'Do not use persistent browser pool')
  .option('--fresh', 'Force fresh browser (bypass pool)', false)
  .action(testCommand);

// ── AI auth ────────────────────────────────────────────────────
program
  .command('auth')
  .description('Set Anthropic API key for AI mode')
  .argument('[key]', 'Anthropic API key (sk-ant-...)')
  .action(authCommand);

// ── Health check ───────────────────────────────────────────────
program
  .command('doctor')
  .description('Check system health — Node, Playwright, browsers')
  .action(doctorCommand);

// ── Session management ────────────────────────────────────────
program
  .command('sessions')
  .description('List or clear saved auth sessions')
  .argument('[action]', 'list | clear', 'list')
  .argument('[domain]', 'Specific domain (for clear)')
  .action(sessionsCommand);

program
  .command('login')
  .description('Save auth session for a site')
  .argument('<url>', 'URL to login to')
  .option('--save', 'Save session for reuse', true)
  .action(loginCommand);

// ── Replay ─────────────────────────────────────────────────────
program
  .command('replay')
  .description('Replay last test run')
  .argument('[which]', 'What to replay', 'last')
  .action(replayCommand);

// ── Inspect ────────────────────────────────────────────────────
program
  .command('inspect')
  .description('Inspect a page and find matching elements')
  .argument('<url>', 'URL to inspect')
  .argument('[description]', 'Element description to find')
  .option('--headed', 'Show browser', false)
  .option('--dom', 'Print full DOM snapshot', false)
  .action(inspectCommand);

// ── Diff ───────────────────────────────────────────────────────
program
  .command('diff')
  .description('Compare two test reports side by side')
  .argument('<reportA>', 'First report JSON')
  .argument('<reportB>', 'Second report JSON')
  .action(diffCommand);

// ── Watch ──────────────────────────────────────────────────────
program
  .command('watch')
  .description('Re-run a test at regular intervals')
  .argument('<instruction>', 'Instruction to run repeatedly')
  .option('--interval <seconds>', 'Interval between runs', '60')
  .option('--no-ai', 'Disable AI')
  .action(watchCommand);

// ── Report ─────────────────────────────────────────────────────
program
  .command('report')
  .description('Generate HTML dashboard from JSON reports')
  .option('--limit <n>', 'Max reports to include', parseInt)
  .action(reportCommand);

// ── Record ─────────────────────────────────────────────────────
program
  .command('record')
  .description('Record user actions into a runly instruction')
  .argument('[url]', 'Starting URL')
  .option('--save', 'Save recorded instruction to file', false)
  .action(recordCommand);

// ── Suite ──────────────────────────────────────────────────────
program
  .command('suite')
  .description('Run a test suite from a config file')
  .argument('<action>', 'run')
  .argument('<file>', 'Suite config (JSON)')
  .option('--parallel <n>', 'Run N tests in parallel', '1')
  .option('--tag <tag>', 'Only run tests with this tag')
  .option('--no-ai', 'Disable AI')
  .action(suiteCommand);

// ── Serve ──────────────────────────────────────────────────────
program
  .command('serve')
  .description('Start HTTP API server for programmatic test runs')
  .option('--port <port>', 'Port to listen on', '3737')
  .action(serveCommand);

// ── MCP ────────────────────────────────────────────────────────
program
  .command('mcp')
  .description('Start the MCP server (for Claude Code, Cursor, Windsurf, etc.)')
  .action(mcpCommand);

  program.parse();
}

