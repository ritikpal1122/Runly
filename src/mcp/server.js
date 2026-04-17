// ═══════════════════════════════════════════════════════════════════════════
// RUNLY MCP SERVER
// ═══════════════════════════════════════════════════════════════════════════
//
// Exposes Runly as a Model Context Protocol server over stdio so Claude Code,
// Cursor, Windsurf, and any other MCP-capable IDE/agent can drive browser
// tests during development.
//
// Transport: stdio. stdout is owned by the MCP protocol — every other write
// MUST go to stderr (including logger output from Runly internals).
//
// Register Runly in Claude Code's MCP config (~/.claude.json) with:
//
//   "runly": { "command": "runly", "args": ["mcp"] }
//
// ═══════════════════════════════════════════════════════════════════════════

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  handleTest,
  handleRunFile,
  handleListTests,
  handleInspect,
  handleOpenUrl,
  handleLastRun,
} from './tools.js';

// ── Silence stdout for everything except MCP protocol frames ───────────────
// The MCP transport owns process.stdout. Any stray write breaks the JSON-RPC
// stream. Redirect console.* to stderr before any other code can write.

function redirectConsoleToStderr() {
  const toStderr = (...args) => {
    try {
      process.stderr.write(
        args
          .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
          .join(' ') + '\n'
      );
    } catch {}
  };
  console.log = toStderr;
  console.info = toStderr;
  console.warn = toStderr;
  console.debug = toStderr;
  // leave console.error alone — already goes to stderr
}

// ── Wrap a handler so thrown errors become structured MCP tool errors ──────

function wrap(handler) {
  return async (args) => {
    try {
      const result = await handler(args || {});
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { error: err.message || String(err), stack: err.stack?.split('\n').slice(0, 3) },
              null,
              2
            ),
          },
        ],
      };
    }
  };
}

// ── Main entry point ──────────────────────────────────────────────────────

export async function startMcpServer() {
  redirectConsoleToStderr();

  const server = new McpServer(
    { name: 'runly', version: '0.3.0' },
    { capabilities: { tools: {} } }
  );

  // 1. runly_test — run an English instruction
  server.registerTool(
    'runly_test',
    {
      title: 'Run a plain-English browser test',
      description:
        'Execute a single natural-language instruction (e.g. "open example.com and verify Example Domain is visible"). Returns pass/fail, per-step results, URL, title, and screenshot path.',
      inputSchema: {
        instruction: z
          .string()
          .describe('The English test instruction (can chain with "and")'),
        browser: z
          .enum(['chromium', 'firefox', 'webkit'])
          .optional()
          .describe('Browser engine (default: chromium)'),
        headed: z
          .boolean()
          .optional()
          .describe('Run with visible browser UI (default: false, headless)'),
        vars: z
          .record(z.string(), z.string())
          .optional()
          .describe('Variables for {{substitution}} in the instruction'),
        noAi: z
          .boolean()
          .optional()
          .describe('Disable AI parsing/self-healing (regex parser only)'),
      },
    },
    wrap(handleTest)
  );

  // 2. runly_run_file — run a .runly file or directory
  server.registerTool(
    'runly_run_file',
    {
      title: 'Run .runly test files',
      description:
        'Execute one or more .runly test files from a file path or directory. Supports tag filtering and regex name filtering.',
      inputSchema: {
        path: z
          .string()
          .describe('Path to a .runly file or directory containing .runly files'),
        browser: z.enum(['chromium', 'firefox', 'webkit']).optional(),
        headed: z.boolean().optional(),
        vars: z.record(z.string(), z.string()).optional(),
        tag: z.string().optional().describe('Only run tests with this tag'),
        grep: z
          .string()
          .optional()
          .describe('Regex to filter by name/content/tag'),
        noAi: z.boolean().optional(),
      },
    },
    wrap(handleRunFile)
  );

  // 3. runly_list_tests — discover tests without running
  server.registerTool(
    'runly_list_tests',
    {
      title: 'List .runly tests in a path',
      description:
        'Discover every .runly test file under the given path and return their names, tags, descriptions, and instructions — without running them.',
      inputSchema: {
        path: z
          .string()
          .optional()
          .describe('Directory to search (default: current directory)'),
      },
    },
    wrap(handleListTests)
  );

  // 4. runly_inspect — find elements on a page
  server.registerTool(
    'runly_inspect',
    {
      title: 'Inspect elements on a URL',
      description:
        'Open a URL and find DOM elements matching an English description. Returns up to N element summaries (tag, text, id, testid, aria-label). Useful for building selectors interactively.',
      inputSchema: {
        url: z.string().describe('URL to inspect (protocol optional)'),
        description: z
          .string()
          .describe('English element description, e.g. "login button"'),
        headed: z.boolean().optional(),
        limit: z.number().int().positive().optional().describe('Max elements (default 5)'),
      },
    },
    wrap(handleInspect)
  );

  // 5. runly_open_url — quick URL health check
  server.registerTool(
    'runly_open_url',
    {
      title: 'Open a URL and return basic info',
      description:
        'Navigate to a URL in a headless browser and return HTTP status, final URL, page title, and load duration. Useful for smoke-testing deployments.',
      inputSchema: {
        url: z.string(),
        browser: z.enum(['chromium', 'firefox', 'webkit']).optional(),
      },
    },
    wrap(handleOpenUrl)
  );

  // 6. runly_last_run — fetch last test run summary
  server.registerTool(
    'runly_last_run',
    {
      title: 'Get the last Runly test run',
      description:
        'Return metadata about the most recent Runly test (instruction, options, timestamp). Useful for replaying or inspecting what the agent did last.',
      inputSchema: {},
    },
    wrap(handleLastRun)
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log boot info to stderr so the calling agent's log stream shows it
  process.stderr.write(
    '[runly mcp] server started — 6 tools available (runly_test, runly_run_file, runly_list_tests, runly_inspect, runly_open_url, runly_last_run)\n'
  );
}
