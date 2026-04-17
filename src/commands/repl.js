// ═══════════════════════════════════════════════════════════════════════════
// RUNLY INTERACTIVE REPL
// ═══════════════════════════════════════════════════════════════════════════
//
// When user runs `runly` with no arguments, launch an interactive shell:
//
//   runly> test "open google.com"
//   runly> inspect example.com "search button"
//   runly> doctor
//   runly> help
//   runly> exit
//
// The REPL uses Node's built-in readline for:
//   • Command history (up/down arrows)
//   • Tab completion
//   • Ctrl+C to cancel current command
//   • Ctrl+D to exit
//
// The browser pool stays alive between commands, so subsequent runs are fast.
// ═══════════════════════════════════════════════════════════════════════════

import readline from 'readline';
import chalk from 'chalk';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import logger from '../utils/logger.js';
import { testCommand } from './test.js';
import { doctorCommand } from './doctor.js';
import { replayCommand } from './replay.js';
import { authCommand } from './auth.js';
import { inspectCommand } from './inspect.js';
import { diffCommand } from './diff.js';
import { reportCommand } from './report.js';
import { sessionsCommand } from './sessions.js';
import { runCommand } from './run.js';

const HISTORY_FILE = join(homedir(), '.runly', 'history');
const MAX_HISTORY = 500;

// ── Available commands in the REPL ─────────────────────────────────────────

const COMMANDS = {
  test: {
    description: 'Run a test from natural language',
    usage: 'test <instruction> [--verbose] [--headed] [--no-ai] [--save]',
    handler: async (args, flags) => {
      if (args.length === 0) return logger.error('Usage: test <instruction>');
      const instruction = args.join(' ');
      await testCommand(instruction, { ...flags, _fromRepl: true });
    },
  },
  run: {
    description: 'Run .runly test files from a path',
    usage: 'run <path> [--tag critical] [--parallel N]',
    handler: async (args, flags) => {
      if (args.length === 0) return logger.error('Usage: run <path>');
      await runCommand(args[0], { ...flags, _fromRepl: true });
    },
  },
  doctor: {
    description: 'Check system health',
    usage: 'doctor',
    handler: async () => { await doctorCommand({ _fromRepl: true }); },
  },
  inspect: {
    description: 'Inspect a page and find matching elements',
    usage: 'inspect <url> [description]',
    handler: async (args, flags) => {
      if (args.length === 0) return logger.error('Usage: inspect <url> [description]');
      const url = args[0];
      const description = args.slice(1).join(' ');
      await inspectCommand(url, description, { ...flags, _fromRepl: true });
    },
  },
  replay: {
    description: 'Replay the last test run',
    usage: 'replay [last]',
    handler: async (args) => { await replayCommand(args[0] || 'last'); },
  },
  report: {
    description: 'Generate HTML dashboard from past runs',
    usage: 'report [--limit N]',
    handler: async (args, flags) => { await reportCommand({ ...flags, _fromRepl: true }); },
  },
  diff: {
    description: 'Compare two test reports',
    usage: 'diff <reportA.json> <reportB.json>',
    handler: async (args) => {
      if (args.length < 2) return logger.error('Usage: diff <reportA> <reportB>');
      await diffCommand(args[0], args[1]);
    },
  },
  sessions: {
    description: 'List or clear saved auth sessions',
    usage: 'sessions [list|clear] [domain]',
    handler: async (args) => { await sessionsCommand(args[0] || 'list', args[1]); },
  },
  auth: {
    description: 'Set or check Anthropic API key',
    usage: 'auth [sk-ant-...]',
    handler: async (args) => { await authCommand(args[0]); },
  },
  help: {
    description: 'Show available commands',
    usage: 'help [command]',
    handler: (args) => {
      if (args[0] && COMMANDS[args[0]]) {
        const cmd = COMMANDS[args[0]];
        console.log('');
        console.log('  ' + chalk.bold.cyan(args[0]));
        console.log('  ' + chalk.dim(cmd.description));
        console.log('  ' + chalk.dim('Usage: ') + chalk.white(cmd.usage));
        console.log('');
        return;
      }
      printHelp();
    },
  },
  clear: {
    description: 'Clear the terminal',
    usage: 'clear',
    handler: () => { console.clear(); logger.banner(); },
  },
  exit: {
    description: 'Exit the REPL',
    usage: 'exit',
    handler: () => process.exit(0),
  },
  quit: {
    description: 'Exit the REPL',
    usage: 'quit',
    handler: () => process.exit(0),
  },
};

// Aliases
COMMANDS['?'] = COMMANDS.help;
COMMANDS['q'] = COMMANDS.exit;
COMMANDS['ls'] = COMMANDS.sessions;

// ── Print help table ──────────────────────────────────────────────────────

