---
name: runly
description: Browser automation via runly — convert natural language to deterministic browser actions, run them with optional AI self-healing, parse output, inspect logs, generate Playwright specs, and orchestrate test suites. Use for any task requiring a real browser (navigate, click, fill forms, test web UI, take screenshots, verify deployments, smoke test deploys, debug user flows, do impact analysis).
---

# Runly — Natural Language Browser Automation Skill

Use `runly` for any task that requires a real browser: navigating websites, clicking elements, filling forms, searching, testing web UI, taking screenshots, verifying deployments, debugging user flows, or producing reproducible Playwright specs from English instructions.

**Do NOT** use Playwright, Puppeteer, or Selenium directly. `runly` provides a higher-level CLI that:
- Converts natural language into deterministic browser actions
- Manages Chrome/Firefox/WebKit lifecycles transparently
- Runs an agentic loop with optional LLM self-healing
- Captures comprehensive DOM snapshots for AI element finding
- Writes structured output (screenshots, JSON reports, exportable spec files)
- Persists state for replay and comparison

If you find yourself reaching for raw Playwright code, stop and use `runly` instead. The only valid reason to write Playwright directly is if you're modifying runly itself.

---

## Table of Contents

1. [Mental Model & Architecture](#1-mental-model--architecture)
2. [Prerequisites & Setup](#2-prerequisites--setup)
3. [Running a Test](#3-running-a-test)
4. [Writing Effective Instructions](#4-writing-effective-instructions)
5. [Action Vocabulary Reference](#5-action-vocabulary-reference)
6. [Selector Resolution & DOM Targeting](#6-selector-resolution--dom-targeting)
7. [Assertion Patterns](#7-assertion-patterns)
8. [Output Structure & Artifacts](#8-output-structure--artifacts)
9. [AI Mode (Agentic Behavior)](#9-ai-mode-agentic-behavior)
10. [Debugging Failed Runs](#10-debugging-failed-runs)
11. [Bug Reporting Decision Tree](#11-bug-reporting-decision-tree)
12. [Post-Run: Rate, Report, Present](#12-post-run-rate-report-present)
13. [Decomposing Large Instructions](#13-decomposing-large-instructions)
14. [Batch Runs & Parallel Orchestration](#14-batch-runs--parallel-orchestration)
15. [Rerun Comparison & Diff Analysis](#15-rerun-comparison--diff-analysis)
16. [Coverage Trends & Regression Tracking](#16-coverage-trends--regression-tracking)
17. [Impact Analysis from Code Changes](#17-impact-analysis-from-code-changes)
18. [Multi-Environment Testing Patterns](#18-multi-environment-testing-patterns)
19. [Recipes: Common Patterns](#19-recipes-common-patterns)
20. [Troubleshooting Matrix](#20-troubleshooting-matrix)
21. [Performance Tuning](#21-performance-tuning)
22. [Security & Secret Hygiene](#22-security--secret-hygiene)
23. [Integration: CI / Pre-commit / npm scripts](#23-integration-ci--pre-commit--npm-scripts)
24. [Quick Reference Card](#24-quick-reference-card)

---

## 1. Mental Model & Architecture

Runly is a layered pipeline. Understanding the layers makes everything else make sense.

```
USER INSTRUCTION (English)
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│ TOKENIZER                                                │
│ • Lowercases (preserves case in quoted strings)          │
│ • Strips filler words: and, then, the, a, of, etc.       │
│ • Preserves connecting words: in, into, on, to, for      │
│ • Keeps token pairs: lower (for matching) + original     │
│   (for value preservation in passwords/emails)           │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│ PARSER (Regex)                                           │
│ • Walks tokens left-to-right                             │
│ • Matches against ACTION_RULES (open, click, type, ...)  │
│ • Handles ambiguous words: enter, press, login, close    │
│ • Detects compound patterns: "X in Y", "X to Y", "from"  │
│ • Outputs Step[] — each step is one atomic action        │
└──────────────────────────────────────────────────────────┘
        │
        ▼ (if AI key present, parser may be BYPASSED for the LLM parser)
┌──────────────────────────────────────────────────────────┐
│ AI PARSER (Optional — Claude)                            │
│ • Used when regex output is empty or too coarse          │
│ • Sends instruction to Prompt Layer 1 (PARSER_SYSTEM)    │
│ • Returns same Step[] format                             │
│ • Falls back to regex on AI failure                      │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│ GENERATOR (Optional — only with --save)                  │
│ • Maps each Step to a Playwright code line               │
│ • Wraps in async IIFE with browser lifecycle             │
│ • Writes to output/specs/{name}-{timestamp}.spec.js      │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│ RUNNER (Step Execution Loop)                             │
│ For each step:                                           │
│   1. Try smart selector engine (12 fallback strategies)  │
│      a. data-testid match                                │
│      b. ARIA role + name                                 │
│      c. Exact text                                       │
│      d. Case-insensitive text                            │
│      e. Button role with text                            │
│      f. Link role with text                              │
│      g. Other ARIA roles with name                       │
│      h. Placeholder match                                │
│      i. Label match                                      │
│      j. Alt text / title attribute                       │
│      k. CSS attribute fallbacks                          │
│      l. Broad text search                                │
│   2. If fail + AI enabled: AI selector finder            │
│      • Captures comprehensive DOM snapshot               │
│      • Sends to Prompt Layer 2 (DOM_ANALYZER_SYSTEM)     │
│      • Tries returned selector                           │
│   3. If still fail + AI enabled: self-healer             │
│      • Sends failed step + DOM to Prompt Layer 3         │
│      • Returns strategy: retry / alternative / skip /    │
│        abort                                             │
│      • Applies recovery and retries once                 │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│ REPORTER                                                 │
│ • Prints colored, step-by-step results to terminal       │
│ • Saves screenshot to output/screenshots/                │
│ • Saves full JSON report to output/reports/              │
│ • Updates ~/.runly/last-run.json for replay              │
└──────────────────────────────────────────────────────────┘
```

### Key Files (for advanced debugging)

```
runly/
├── bin/runly.js                  # CLI entry point (commander)
├── src/
│   ├── commands/
│   │   ├── test.js               # `runly test` orchestrator
│   │   ├── doctor.js             # health checks
│   │   ├── auth.js               # API key management
│   │   ├── login.js              # session reuse (placeholder)
│   │   └── replay.js             # replay last run
│   ├── parser/
│   │   ├── index.js              # regex parser entry
│   │   ├── tokenizer.js          # English → tokens
│   │   ├── actionMap.js          # keyword → action rules
│   │   └── resolver.js           # URL/selector/key/duration resolvers
│   ├── ai/
│   │   ├── client.js             # Anthropic SDK wrapper
│   │   ├── prompts.js            # 6 engineered prompts
│   │   ├── parser.js             # AI command parser
│   │   ├── domSnapshot.js        # comprehensive DOM extraction
│   │   └── healer.js             # AI element finder + self-healer
│   ├── generator/
│   │   ├── index.js              # Step[] → spec.js
│   │   └── templates.js          # per-action code templates
│   ├── runner/
│   │   ├── index.js              # main execution loop + agentic retry
│   │   ├── stepExecutor.js       # per-action implementation
│   │   └── selectorEngine.js     # 12-strategy element finder
│   ├── reporter/
│   │   └── index.js              # terminal output + JSON report writer
│   └── utils/
│       ├── logger.js             # chalk + ora
│       ├── config.js             # ~/.runly/ management
│       └── paths.js              # output/ folder management
├── output/                       # all run artifacts (gitignored)
│   ├── screenshots/
│   ├── specs/
│   └── reports/
└── skills/runly.md               # this file
```

---

## 2. Prerequisites & Setup

### One-Time Installation

```bash
# Clone or navigate to the runly project
cd /path/to/runly

# Install Node dependencies
npm install

# Link the CLI globally so `runly` works from anywhere
npm link

# Install Chromium browser binary (required by Playwright)
npx playwright install chromium

# (Optional) install other browsers
npx playwright install firefox webkit
```

### Verify Setup

```bash
runly doctor
```

`runly doctor` runs four health checks. Each must pass before you run any tests:

| Check | What it verifies | Fix if it fails |
|---|---|---|
| Node.js v18+ | Modern Node runtime | Install Node 18 or higher via nvm/asdf |
| Playwright installed | npm package present | Run `npm install` in runly directory |
| Chromium ready | Browser binary launches | Run `npx playwright install chromium` |
| Config dir writable | `~/.runly/` exists and is writable | Check disk space and permissions |

If `doctor` is not all-green, **STOP** and fix the issue. Do not run tests against a broken setup — failures will be misleading.

### Optional: Enable AI Mode

For complex commands, vague intents, and self-healing on failure, configure an Anthropic API key.

**Persistent (saved to `~/.runly/config.json`):**
```bash
runly auth sk-ant-your-anthropic-key-here
```

**Environment variable (preferred for CI):**
```bash
export ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
# or
export RUNLY_AI_KEY=sk-ant-your-anthropic-key-here
```

Verify AI is active:
```bash
runly auth   # prints "AI mode is enabled" if key is configured
```

When AI is enabled, runly automatically engages the agentic loop:
- **Prompt Layer 1 (Parser):** Vague or compound English → atomic Step[]
- **Prompt Layer 2 (DOM Analyzer):** Element not found → Claude picks best selector from DOM snapshot
- **Prompt Layer 3 (Self-Healer):** Step failure → diagnose and choose retry / alternative / skip / abort

### Disable AI per-run

```bash
runly test "..." --no-ai
```

Use `--no-ai` for:
- CI runs where determinism > flexibility
- Smoke tests with known-good instructions
- Cost control in high-volume suites
- Reproducing parser bugs without AI noise

---

## 3. Running a Test

```bash
runly test "<instruction>"
```

The instruction can be:
- A bare URL: `runly test "google.com"`
- A single action: `runly test "open google.com"`
- A multi-step English sentence: `runly test "open google.com and search for playwright and verify results"`

The parser breaks it into atomic Step[] and the runner executes them sequentially against a real browser.

### All Flags

| Flag | Type | Default | Purpose |
|---|---|---|---|
| `--headed` | boolean | false | Show the browser window (visible mode) |
| `--save` | boolean | false | Export the test as a standalone Playwright `.spec.js` file in `output/specs/` |
| `--browser <type>` | string | `chromium` | Browser engine: `chromium`, `firefox`, or `webkit` |
| `--verbose` | boolean | false | Print parsed steps, AI reasoning, and selector strategy details |
| `--no-ai` | boolean | false | Force regex-only mode even if API key is configured |

### Exit Codes

| Code | Meaning |
|---|---|
| 0 | All steps passed (test success) |
| 1 | One or more steps failed (test failure) |

Note: runly does NOT use exit code 2 for setup errors. Setup issues (missing Chromium, no API key when required) cause clear stderr output and exit 1.

### Example Invocations

```bash
# 1. Bare URL
runly test "https://example.com"

# 2. Bare domain (auto-prepends https://)
runly test "google.com"

# 3. Single action
runly test "open github.com/login"

# 4. Multi-step
runly test "open github.com/login and type ritikpal in username and type Pass@123 in password and click sign in button"

# 5. Verification chain
runly test "open example.com and verify Example Domain is visible and verify url contains example"

# 6. Visible browser (debugging)
runly test "open testmuai.com and click login" --headed

# 7. Export as spec file (CI integration)
runly test "open google.com and search playwright" --save

# 8. Verbose output (parser debugging)
runly test "open testmuai.com and login with admin@x.com and Pass@123" --verbose

# 9. Force regex mode
runly test "open example.com" --no-ai

# 10. Different browser
runly test "open example.com" --browser firefox
```

### Replay Last Run

```bash
runly replay last
```

Re-runs whatever instruction was last executed. State is read from `~/.runly/last-run.json`. Useful when iterating on a flaky flow — fix the page, then `runly replay last` to verify.

---

## 4. Writing Effective Instructions

The instruction string is the single most important input. Phrase it well and the parser produces clean atomic steps. Phrase it poorly and the parser either drops actions, generates wrong selectors, or produces nonsense steps.

### The Three Instruction Patterns

| Pattern | Trigger phrases | Engine behavior |
|---|---|---|
| **Navigation** | `open`, `go to`, `navigate to`, `visit`, `launch`, `back`, `forward`, `reload` | Loads pages, manages history |
| **Interaction** | `click`, `tap`, `type`, `fill`, `enter`, `press`, `select`, `hover`, `scroll`, `upload`, `drag`, `clear`, `focus` | Performs DOM actions |
| **Verification** | `verify`, `check`, `assert`, `ensure`, `confirm`, `see`, `expect` | Pass/fail checks against page state |

### Field Targeting Pattern (Critical for Forms)

Use `in`, `into`, or `on` to target a specific field when typing:

```
type admin in username
type Pass@123 into password field
type test@x.com in the email field
type 9876543210 in phone number
```

The parser recognizes `in`/`into`/`on` as field separators and extracts:
- The **value** (preserving exact case for passwords, emails, IDs)
- The **target field description** (used by the selector engine)

If you omit the field separator, the parser will type into the first visible input on the page — which is fine for single-field forms but unreliable for multi-step flows.

### Compound Idiom Recognition

Some verbs expand into multiple atomic steps automatically:

| English idiom | Expands to |
|---|---|
| `search for X` | type X + press Enter |
| `search X` | type X + press Enter |
| `click on X` | click X (the "on" is a connector, not a verb) |
| `go to X` | goto X (the "to" is a connector) |

### Case Preservation Rules

Runly preserves the **original case** of all user-supplied values:
- Passwords: `Pass@123` stays `Pass@123` (not `pass@123`)
- Emails: `RitikPal@example.com` stays `RitikPal@example.com`
- IDs and tokens: `ABC-XYZ-123` stays `ABC-XYZ-123`
- URLs in instructions: preserved as-is

The tokenizer lowercases ONLY the action keywords and field descriptors, never the values you intend to type.

### Instruction Dos and Don'ts

| Do | Don't |
|----|-------|
| Use specific element descriptors: `click login button` | Use vague terms: `click thing`, `click button` |
| Use `in`/`into` to target fields: `type admin in username` | Drop the target: `type admin` (parser guesses) |
| Be explicit about flow: `click X and verify Y` | Imply: `click X` and hope verification happens |
| Chain with `and`/`then`: `open X and click Y and verify Z` | Use commas only without connecting words |
| Use `--save` for tests you'll run again | Re-type the same long instruction repeatedly |
| Quote strings with spaces in values: `type "John Doe" in name` | Rely on parser to guess where value ends |

### Anti-Pattern Examples

| Bad (vague, unparseable) | Good (specific, atomic) |
|---|---|
| `test the login flow` | `open site.com and type admin in username and type pass in password and click login button and verify dashboard` |
| `do checkout` | `click cart and click checkout and click place order` |
| `verify the page works` | `verify dashboard is visible and verify url contains home` |
| `check everything loads` | `verify hero heading is visible and verify 4 product cards` |
| `make sure form is correct` | `verify name field is visible and verify email field is visible and verify submit button is enabled` |

---

## 5. Action Vocabulary Reference

This is the complete list of action keywords runly understands. Use this as your reference when writing instructions.

### Navigation

| Verb (and synonyms) | Example | Result |
|---|---|---|
| `open` / `goto` / `go to` / `navigate to` / `visit` / `launch` / `load` / `browse` | `open google.com` | Navigate to URL with domcontentloaded wait |
| `back` / `goback` | `back` | Browser history back |
| `forward` / `goforward` | `forward` | Browser history forward |
| `reload` / `refresh` | `reload` | Reload current page |

### Click

| Verb | Example | Result |
|---|---|---|
| `click` / `tap` | `click login button` | Single left click |
| `doubleclick` / `dblclick` / `double-click` | `doubleclick item` | Double click |
| `rightclick` / `right-click` | `rightclick image` | Right click (context menu) |
| `hover` / `mouseover` / `mouse-over` | `hover profile menu` | Mouse hover |

### Form Input

| Verb | Example | Result |
|---|---|---|
| `type` / `enter` / `fill` / `input` / `write` | `type admin in username` | Fill text field |
| `clear` / `erase` / `empty` / `reset` | `clear email field` | Clear input |
| `focus` / `activate` | `focus search box` | Set focus |
| `select` / `choose` / `pick` | `select Mumbai from city dropdown` | Choose dropdown option |
| `upload` / `attach` | `upload resume.pdf` | File picker |
| `press` / `hit` (followed by key name) | `press Enter` | Keyboard event |

### Keyboard Keys (recognized after `press`)

| Key name | Maps to |
|---|---|
| `enter` / `return` | `Enter` |
| `tab` | `Tab` |
| `escape` / `esc` | `Escape` |
| `space` / `spacebar` | `Space` |
| `backspace` | `Backspace` |
| `delete` / `del` | `Delete` |
| `up` / `down` / `left` / `right` | `ArrowUp` / `ArrowDown` / `ArrowLeft` / `ArrowRight` |
| `home` / `end` | `Home` / `End` |
| `pageup` / `pagedown` | `PageUp` / `PageDown` |
| `f1`–`f12` | `F1`–`F12` |

### Movement & Layout

| Verb | Example | Result |
|---|---|---|
| `scroll` (with direction) | `scroll down`, `scroll to top`, `scroll bottom` | Page scroll |
| `wait` / `pause` / `sleep` / `delay` (with number) | `wait 3` | Pause N seconds (≤30) or N ms (>30) |
| `drag` / `move` (with `to`) | `drag item to cart` | Drag and drop |

### Verification

| Verb | Example | Result |
|---|---|---|
| `verify` / `check` / `assert` / `see` / `expect` / `confirm` / `ensure` | `verify dashboard is visible` | Assertion |

### Capture

| Verb | Example | Result |
|---|---|---|
| `screenshot` / `capture` / `snap` / `photo` | `screenshot` | Save PNG to `output/screenshots/` |

### Dialogs

| Verb | Example | Result |
|---|---|---|
| `accept` / `ok` / `confirm` / `allow` | `accept dialog` | Auto-accept next dialog |
| `dismiss` / `cancel` / `deny` / `reject` / `close` | `dismiss dialog` | Auto-dismiss next dialog |

---

## 6. Selector Resolution & DOM Targeting

When you write `click login button`, the selector engine has to find that element on a page where it might be:
- A `<button>` with text "Sign In"
- A `<div role="button">` with aria-label "Login"
- A `<a href="/login">` with class `btn-primary`
- An `<input type="submit" value="Log in">`

Runly tries 12 strategies in order, stopping at the first match. This is the **Smart Selector Engine** in `src/runner/selectorEngine.js`.

### The 12-Strategy Fallback Ladder

| # | Strategy | What it tries |
|---|---|---|
| 1 | Exact text | `getByText('login button', { exact: true })` |
| 2 | Case-insensitive text | `getByText(/login button/i)` |
| 3 | Button role + name | `getByRole('button', { name: /login button/i })` |
| 4 | Link role + name | `getByRole('link', { name: /login button/i })` |
| 5 | Other ARIA roles | textbox, checkbox, menuitem, tab, heading with name |
| 6 | Placeholder | `getByPlaceholder(/login button/i)` |
| 7 | Label | `getByLabel(/login button/i)` |
| 8 | Alt text | `getByAltText(/login button/i)` (images) |
| 9 | Title attribute | `getByTitle(/login button/i)` |
| 10 | Test ID | `getByTestId(/login button/i)` |
| 11 | CSS attribute fallbacks | `[data-testid*="..."]`, `[aria-label*="..."]`, `[name*="..."]`, `[id*="..."]`, `[class*="..."]` |
| 12 | Broad text search | Last resort: `getByText('login button')` (loose) |

### Position-Aware Selectors

You can target the Nth element of a kind:

```
click first product card
click last item in list
click 3rd button
click 2nd row
```

The parser extracts the index, the engine applies `.nth(N)` after the element type match.

### CSS Pass-Through

If you write a CSS selector directly, runly recognizes it and skips the natural language pipeline:

```
click #login-btn
click .submit-button
click button[type="submit"]
click [data-testid="signin"]
```

### Scoped Selectors

You can target elements within other elements:

```
click pay button in payment frame
click submit in registration form
click delete in user row
```

The parser recognizes `in`/`inside`/`within` and creates a scoped selector. If the scope contains "frame" or "iframe", it switches to iframe-aware finding.

### When the Selector Engine Fails

If all 12 strategies fail AND AI mode is enabled, runly falls back to:

1. **DOM Snapshot Capture** — extracts a comprehensive snapshot of all interactive elements (buttons, links, inputs, ARIA roles, headings, labels, modals, iframes, shadow DOM) with their attributes, state, and position info
2. **AI Element Finder** — sends the snapshot + your target description to Claude (Prompt Layer 2)
3. **Selector Generation** — Claude returns the best CSS selector with confidence and reasoning
4. **Retry** — runly tries the AI-suggested selector

If both fail, the step fails and the self-healer (Prompt Layer 3) takes over.

---

## 7. Assertion Patterns

Verification commands map to specific assertion types. The more specific your verification language, the more reliable the pass/fail signal.

### Assertion Types

| Type | English pattern | What it checks |
|---|---|---|
| `visible` | `verify X` / `verify X is visible` | Element exists in DOM AND is visible |
| `hidden` | `verify X is hidden` / `ensure X is not visible` | Element absent or hidden via CSS |
| `text-contains` | `verify page contains X` | Body text contains substring |
| `url-contains` | `verify url contains X` | Current URL has substring |
| `url-equals` | `verify url is X` | Current URL exactly matches |
| `title` | `verify title is X` / `verify title contains X` | Page `<title>` matches |
| `count` | `verify N items` / `check 5 buttons` | Element count equals N |
| `value` | `verify input has value X` | Form field's current value |
| `enabled` | `verify X is enabled` | Element is interactive |
| `disabled` | `verify X is disabled` | Element exists but disabled |
| `checked` | `verify X is checked` | Checkbox/radio state |

### Specificity Examples

**Exact match — value is known, must be precise:**
```
verify cart total shows $29.99
verify page title is Order Confirmation
verify input has value admin@example.com
```

**Flexible match — care about presence, not exact value:**
```
verify a price is displayed
verify url contains /dashboard
verify there are more than 3 results
```

**State assertions:**
```
verify submit button is disabled
verify checkbox is checked
verify Monthly tab is selected
```

**Negative assertions (absence):**
```
verify error banner is hidden
verify cart is empty
```

**Positional / structural:**
```
verify Settings appears in navigation
verify first row shows admin
```

### Assertion Anti-Patterns

| Bad (vague) | Good (specific) |
|---|---|
| `check the page works` | `verify dashboard is visible and verify user avatar is visible` |
| `verify login` | `verify url contains /dashboard and verify welcome message is visible` |
| `make sure form is correct` | `verify Name field is visible and verify Submit button is enabled` |
| `test the search` | `type query in search and press Enter and verify results have at least 1 item` |

### Assertion Placement

For **testing/QA tasks**, assert at every critical juncture:
- After authentication — correct user/role visible
- After data mutation — confirmation toast, updated record
- After payment — correct total, correct items
- After navigation — correct page loaded

For **general browser tasks** (research, scraping, smoke tests), only assert the final desired state.

---

## 8. Output Structure & Artifacts

Every test run writes structured output to the `output/` folder at the project root. This is gitignored and safe to delete.

```
output/
├── screenshots/                            # All captured PNGs
│   ├── result-{ISO-timestamp}.png          # Final screenshot on success
│   ├── failure-{ISO-timestamp}.png         # Screenshot at failure point
│   └── manual-{ISO-timestamp}.png          # Screenshots from explicit screenshot steps
├── specs/                                  # Generated Playwright test files (--save flag only)
│   └── {first-words}-{ISO-timestamp}.spec.js
└── reports/                                # Full JSON reports — one per run
    └── report-{ISO-timestamp}.json
```

### Report Schema

Every run produces a JSON report at `output/reports/report-{timestamp}.json`:

```json
{
  "instruction": "open example.com and verify Example Domain",
  "timestamp": "2026-04-11T19:10:39.972Z",
  "success": true,
  "duration": 1660,
  "totalSteps": 2,
  "passedSteps": 2,
  "failedStep": null,
  "error": null,
  "url": "https://example.com/",
  "title": "Example Domain",
  "screenshot": "/abs/path/to/output/screenshots/result-2026-04-11T19-10-39-899Z.png",
  "steps": [
    {
      "number": 1,
      "action": "goto example.com",
      "success": true,
      "message": "Navigated to https://example.com"
    },
    {
      "number": 2,
      "action": "assert example domain",
      "success": true,
      "message": "Visible: example domain"
    }
  ]
}
```

### Failed Run Schema

```json
{
  "instruction": "open site.com and click login and type admin in user",
  "timestamp": "2026-04-11T19:15:22.300Z",
  "success": false,
  "duration": 18370,
  "totalSteps": 3,
  "passedSteps": 2,
  "failedStep": 3,
  "error": "Type failed: locator.click: Timeout 5000ms exceeded",
  "url": "https://site.com/login",
  "title": null,
  "screenshot": "/abs/path/to/output/screenshots/failure-2026-04-11T19-15-22-300Z.png",
  "steps": [
    { "number": 1, "action": "goto site.com", "success": true, "message": "Navigated to https://site.com" },
    { "number": 2, "action": "click login button", "success": true, "message": "Clicked: click login button" },
    { "number": 3, "action": "type admin in user", "success": false, "message": "Type failed: locator.click: Timeout 5000ms exceeded" }
  ]
}
```

### Generated Spec Files (with `--save`)

```js
// Generated by Runly — 2026-04-11T19:10:39.972Z
// Command: open example.com and verify Example Domain

import { chromium, expect } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Step 1: goto example.com
    await page.goto('https://example.com');

    // Step 2: assert example domain
    await expect(page.getByText('example domain')).toBeVisible();

    console.log('\n✓ All steps passed');
  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    await page.screenshot({ path: 'runly-failure.png' });
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
})();
```

These files can be:
- Committed to a repo as regression tests
- Run independently with `node spec.js`
- Imported into existing Playwright test suites
- Modified by hand for advanced cases

### Persistent State

```
~/.runly/
├── config.json                # API key + user preferences
├── last-run.json              # Last instruction + options (for replay)
└── sessions/                  # Saved auth sessions (Phase 3 — placeholder)
    └── {domain}.json          # Playwright storageState
```

`~/.runly/config.json` schema:
```json
{
  "apiKey": "sk-ant-...",
  "preferences": {
    "defaultBrowser": "chromium",
    "defaultHeadless": true
  }
}
```

`~/.runly/last-run.json` schema:
```json
{
  "instruction": "open google.com and search playwright",
  "options": {
    "headed": false,
    "save": false,
    "browser": "chromium",
    "verbose": true
  },
  "timestamp": 1775846105289
}
```

---

## 9. AI Mode (Agentic Behavior)

When an Anthropic API key is configured, runly runs in agentic mode. The execution loop becomes a Think → Observe → Decide → Adapt → Explain cycle.

### The Five Agentic Stages

| Stage | What happens | File |
|---|---|---|
| **Think** | LLM parses ambiguous English into structured Step[] | `src/ai/parser.js` |
| **Observe** | Captures comprehensive DOM snapshot of page | `src/ai/domSnapshot.js` |
| **Decide** | LLM picks best CSS selector when 12-strategy search fails | `src/ai/healer.js → findElementWithAI()` |
| **Adapt** | LLM diagnoses failure and proposes recovery (retry/alt/skip/abort) | `src/ai/healer.js → healFailedStep()` |
| **Explain** | Each AI decision logged with reasoning to terminal + report | `src/reporter/index.js` |

### When AI Engages (Decision Tree)

```
Instruction received
       │
       ▼
Try regex parser
       │
   ┌───┴───┐
   │       │
 ✓ produces Step[]   ✗ produces empty
   │                  │
   │                  ▼
   │              Use AI parser (Prompt 1)
   │                  │
   ▼                  ▼
For each step:
       │
       ▼
Try selector engine (12 strategies)
       │
   ┌───┴───┐
   │       │
 ✓ found   ✗ not found
   │       │
   │       ▼
   │   AI mode on?
   │       │
   │   ┌───┴───┐
   │   │       │
   │   no      yes
   │   │       │
   │   ▼       ▼
   │ FAIL    AI element finder (Prompt 2)
   │           │
   │       ┌───┴───┐
   │       │       │
   │     ✓ found   ✗ not found
   │       │       │
   │       │       ▼
   │       │   AI self-healer (Prompt 3)
   │       │       │
   │       │   ┌───┼───┬───┐
   │       │   │   │   │   │
   │       │  retry alt skip abort
   │       │   │   │   │   │
   │       ▼   ▼   ▼   ▼   ▼
   ▼       Execute action → result
EXECUTE ACTION → result
```

### Cost Awareness

Each `runly test` invocation makes between 0 and N+2 LLM calls:

| Scenario | Calls | Approx cost (Sonnet 4) |
|---|---|---|
| Specific instruction + all steps pass | 0 | $0 |
| Vague instruction, all steps pass | 1 (parser) | ~$0.005 |
| 5 steps, 1 fails + heals | 1 parser + 2 healing | ~$0.015 |
| 10 steps, 3 fail + heal | 1 parser + 6 healing | ~$0.04 |

For high-volume CI, use `--no-ai` for stable tests and reserve AI for complex flows.

### AI Mode Best Practices

1. **Use AI for exploration, regex for production.** Develop tests in AI mode to handle real-world page variations, then save with `--save` and run the generated specs in regex mode for speed.

2. **Set reasonable expectations.** AI is not magic. It can't:
   - Solve CAPTCHAs
   - Bypass auth walls
   - Handle truly broken pages (500 errors, network failures)
   - Read text inside images

3. **Watch token costs.** Use `--verbose` to see how many AI calls were made per run. If a test makes >5 AI calls regularly, the instruction is too vague — rewrite it.

4. **Self-healed steps are marked.** In reports, healed steps show `[self-healed]` in the message. Don't let healing mask underlying flakiness — investigate and fix the root cause.

---

## 10. Debugging Failed Runs

When a test fails, runly produces these artifacts (always):

1. **Console output** — failed step number, error message, partial step results
2. **`output/screenshots/failure-{timestamp}.png`** — visual state at failure point
3. **`output/reports/report-{timestamp}.json`** — full step-by-step trace

### The Debugging Checklist

Walk through this checklist before assuming it's a runly bug:

1. **Read the console output first.** Look for "FAILED at step N" — this tells you which step broke.
2. **Open the failure screenshot.** This shows what the page actually looked like when the step ran.
3. **Read the report JSON.** Walk through `steps[]`. The first `success: false` is your culprit.
4. **Identify the failure category** (use the table below).
5. **Re-run with `--verbose --headed`** to see parser output and watch the browser execute.
6. **Try the regex parser explicitly:** `--no-ai` to rule out AI-induced changes.
7. **Try with `--browser firefox`** to rule out Chromium-specific issues.

### Failure Categories

| Symptom | Cause | Fix |
|---|---|---|
| `Element not found: click {empty}` | Parser stripped action target | Be more specific: `click login button` not `click login` |
| `Element not found: click X` | Selector engine couldn't match X | Use a more specific descriptor or enable AI mode |
| `Click failed: Timeout exceeded` | Element exists but not clickable (overlay, disabled, off-screen) | Add `wait 2` before click, or `scroll to X` first |
| `Type failed: ...click...timeout` | Field exists but not focusable | Field may be inside an iframe — use AI mode for iframe finding |
| `Type failed: input is disabled` | Form validation locked the field | Click another field first to trigger validation |
| `Navigation failed` | URL is wrong, DNS issue, or page errored | Test the URL in a browser manually |
| Test passes but URL is wrong | Visibility assertion matched cached text | Use URL assertion: `verify url contains /dashboard` |
| Random flakiness on CI but works locally | Page not fully loaded before action | Add `wait` step or enable AI mode for smart waits |
| AI healed but with low confidence | Self-healer guessing | Investigate root cause — don't rely on healing |
| Test "passes" but did the wrong thing | Selector matched a similar element | Use more specific descriptor: `click first product card` |

### Debugging Recipes

**Recipe 1: Watch the browser execute**
```bash
runly test "your instruction here" --headed --verbose
```
You'll see Chrome open, every step executes visibly, and the terminal shows parsed steps + step results in real time.

**Recipe 2: Compare with and without AI**
```bash
runly test "your instruction" --no-ai --verbose > regex.log
runly test "your instruction" --verbose > ai.log
diff regex.log ai.log
```
Tells you whether AI is helping or hurting.

**Recipe 3: Save the spec and run it directly**
```bash
runly test "your instruction" --save
node output/specs/{generated-file}.spec.js
```
Bypasses runly entirely. If the spec file works but `runly test` doesn't, the bug is in runly. If both fail, the bug is in the page.

**Recipe 4: Capture DOM at the failure point**
Read the failure screenshot and the `output/reports/report-*.json`. The report includes the URL at failure — manually navigate there in a browser and inspect the DOM.

---

## 11. Bug Reporting Decision Tree

```
Test failed
   │
   ▼
Did doctor pass before the run?
   │
 ┌─┴─┐
 no   yes
 │     │
 ▼     ▼
SETUP ISSUE — fix doctor first, don't file bug
       │
       ▼
   Was the instruction specific enough?
       │
     ┌─┴─┐
     no   yes
     │     │
     ▼     ▼
   USER ERROR — rewrite instruction, don't file bug
           │
           ▼
       Did the page exist and load?
           │
         ┌─┴─┐
         no   yes
         │     │
         ▼     ▼
       SITE ISSUE — page broken/changed/blocked, don't file bug
               │
               ▼
           Did regex parser produce reasonable Step[]?
               │
             ┌─┴─┐
             no   yes
             │     │
             ▼     ▼
           PARSER BUG — file it
                     │
                     ▼
                 Did selector engine try the right strategies?
                     │
                   ┌─┴─┐
                   no   yes
                   │     │
                   ▼     ▼
                 SELECTOR BUG — file it
                           │
                           ▼
                       Did AI mode help or make it worse?
                           │
                         ┌─┴─┐
                         worse no help
                         │     │
                         ▼     ▼
                       AI BUG — file it
                                 │
                                 ▼
                             Did self-healer pick wrong strategy?
                                 │
                               ┌─┴─┐
                               yes  no
                               │     │
                               ▼     ▼
                             HEALER BUG — file it
                                     │
                                     ▼
                                 Genuine page complexity — improve instruction
```

### What to Include in a Bug Report

1. **The exact `runly test` command** that failed
2. **Console output** including the parsed steps section (run with `--verbose`)
3. **`output/reports/report-{timestamp}.json`** for the failed run
4. **`output/screenshots/failure-{timestamp}.png`** at the failure point
5. **Runly version** (`cat package.json | grep version` from the runly directory)
6. **Whether AI mode was enabled** (yes/no, model used)
7. **Page URL** that was being tested (if it's public)
8. **Expected behavior** vs **actual behavior**
9. **Reproduction steps** if the page requires specific state

---

## 12. Post-Run: Rate, Report, Present

**After EVERY `runly test` completes, you MUST do the following:**

### Step 1: Present Results in a Table

Always present the run outcome as a structured table, regardless of pass/fail.

**For action runs:**

| Field | Value |
|---|---|
| Status | ✅ passed / ❌ failed |
| Instruction | The original instruction |
| Duration | Xms |
| Steps | passed/total |
| Final URL | https://... |
| Screenshot | path/to/screenshot.png |
| Report | path/to/report.json |

**For verification runs**, add an assertion table:

| Assertion | Result |
|---|---|
| Dashboard is visible | ✅ Passed |
| URL contains /home | ❌ Failed |
| 5 items in cart | ✅ Passed |

### Step 2: Rate the Run (1–10 Scale)

| Score | Criteria |
|---|---|
| **9–10** | Instruction parsed cleanly. All steps passed in regex mode. No AI heals needed. Fast execution. |
| **7–8** | Passed but with minor issues: 1 AI heal, slightly off parsing that still worked, slow execution. |
| **5–6** | Passed only because AI healed multiple steps OR partial success requiring manual interpretation of screenshots. |
| **3–4** | Failed mid-flow at a known limitation (vague instruction, page changed). Recoverable with rewrite. |
| **1–2** | Crashed, infinite loop, or completely wrong behavior. Looks like a runly bug. |

Present the rating as:
> **Runly Rating: X/10** — One-line reason.

### Step 3: Suggest Bug Report (if rating ≤ 6 AND looks like runly bug)

Use the decision tree in Section 11. If the failure passes the bug filter, prompt the user:

> The test struggled with this run. This looks like it could be a runly bug.
> Want to file a report? I'll include the command, parsed steps, report JSON, and failure screenshot.

**Do NOT suggest a bug report for:**
- Vague instructions (suggest rewriting instead)
- Site-side issues (404, CAPTCHA, network errors)
- Doctor failures (auth/setup issues)
- Cases where `--no-ai` would have worked

### Step 4: Suggest Next Action

Based on the result, suggest what to do next:

**On pass:**
- "Want me to save this as a spec file with `--save` for future regression testing?"
- "Should I add this to your test index for impact analysis?"

**On fail:**
- "Want me to re-run with `--headed --verbose` to see what happened?"
- "Should I try with `--no-ai` to isolate the parser?"
- "I noticed the failure was at step N — should I split this into smaller instructions?"

### Example Post-Run Output

```
| Field       | Value                                                |
|-------------|------------------------------------------------------|
| Status      | ✅ passed                                             |
| Instruction | open github.com/login and type admin in username... |
| Duration    | 3829ms                                               |
| Steps       | 4/4                                                  |
| Final URL   | https://github.com/session                           |
| Screenshot  | output/screenshots/result-2026-04-11T20-08-24Z.png   |
| Report      | output/reports/report-2026-04-11T20-08-24Z.json      |

**Runly Rating: 9/10** — All 4 steps passed in regex mode, no AI calls needed,
password case preserved correctly, fast execution.

**Next:** Want to save this as a regression spec with `--save`?
```

---

## 13. Decomposing Large Instructions

### When to Split

Split an instruction when ANY of these apply:

| Trigger | Reason |
|---|---|
| More than 10 atomic actions | Long chains accumulate parser ambiguity |
| Multiple independent flows | Login + checkout shouldn't share fate |
| Different pages or features | Settings vs cart vs admin = 3 separate runs |
| Mixed verification depth | Smoke test vs deep assertion shouldn't be one command |
| Different user roles | Admin and regular user flows must be separate |
| Different browser sessions | Each user needs a fresh browser context |

### Decomposition Strategy: Self-Contained Sub-Instructions

Each sub-instruction must be **fully self-contained**:
- Starts with its own `open ...` step
- Logs in if needed (credentials repeated, not assumed)
- Runs its own assertions
- Does not depend on a previous run leaving state

**Before (one massive instruction — 18 actions):**
```bash
runly test "open site.com and login as admin and pass and verify dashboard and click settings and change name to Test User and save and verify success and click products and search shoes and verify results and add to cart and verify cart and click checkout and verify total and click admin panel and verify user list"
```

**After (4 independent sub-instructions):**
```bash
# 1. Login + Dashboard verification
runly test "open site.com and type admin in username and type pass in password and click sign in and verify dashboard is visible"

# 2. Settings update flow
runly test "open site.com/settings and type Test User in display name and click save and verify success message"

# 3. Product search + cart
runly test "open site.com/products and type shoes in search and press Enter and verify results and click first product and click add to cart and verify cart has 1 item"

# 4. Admin panel verification
runly test "open site.com/admin and type admin in username and type pass in password and click sign in and click admin panel and verify user list is visible"
```

### Splitting Rules

| Rule | Reason |
|---|---|
| Each sub-instruction starts with `open ...` | No state assumed from previous runs |
| Each sub-instruction has its own assertions | A passing run = that flow works in isolation |
| Use `--save` per sub-instruction | Get individual spec files for committing |
| Group related runs in a shell script | Reproducible test suites |
| Reuse credential variables via shell expansion | DRY without coupling tests |

### Shell Script Pattern

```bash
#!/bin/bash
# smoke-suite.sh — runly smoke test suite

USER="admin"
PASS="Pass@123"
SITE="https://staging.acme.dev"

set -e  # exit on first failure (or remove to run all tests)

echo "Test 1: Login flow"
runly test "open ${SITE}/login and type ${USER} in username and type ${PASS} in password and click sign in and verify dashboard"

echo "Test 2: Product search"
runly test "open ${SITE}/products and type shoes in search and press Enter and verify results"

echo "Test 3: Cart"
runly test "open ${SITE} and click first product and click add to cart and verify cart has 1 item"

echo "All tests passed."
```

---

## 14. Batch Runs & Parallel Orchestration

Runly is sequential within a single process. To run multiple tests in parallel, spawn multiple `runly test` processes and collect their reports.

### Pattern A: Parallel Shell Background Jobs

```bash
#!/bin/bash
# parallel-suite.sh — run 4 tests in parallel

runly test "open site.com/login and type admin in user and type pass in password and click sign in and verify dashboard" &
PID1=$!

runly test "open site.com/products and type shoes in search and press Enter and verify results" &
PID2=$!

runly test "open site.com/cart and verify cart page" &
PID3=$!

runly test "open site.com/admin and verify admin panel" &
PID4=$!

wait $PID1 $PID2 $PID3 $PID4

# Reports are in output/reports/, sorted by timestamp
ls -t output/reports/*.json | head -4
```

### Pattern B: Programmatic Orchestration via Sub-Agents

When you need finer control (per-test reporting, structured aggregation), spawn a sub-agent for each test:

```
1. Decompose the goal into N independent sub-instructions
2. Spawn N Agent tool calls in a SINGLE message — each runs:
     runly test "<sub-instruction>" --verbose
3. Each agent:
   a. Runs the runly command via Bash
   b. Captures exit code (0=pass, 1=fail)
   c. Reads the latest report JSON from output/reports/
   d. Returns: status, step count, duration, summary, report path, failure screenshot path (if any)
4. After ALL agents complete, format the batch summary table
```

### Sub-Agent Prompt Template

When spawning a sub-agent for a single test, give it this prompt:

```
Run this runly browser test and report results:

    runly test "<INSTRUCTION>" --verbose

After the command completes:
1. Capture the exit code (0=pass, 1=fail)
2. Find the most recent report JSON in output/reports/
3. Read the report and extract: success, totalSteps, passedSteps, duration, failedStep, error, url, screenshot
4. If failed, include the failure screenshot path
5. Return a structured summary (JSON or markdown) with:
   - status (✅/❌)
   - instruction (the input)
   - steps passed/total
   - duration
   - failure step + error (if any)
   - report path
   - screenshot path
```

### Batch Summary Table Format

```markdown
## 🧪 Test Suite: Acme Smoke Tests
**Run at:** 2026-04-11 14:30 UTC · **Env:** staging

| # | Test                  | Status | Steps | Duration | Notes                       |
|---|-----------------------|--------|-------|----------|-----------------------------|
| 1 | Login + dashboard     | ✅      | 5/5   | 12s      | -                           |
| 2 | Product search        | ✅      | 4/4   | 8s       | -                           |
| 3 | Cart page             | ❌      | 2/3   | 6s       | Cart did not load           |
| 4 | Admin panel           | ✅      | 3/3   | 5s       | -                           |

### 📊 Aggregates
- **Pass rate:** 3/4 (75%)
- **Total steps:** 14 · **Total time:** 31s
- **Avg duration:** 7.75s
- **Slowest:** #1 Login + dashboard (12s)

### ❌ Failures
**#3 Cart page** — Step 3/3 failed: `verify cart has items`
- Error: Element not found
- Screenshot: `output/screenshots/failure-2026-04-11T14-30-22Z.png`
- Report: `output/reports/report-2026-04-11T14-30-22Z.json`
- Diagnosis: Cart state not loading. Possibly empty cart or backend timeout.
```

Status icons:
- ✅ `passed` — all steps succeeded
- ❌ `failed` — at least one step failed (with or without AI heal)

---

## 15. Rerun Comparison & Diff Analysis

When you run the same instruction twice (or against staging vs prod), compare reports to detect flakiness or regressions.

### Pattern: Compare Two Runs

```
1. Run the instruction — note the report path A from output/reports/
2. Run it again (or against different env) — note report path B
3. Read both report JSONs
4. Compare: success, totalSteps, passedSteps, duration, per-step results
5. Format as a diff table
```

### Diff Table Format

```markdown
## 🔄 Rerun Comparison: Login Flow

| Metric        | Run A (local)    | Run B (staging)  | Delta            |
|---------------|------------------|------------------|------------------|
| **Status**    | ✅ passed         | ❌ failed         | 🔴 regression     |
| **Steps**     | 5/5              | 3/5              | -2 passed        |
| **Duration**  | 3.8s             | 12.1s            | +8.3s            |
| **Final URL** | /dashboard       | /login           | ⚠️ different      |

### Step-by-Step Diff
| Step | Run A                       | Run B                       | Match |
|------|-----------------------------|-----------------------------|-------|
| 1    | Navigated to /login         | Navigated to /login         | ✅     |
| 2    | Typed: "admin"              | Typed: "admin"              | ✅     |
| 3    | Typed: "Pass@123"           | Typed: "Pass@123"           | ✅     |
| 4    | Clicked: sign in button     | Click failed: timeout       | ❌     |
| 5    | Visible: dashboard          | (skipped — previous failed) | ❌     |

**Diagnosis:** Staging login button is slower to render after staging deployment.
The button was eventually clickable but runly's 10s timeout was insufficient.
**Recommendation:** Add a `wait 3` step before the click, or enable AI mode
for smart waits, or investigate why staging is slower.

**Screenshots:**
- Run A: `output/screenshots/result-2026-04-11T19-10-39Z.png`
- Run B: `output/screenshots/failure-2026-04-11T19-15-22Z.png`
```

Build the diff by reading both report JSONs and aligning by step number.

### Determining "Run A" vs "Run B"

Reports are timestamped. To compare the two most recent runs of the same instruction:

```bash
ls -t output/reports/*.json | head -2
# Run A = first listed (most recent)
# Run B = second listed (previous)
```

To find runs of a specific instruction, filter by content:
```bash
grep -l "open site.com/login" output/reports/*.json | sort -r | head -2
```

---

## 16. Coverage Trends & Regression Tracking

When running the same suite repeatedly (after each commit/deploy), track the trend over time.

### Pattern: Daily Trend Report

```markdown
## 📈 Coverage Trend: Acme Dashboard Smoke Suite

| Date       | Total | ✅ Pass | ❌ Fail | Pass Rate | Avg Time | Δ Pass Rate |
|------------|-------|---------|---------|-----------|----------|-------------|
| 2026-04-08 | 5     | 5       | 0       | 100%      | 8s       | -           |
| 2026-04-09 | 5     | 5       | 0       | 100%      | 9s       | 0%          |
| 2026-04-10 | 5     | 4       | 1       | 80%       | 11s      | -20%        |
| 2026-04-11 | 5     | 3       | 2       | 60%       | 14s      | -20%        |

**Trend:** ⬇️ Regression detected over the last 3 days.
**Failing tests:** checkout-flow (consistently), cart-persistence (since 2026-04-10)
**Action:** Investigate cart and checkout changes in last 4 days of commits.
```

Build this by maintaining a `output/trends/trend.json` file or by reading historical reports from `output/reports/` filtered by date.

### Regression Alert Format

When a previously-passing test starts failing:

```markdown
## 🚨 Regression Alert: checkout-flow

**Test:** checkout-flow
**Last passed:** 2026-04-10 at 14:22 UTC (2 days ago)
**First failed:** 2026-04-11 at 09:15 UTC (today)
**Failure count since:** 4 of 5 runs

### Failure Pattern
| Run                  | Status | Failed Step | Reason                       |
|----------------------|--------|-------------|------------------------------|
| 2026-04-11 09:15     | ❌      | 5/8         | Payment form did not load    |
| 2026-04-11 11:30     | ❌      | 5/8         | Payment form did not load    |
| 2026-04-11 14:00     | ✅      | -           | (transient — flake)          |
| 2026-04-11 16:45     | ❌      | 5/8         | Payment form did not load    |
| 2026-04-11 18:20     | ❌      | 5/8         | Payment form did not load    |

**Likely cause:** Consistent failure at the payment form step suggests a real
regression in checkout logic, not flakiness. Most recent passing build was
2026-04-10. Investigate commits between 2026-04-10 and 2026-04-11.

**Bisect command:**
```bash
git log --oneline --since="2026-04-10" --until="2026-04-11"
```
```

---

## 17. Impact Analysis from Code Changes

When the user (or another agent) has made code changes, identify which browser flows are affected and run the impacted tests automatically.

### Pattern: Diff-Driven Test Selection

```
1. Read the code diff (git diff or staged changes)
2. Identify changed files — routes, components, API endpoints, styles
3. Map changes to user-facing flows (using mapping table below)
4. Find existing test instructions in tests/index.json (if it exists)
5. Run the impacted tests
6. Report results with coverage mapping and regression flagging
```

### File-Pattern → Flow Mapping Table

| Changed file pattern | Likely impacted flows |
|---|---|
| `auth/`, `login`, `session`, `oauth` | Login, logout, session persistence, protected routes |
| `cart`, `checkout`, `payment`, `order` | Add to cart, checkout, payment processing, order confirmation |
| `search`, `filter`, `sort`, `query` | Product search, result filtering, sort order |
| `profile`, `settings`, `account`, `user` | Profile editing, password change, preferences |
| `admin`, `dashboard`, `analytics`, `report` | Admin panel, reporting, data export |
| `Header`, `Nav`, `Layout`, `Sidebar`, `Menu` | Navigation on ALL pages — broad impact |
| `api/`, `routes/`, `endpoints/`, `controllers/` | Any flow that calls those endpoints — needs full smoke suite |
| `package.json`, `webpack.config.js`, `vite.config.js` | All flows — build changed, run full suite |
| `*.test.js`, `*.spec.js` | No browser flows directly impacted (test code only) |
| `README.md`, `docs/` | No flows impacted (documentation only) |
| CSS/styles for specific components | Visual verification of those components |

### Test Index Convention

Maintain a test index at `tests/index.json` so impacted tests can be found automatically:

```json
{
  "tests": [
    {
      "name": "login-flow",
      "instruction": "open site.com/login and type admin in username and type pass in password and click sign in and verify dashboard is visible",
      "covers": ["auth", "login", "dashboard", "session"],
      "priority": "critical",
      "runs_per_day": 24
    },
    {
      "name": "product-search",
      "instruction": "open site.com/products and type shoes in search and press Enter and verify results have at least 1 item",
      "covers": ["search", "products", "filter"],
      "priority": "high",
      "runs_per_day": 12
    },
    {
      "name": "checkout-flow",
      "instruction": "open site.com and click first product and click add to cart and click checkout and verify payment form is visible",
      "covers": ["cart", "checkout", "payment", "products"],
      "priority": "critical",
      "runs_per_day": 24
    },
    {
      "name": "admin-export",
      "instruction": "open site.com/admin and type admin in username and type adminpass in password and click sign in and click export csv and verify download",
      "covers": ["admin", "export", "csv"],
      "priority": "medium",
      "runs_per_day": 4
    }
  ]
}
```

### Searching the Test Index

To find tests impacted by a change:
1. Run `git diff --name-only` to get changed files
2. Map each path to flow tags using the mapping table
3. Filter `tests/index.json` to tests where `covers` overlaps with affected tags
4. Sort by `priority` (critical → high → medium → low)
5. Deduplicate

**Example:** `src/components/Cart.tsx` and `src/api/checkout.ts` changed:
- Tags: `cart`, `checkout`, `payment`
- Matching tests: `checkout-flow` (critical) — only this one is impacted

### Auto Mode: Full Pipeline

When the user asks to "test impacted flows" or "run impact analysis":

```
1. Run `git diff --name-only` (or diff against base branch)
2. Read the changed files to understand what was modified
3. Map to impacted flows using mapping table + tests/index.json
4. Present the plan to the user:
   "Found 2 impacted flows from changes to Cart.tsx and checkout.ts:
    1. 🔴 checkout-flow (critical)
    2. 🟡 cart-persistence (high)
    Run both?"
5. On confirmation, spawn parallel runly test commands
6. Collect reports, format batch summary
7. Compare to last successful run — flag any regressions
```

**Full auto mode** (user says "run all without asking"):
Skip the confirmation step. Only stop if >10 tests are impacted (ask confirmation at that scale).

### Impact Report Format

```markdown
## 🎯 Impact Analysis: Changes on `feat/cart-redesign`

**Branch:** feat/cart-redesign vs main
**Changed files:** Cart.tsx, CartItem.tsx, checkout.ts, cart.css
**Impacted tags:** cart, checkout, payment

### Impacted Tests (sorted by priority)
| # | Test           | Priority    | Status | Steps | Time | vs Last Run         |
|---|----------------|-------------|--------|-------|------|---------------------|
| 1 | checkout-flow  | 🔴 critical | ✅      | 8/8   | 22s  | unchanged           |
| 2 | cart-persist   | 🟡 high     | ❌      | 5/7   | 14s  | 🔴 NEW REGRESSION    |

**Results: 1/2 passed · 1 regression in cart-persist**

### ❌ cart-persist regression
**Last passed:** 2 hours ago on main branch
**Step 6/7:** `verify cart has 2 items` — Element not found.
**Likely cause:** Cart state not persisted to localStorage after redesign.
**Screenshot:** `output/screenshots/failure-2026-04-11T14-30-22Z.png`
**Report:** `output/reports/report-2026-04-11T14-30-22Z.json`

### ✅ Unaffected Flows (not retested)
- login-flow — no auth changes detected
- product-search — no search changes detected
- admin-export — no admin changes detected

### Recommended Action
Block the merge until cart-persist is fixed. The failure is consistent and
appeared after the cart redesign.
```

---

## 18. Multi-Environment Testing Patterns

### Pattern: Same Suite Across Environments

Run the same instructions against staging and prod simultaneously to catch env-specific issues.

```bash
#!/bin/bash
# multi-env.sh — run same suite against staging and prod in parallel

declare -A ENVS=(
  ["staging"]="https://staging.acme.dev"
  ["prod"]="https://app.acme.dev"
)

declare -A USERS=(
  ["staging"]="staging-user@x.com"
  ["prod"]="prod-smoke@x.com"
)

declare -A PASSES=(
  ["staging"]="StagingPass123"
  ["prod"]="ProdSmokePass456"
)

for ENV in staging prod; do
  URL="${ENVS[$ENV]}"
  USER="${USERS[$ENV]}"
  PASS="${PASSES[$ENV]}"

  echo "=== Testing $ENV ==="

  runly test "open ${URL}/login and type ${USER} in username and type ${PASS} in password and click sign in and verify dashboard" &
done

wait
```

### Side-by-Side Comparison Format

```markdown
## 🌐 Cross-Environment: Login Flow

| Metric       | Staging              | Production          |
|--------------|----------------------|---------------------|
| Status       | ✅ passed             | ❌ failed            |
| Duration     | 5.2s                 | 12.8s               |
| Steps passed | 5/5                  | 4/5                 |
| Failed step  | -                    | verify dashboard    |

### Diagnosis
Production login takes 2.5x longer than staging. The dashboard verification
failed in prod because the redirect from /login → /dashboard takes longer
than runly's default timeout. Staging is fast enough that the same flow works.

### Action
- Add explicit `wait 5` before dashboard verification in prod
- OR investigate why prod login is slower than staging
- OR enable AI mode (`--ai`) for smart waits
```

### Environment Isolation

Each parallel runly process gets its own browser context. Sessions, cookies,
and localStorage do NOT leak between processes. Safe for cross-env runs.

---

## 19. Recipes: Common Patterns

### Recipe 1: Smoke Test a Deploy

```bash
runly test "open site.com and verify Welcome heading is visible and verify Sign Up button is visible"
```

Quick check that the homepage loads and renders key elements. Use as the first thing after every deploy.

### Recipe 2: Login and Verify Dashboard

```bash
runly test "open site.com/login and type admin@x.com in email and type Pass@123 in password and click sign in and verify dashboard is visible and verify url contains /dashboard"
```

End-to-end auth check. Verifies both visible state and URL change.

### Recipe 3: Search and Result Verification

```bash
runly test "open site.com and click search and type wireless headphones and press Enter and verify results contain headphones"
```

Tests search functionality with content verification.

### Recipe 4: Form Submission with Validation

```bash
runly test "open site.com/contact and type John Doe in name and type john@x.com in email and type Test message in message and click submit and verify success message is visible"
```

Multi-field form with success verification.

### Recipe 5: Shopping Cart Flow

```bash
runly test "open site.com/products and click first product and click add to cart and verify cart has 1 item and click checkout and verify payment form is visible"
```

Multi-page e-commerce flow.

### Recipe 6: Page Navigation Chain

```bash
runly test "open site.com and click About and verify url contains /about and back and verify url is site.com and click Contact and verify url contains /contact"
```

Tests navigation history works correctly.

### Recipe 7: Visual Regression Capture

```bash
runly test "open site.com and screenshot and scroll down and screenshot and scroll bottom and screenshot"
```

Captures the page at multiple scroll positions for visual diffing.

### Recipe 8: Error State Verification

```bash
runly test "open site.com/login and type wrong@x.com in email and type wrongpass in password and click sign in and verify error message is visible and verify url contains /login"
```

Verifies bad credentials produce expected error and don't navigate away.

### Recipe 9: Session Persistence Check

```bash
runly test "open site.com/login and type admin in user and type pass in password and click sign in and verify dashboard and reload and verify dashboard"
```

After login, reload should keep the user on the dashboard (session persisted).

### Recipe 10: Mobile Viewport Test

Currently runly always uses default viewport. To test mobile, generate a spec with `--save` and modify the launch options manually:

```bash
runly test "open site.com" --save
# Then edit output/specs/{file}.spec.js to add viewport:
# const context = await browser.newContext({ viewport: { width: 375, height: 667 } });
```

---

## 20. Troubleshooting Matrix

| Symptom | Likely cause | Diagnostic | Fix |
|---|---|---|---|
| `runly: command not found` | Not linked globally | `which runly` | Run `npm link` in runly directory |
| `Cannot find package 'playwright'` | Dependencies not installed | `ls node_modules/playwright` | Run `npm install` |
| `Chromium not found` | Browser binary missing | `runly doctor` | Run `npx playwright install chromium` |
| `Cannot write to ~/.runly/` | Permission issue | `ls -la ~/.runly` | Fix permissions or delete and retry |
| `API key invalid` | Bad or expired key | `runly auth` | Re-run `runly auth sk-ant-...` |
| Test starts but never completes | Step is waiting forever | Watch with `--headed` | Add `wait` step or check for blocking modal |
| Test "passes" but did wrong action | Selector matched wrong element | Read `--verbose` output | Use more specific descriptor |
| Random failures on CI but works locally | Page render timing | Run with `--headed` locally | Add `wait` steps or enable AI |
| Step 1 (goto) succeeds but step 2 fails immediately | Page not fully loaded | Add `wait 2` before step 2 | Or enable AI for smart waits |
| AI mode is slower than expected | Many fallback calls per run | Check `--verbose` for AI call count | Rewrite instruction to be more specific |
| Generated spec file has syntax errors | Generator bug | Open the file in an editor | File a bug report |
| Report JSON missing fields | Reporter bug or interrupted run | Check exit code | Re-run; if reproducible, file bug |
| Screenshot is blank | Page didn't render | Look at the failure point | Check if page hit an error before screenshot |
| Multiple tests overwrite each other's screenshots | Same timestamp collision | Run tests sequentially | Use timestamped screenshots (already default) |

---

## 21. Performance Tuning

### Speed Optimization

| Optimization | Impact | How |
|---|---|---|
| Use `--no-ai` for known-good tests | Eliminates 1-3 LLM calls per run | `--no-ai` flag |
| Avoid `wait` steps when possible | Each `wait 3` adds 3 seconds | Use AI mode for smart waits instead |
| Use specific selectors | Reduces selector engine fallback iterations | Be explicit in instructions |
| Run tests in parallel | Linear time → parallel time | Spawn multiple processes |
| Use headless mode | Headed adds 200-500ms per test | Default is headless (don't use `--headed` in CI) |

### Cost Optimization (AI Mode)

| Optimization | Impact | How |
|---|---|---|
| Use `--no-ai` for stable tests | Eliminates all LLM calls | `--no-ai` |
| Save specs and run them directly | Bypasses parser entirely | `--save`, then `node spec.js` |
| Be specific in instructions | Reduces healing calls | Avoid vague language |
| Use `wait` instead of relying on AI smart waits | 0 cost vs LLM call | Add explicit `wait` |
| Cache AI responses (manually) | Repeat runs cost nothing | Save spec files of known-good runs |

### Parser Performance

The regex parser is O(N) over tokens. A 50-token instruction parses in <1ms.
The bottleneck is always browser actions, not parsing.

### Memory

Each `runly test` process spawns one Chromium instance (~150MB RAM).
For parallel runs, budget 200MB per concurrent test.

---

## 22. Security & Secret Hygiene

### Credentials in Instructions

Runly does NOT have built-in variable substitution. Credentials in instructions
appear in:
- Terminal scrollback
- `~/.runly/last-run.json` (replay state)
- `output/reports/report-*.json` (full instruction recorded)
- Generated `.spec.js` files (with `--save`)

### Recommended Patterns

**Pattern 1: Environment variables in shell**
```bash
ADMIN_PASS="Pass@123"
runly test "open site.com and type admin in user and type ${ADMIN_PASS} in password and click sign in"
```
The shell interpolates the variable before runly sees it. The instruction in the report will still contain the literal value, but you avoid hardcoding it in scripts.

**Pattern 2: Use `--no-save` for sensitive runs**
Avoid `--save` for tests with credentials — generated spec files persist them on disk.

**Pattern 3: Clear last-run state after sensitive runs**
```bash
rm ~/.runly/last-run.json
```

**Pattern 4: Use ephemeral test accounts**
Create dedicated test accounts with no real data access. Use them for all automated tests.

### What Runly Does NOT Do

- Encrypt reports
- Mask passwords in logs
- Implement secret stores
- Provide variable substitution

If you need any of these, integrate runly with a secrets manager (Vault, AWS Secrets Manager, 1Password CLI) and inject credentials via environment variables.

### What Runly DOES Do

- Stores API key locally in `~/.runly/config.json` (not transmitted anywhere except to Anthropic API)
- Sends DOM snapshots to Anthropic API only when AI mode is enabled
- Does not phone home or send telemetry

---

## 23. Integration: CI / Pre-commit / npm scripts

### npm Script Integration

Add to your `package.json`:

```json
{
  "scripts": {
    "test:smoke": "runly test 'open localhost:3000 and verify Welcome'",
    "test:login": "runly test 'open localhost:3000/login and type admin in user and type pass in password and click sign in and verify dashboard'",
    "test:e2e": "npm run test:smoke && npm run test:login",
    "test:e2e:ci": "npm run test:e2e -- --no-ai"
  }
}
```

### Pre-commit Hook

`.git/hooks/pre-commit`:
```bash
#!/bin/bash
echo "Running smoke tests before commit..."
runly test "open localhost:3000 and verify homepage" --no-ai
if [ $? -ne 0 ]; then
  echo "Smoke test failed. Commit blocked."
  exit 1
fi
```

### GitHub Actions

`.github/workflows/runly.yml`:
```yaml
name: Runly E2E
on: [push, pull_request]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: cd runly && npm install && npm link && npx playwright install chromium
      - run: runly doctor
      - run: runly test "open https://${{ secrets.STAGING_URL }} and verify homepage" --no-ai
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: runly-failure-artifacts
          path: |
            runly/output/screenshots/
            runly/output/reports/
```

### Headless CI Best Practices

1. Always use `--no-ai` in CI unless you specifically need AI healing
2. Always upload `output/screenshots/` and `output/reports/` as artifacts on failure
3. Set a timeout on the `runly test` command (use `timeout 120 runly test ...`)
4. Run smoke tests before deeper E2E tests
5. Run impact-based tests on PRs, full suite on main

---

## 24. Quick Reference Card

### Daily Commands

```bash
# Health check
runly doctor

# Quick smoke test
runly test "open google.com"

# With debug output
runly test "..." --verbose

# Visible browser
runly test "..." --headed

# Export Playwright spec
runly test "..." --save

# Force regex mode
runly test "..." --no-ai

# Different browser
runly test "..." --browser firefox

# Replay last
runly replay last

# Configure AI
runly auth sk-ant-...

# Check AI status
runly auth
```

### Output Locations

```
output/screenshots/    # PNG captures (results + failures)
output/specs/          # Generated Playwright .spec.js files (--save)
output/reports/        # Full JSON reports per run
~/.runly/config.json   # API key + preferences
~/.runly/last-run.json # Replay state
```

### Action Verb Cheat Sheet

```
Navigation: open, goto, navigate, visit, back, forward, reload
Click:      click, tap, doubleclick, rightclick, hover
Type:       type, enter, fill, write (use "in" / "into" for target)
Form:       select, upload, clear, focus
Keyboard:   press <key>
Movement:   scroll <direction>, drag <X> to <Y>
Wait:       wait <seconds>
Verify:     verify, check, assert, ensure, confirm
Capture:    screenshot
Dialog:     accept, dismiss
```

### Assertion Cheat Sheet

```
verify X is visible          → visibility check
verify X is hidden           → absence check
verify X is disabled         → state check
verify X is checked          → checkbox state
verify url contains X        → URL substring
verify title is X            → page title
verify N items               → count
verify input has value X     → form field value
verify page contains X       → body text search
```

### Field Targeting Cheat Sheet

```
type VALUE in FIELD          → fills FIELD with VALUE
type VALUE into FIELD        → same
type VALUE                   → fills first visible input
select OPTION from DROPDOWN  → chooses OPTION in DROPDOWN
click X                      → clicks element matching X
click first X                → clicks first matching X
click 3rd X                  → clicks 3rd matching X
```

### Mental Model (One Sentence)

> Runly takes English, tokenizes it, matches keywords to actions, finds elements
> using 12 fallback strategies (with optional AI), executes against a real
> browser, and writes screenshots + reports to the `output/` folder.

### When to Use What

| Task | Use this |
|---|---|
| Quick check that a page loads | `runly test "open URL and verify HEADING"` |
| Verify a deploy didn't break login | `runly test "open URL/login and type ... and click ... and verify dashboard"` |
| Run the same tests on staging and prod | Two parallel `runly test` commands with different URLs |
| Generate Playwright code from English | `runly test "..." --save` |
| Debug a flaky flow | `runly test "..." --headed --verbose` |
| Save AI tokens on stable tests | `runly test "..." --no-ai` |
| Re-run the last test | `runly replay last` |
| Test impacted flows after a code change | Use the impact analysis pattern (Section 17) |
| Compare two test runs | Use the rerun comparison pattern (Section 15) |

### Key Limits

| Limit | Value | Override |
|---|---|---|
| Default click timeout | 10s | Modify `stepExecutor.js` |
| Default type timeout | 5s | Modify `stepExecutor.js` |
| Default navigation timeout | 30s | Modify `stepExecutor.js` |
| DOM snapshot max elements | 120 | Pass `{ maxElements: N }` to `captureDomSnapshot` |
| Selector engine fallback strategies | 12 | Hardcoded in `selectorEngine.js` |
| Shadow DOM piercing depth | 3 levels | Hardcoded in `domSnapshot.js` |
| Iframe traversal depth | 1 level | Hardcoded in `domSnapshot.js` |
| Wait keyword scaling | ≤30 → seconds, >30 → ms | `resolver.js → resolveDuration` |

### Self-Improvement Loop

After each session, ask yourself:
1. Did I write specific instructions or vague ones?
2. Did I use the right verbs (verify vs check vs assert)?
3. Did I split large flows into atomic sub-instructions?
4. Did I save reusable tests with `--save`?
5. Did I rate the run honestly (1-10) and act on low scores?
6. Did I check for regressions vs the last run?

If you can answer yes to all six, you're using runly the way it was designed.
