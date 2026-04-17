# Changelog

All notable changes to Runly will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] — 2026-04-18

### Added

- **MCP server** (`runly mcp`) — Runly now ships as a Model Context Protocol
  stdio server. Claude Code, Cursor, Windsurf, and other MCP-capable agents
  can drive browser tests through six exposed tools: `runly_test`,
  `runly_run_file`, `runly_list_tests`, `runly_inspect`, `runly_open_url`,
  `runly_last_run`. Config is one line in `~/.claude.json`.
- **Playwright importer** (`runly import`) — converts any `.spec.ts` / `.spec.js`
  suite to the plain-English `.runly` format. Handles `page.goto`, `click`,
  `fill`, `locator`, `getByRole/Label/Text/Placeholder/TestId`, `expect`
  assertions, timeouts, screenshots. Unmatched lines are flagged as
  `# TODO (unconverted)` so nothing drops silently.
- **`@use` modules** — reusable test flows with variable overrides. Syntax:
  `@use login.runly with user=admin pass=secret`. Cycle detection throws
  with a readable chain.
- **AI assertions (`verify ai: …`)** — routes free-form English assertions
  to Claude with a DOM snapshot; returns strict pass/fail with reasoning
  and supporting evidence.
- **Faker integration** — any `{{faker.*}}` expression resolves via
  `@faker-js/faker` at interpolation time. `{{faker.person.firstName}}`,
  `{{faker.internet.email}}`, `{{faker.location.zipCode}}`, etc.
- **Interactive REPL** — `runly` with no arguments drops into a shell with
  command history, tab-completion, and a persistent browser pool for
  sub-second reruns.
- **Auto-finalization** — `runly test` / `runly run` now auto-emit the
  Playwright spec and refresh the HTML dashboard on every run
  (`--no-spec` / `--no-dashboard` to opt out).
- **Swag Labs example suite** — reference port of a well-known cloud-editor
  YAML suite into plain text (3.5× shorter: 70 LOC vs 245 LOC).
- **52 unit tests** across parser, fileParser, importer, and interpolate.

### Changed

- **Per-instruction parsing in `runly run`** — each line is parsed
  individually so directives like `verify ai: …` stay atomic instead of
  being fragmented when lines are joined.
- **Public-facing docs and launch copy** neutralized — no competitor
  name-drops; positioning stays sharp via feature comparison.
- **Generated dashboard** (`output/dashboard.html`) is now gitignored; it
  was previously committed with absolute local paths.

### Fixed

- `z.record(...)` call sites corrected to pass two arguments for zod v4
  compatibility (was breaking MCP `tools/list` with a cryptic `_zod` error).

## [0.2.0] — 2026-04-11

### Added

- **`.runly` test file format** — tests-as-code. Write tests in plain English
  as `.runly` files, commit them to your repo, git-diff them like any other code.
- **`runly run <path>`** — directory/file test runner with tag filtering,
  parallel execution, and NDJSON output.
- **GitHub Action** (`runly/action@v1`) — 30-second CI integration with
  automatic artifact upload on failure.
- **Variable substitution** — `{{var}}` syntax in instructions with `--vars`
  and `--vars-file` flags.
- **Persistent browser pool** — 10x speedup via WebSocket reconnection. First
  run launches a browser server, subsequent runs reconnect in ~50ms.
- **Session reuse** — auto-save login state per domain with `--save-session`,
  skip login on repeat runs automatically.
- **Retry on flake** — `--retry N` with configurable delay.
- **Visual regression** — `--baseline` to save a baseline, `--diff` to compare.
- **Interactive debugger** — `--debug` flag for step-through execution.
- **HTML report dashboard** — `runly report` generates a pretty HTML view.
- **DOM inspector** — `runly inspect <url> "description"` finds matching elements.
- **Diff command** — `runly diff A.json B.json` compares two test runs.
- **Watch mode** — `runly watch "..." --interval 60` re-runs on a schedule.
- **Record mode** — `runly record [url]` captures user actions into instructions.
- **Test suite runner** — `runly suite run <file>` for JSON-based test suites.
- **API server mode** — `runly serve --port 3737` exposes HTTP API for
  programmatic test execution.
- **Session management** — `runly sessions list|clear` commands.
- **AI learning cache** — successful self-heals are cached per domain/description.
- **Intent memory** — past successful runs are remembered for similarity lookup.
- **Comprehensive DOM snapshot** — 80+ element types, ARIA roles, state info,
  position context, iframe traversal, shadow DOM piercing.
- **Branded CLI** — ASCII logo, colored badges, aligned output.

### Changed

- **Parser upgraded** — handles ambiguous words (`enter`, `press`, `login`) as
  both action keywords and targets based on context.
- **Case preservation** — user-supplied values (passwords, emails) now preserved
  with original case; only action keywords are lowercased.
- **Selector engine** — 12 fallback strategies before AI mode engages.
- **Output structure** — all artifacts now go to `output/` folder (screenshots,
  specs, reports) instead of scattered in project root.

### AI

- **Prompt library rewritten** — 6 engineered prompts with XML tags, role
  definitions, few-shot examples, anti-examples, and confidence calibration.
- **Self-healer** — 4-strategy recovery (retry, alternative, skip, abort).
- **DOM analyzer** — AI-powered selector finding when regex fails.
- **Flow planner** — decomposes high-level goals into atomic sub-instructions.

## [0.1.0] — 2026-04-10

### Added

- Initial release
- Core CLI with `runly test`, `runly doctor`, `runly replay`
- Regex parser for simple English instructions
- Playwright-based runner with screenshot capture
- JSON report output
- Basic AI parsing with Claude