function printHelp() {
  console.log('');
  console.log('  ' + chalk.bold.white('Available Commands'));
  console.log('  ' + chalk.dim('──────────────────'));
  console.log('');

  const maxCmdLen = Math.max(...Object.keys(COMMANDS).filter(k => k.length > 1).map(k => k.length));

  for (const [name, cmd] of Object.entries(COMMANDS)) {
    if (name.length <= 1) continue; // skip single-char aliases
    if (name === 'quit') continue;   // skip duplicate
    console.log(
      '  ' + chalk.cyan(name.padEnd(maxCmdLen)) + chalk.dim('  ') + cmd.description
    );
  }

  console.log('');
  console.log('  ' + chalk.dim('Tips:'));
  console.log('  ' + chalk.dim('  • Use ↑/↓ for command history'));
  console.log('  ' + chalk.dim('  • Press Tab for completion'));
  console.log('  ' + chalk.dim('  • Press Ctrl+C to cancel a running command'));
  console.log('  ' + chalk.dim('  • Press Ctrl+D or type "exit" to quit'));
  console.log('  ' + chalk.dim('  • Type "help <cmd>" for details on a command'));
  console.log('');
}

// ── Parse input line like a shell ─────────────────────────────────────────
// Splits on whitespace but preserves quoted strings

function parseInputLine(line) {
  const tokens = [];
  let current = '';
  let inQuote = null;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if ((ch === '"' || ch === "'") && !inQuote) {
      inQuote = ch;
    } else if (ch === inQuote) {
      inQuote = null;
    } else if (ch === ' ' && !inQuote) {
      if (current) { tokens.push(current); current = ''; }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);

  return tokens;
}

// Separate flags (--xxx) from positional args
function splitArgsAndFlags(tokens) {
  const args = [];
  const flags = {};

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.startsWith('--')) {
      const key = t.slice(2);
      // Boolean flag or value flag?
      if (tokens[i + 1] && !tokens[i + 1].startsWith('--')) {
        // Check if it looks like a value
        const next = tokens[i + 1];
        if (key === 'interval' || key === 'retry' || key === 'parallel' ||
            key === 'limit' || key === 'tag' || key === 'grep' || key === 'name' ||
            key === 'vars' || key === 'vars-file' || key === 'browser') {
          flags[camelCase(key)] = next;
          i++;
          continue;
        }
      }
      // Boolean flag — negation support for --no-xxx
      if (key.startsWith('no-')) {
        flags[camelCase(key.slice(3))] = false;
      } else {
        flags[camelCase(key)] = true;
      }
    } else {
      args.push(t);
    }
  }

  return { args, flags };
}

function camelCase(s) {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

// ── History management ────────────────────────────────────────────────────

function loadHistory() {
  try {
    if (!existsSync(HISTORY_FILE)) return [];
    return readFileSync(HISTORY_FILE, 'utf8').split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function saveHistory(history) {
  try {
    mkdirSync(join(homedir(), '.runly'), { recursive: true });
    writeFileSync(HISTORY_FILE, history.slice(-MAX_HISTORY).join('\n'));
  } catch {}
}

// ── Tab completion ────────────────────────────────────────────────────────

function completer(line) {
  const commands = Object.keys(COMMANDS).filter(k => k.length > 1);
  const hits = commands.filter(c => c.startsWith(line));
  return [hits.length ? hits : commands, line];
}

// ── Main REPL loop ────────────────────────────────────────────────────────

export async function replCommand() {
  logger.banner();

  // Suppress banner for all subsequent command calls within this REPL session
  logger.suppressBanner();

  console.log('  ' + chalk.dim('Interactive mode. Type "help" for commands, "exit" to quit.'));
  console.log('');

  const history = loadHistory().reverse();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.bold.cyan('runly') + chalk.dim(' ❯ '),
    completer,
    history,
    historySize: MAX_HISTORY,
    removeHistoryDuplicates: true,
  });

  rl.prompt();

  rl.on('line', async (line) => {
    line = line.trim();
    if (!line) {
      rl.prompt();
      return;
    }

    const tokens = parseInputLine(line);
    if (tokens.length === 0) {
      rl.prompt();
      return;
    }

    const [cmdName, ...rest] = tokens;
    const cmd = COMMANDS[cmdName];

    if (!cmd) {
      logger.error(`Unknown command: ${cmdName}`);
      logger.dim(`  Type "help" to see available commands`);
      rl.prompt();
      return;
    }

    // Save to history before running
    saveHistory([...loadHistory(), line]);

    // Pause readline while command runs (so spinners work)
    rl.pause();

    try {
      const { args, flags } = splitArgsAndFlags(rest);
      await cmd.handler(args, flags);
    } catch (err) {
      logger.error(`Command failed: ${err.message}`);
      if (process.env.DEBUG) console.error(err.stack);
    }

    // Resume and re-prompt
    rl.resume();
    console.log('');
    rl.prompt();
  });

  // Ctrl+D
  rl.on('close', () => {
    console.log('');
    logger.dim('  Goodbye!');
    console.log('');
    process.exit(0);
  });

  // Ctrl+C — cancel current line, don't exit
  rl.on('SIGINT', () => {
    console.log('');
    logger.dim('  (Use "exit" or Ctrl+D to quit)');
    rl.prompt();
  });
}
