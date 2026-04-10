#!/usr/bin/env node

import { Command } from 'commander';
import { testCommand } from '../src/commands/test.js';
import { doctorCommand } from '../src/commands/doctor.js';
import { loginCommand } from '../src/commands/login.js';
import { replayCommand } from '../src/commands/replay.js';
import { authCommand } from '../src/commands/auth.js';

const program = new Command();

program
  .name('runly')
  .description('Natural language to Playwright tests — instantly')
  .version('0.1.0');

program
  .command('test')
  .description('Run a test from natural language or URL')
  .argument('<instruction>', 'English instruction or URL to test')
  .option('--headed', 'Run browser in headed mode', false)
  .option('--save', 'Save generated .spec.js file', false)
  .option('--browser <type>', 'Browser to use (chromium|firefox|webkit)', 'chromium')
  .option('--verbose', 'Show detailed output', false)
  .option('--no-ai', 'Disable AI parsing/healing (use regex only)')
  .action(testCommand);

program
  .command('auth')
  .description('Set Anthropic API key for AI mode')
  .argument('[key]', 'Anthropic API key (sk-ant-...)')
  .action(authCommand);

program
  .command('doctor')
  .description('Check system health — Node, Playwright, browsers')
  .action(doctorCommand);

program
  .command('login')
  .description('Save auth session for a site')
  .argument('<url>', 'URL to login to')
  .option('--save', 'Save session for reuse', true)
  .action(loginCommand);

program
  .command('replay')
  .description('Replay last test run')
  .argument('[which]', 'What to replay', 'last')
  .action(replayCommand);

program.parse();
