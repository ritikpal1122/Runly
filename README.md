# Runly

**Plain-English browser tests for AI agents. MCP-native. Lives in your repo.**

```bash
npm install -g runly
runly test "open google.com and search playwright"
```

No dashboard. No subscription. No signup.

---

## What's new in v0.3

- **MCP server** — Claude Code, Cursor, and Windsurf can drive browsers directly through Runly
- **`runly import`** — convert any Playwright `.spec.ts` / `.spec.js` to plain English
- **`@use` modules** — reusable test flows with variable overrides
- **`verify ai: …`** — LLM-backed semantic assertions
- **`{{faker.*}}`** — synthetic test data without fixtures

---

## Why Runly

Every browser testing tool today falls into two camps:

**Camp 1 — Raw Playwright/Cypress**
You write 20 lines of boilerplate for every test. Selectors break on every deploy. Debugging is an ordeal.

**Camp 2 — Enterprise SaaS**
$500/month minimum. Tests live in their cloud dashboard, not your repo. You can't grep them, diff them, or review them in a PR.

**Runly is camp 3 — Tests-as-code in plain English, driven by your AI.**

| Feature | Raw Playwright | Enterprise SaaS | Runly |
|---|---|---|---|
| Tests in your repo | ✓ | ✗ | ✓ |
| Plain English | ✗ | ✓ | ✓ |
| Self-healing with AI | ✗ | ✓ | ✓ |
| Semantic AI assertions | ✗ | ✓ | ✓ |
| Reusable modules | ✓ | ✓ | ✓ |
| **Callable from Claude Code / Cursor (MCP)** | ✗ | ✗ | ✓ |
| **Imports existing Playwright tests** | — | ✗ | ✓ |
| Free & open source | ✓ | ✗ | ✓ |
| Works offline | ✓ | ✗ | ✓ |
| Git-diffable | ✓ | ✗ | ✓ |
| Pipe to jq | ✗ | ✗ | ✓ |

---

## Use with Claude Code, Cursor, Windsurf (MCP)

Runly ships as a Model Context Protocol server. Add it once to your agent's config and your IDE can run browser tests on demand.

**`~/.claude.json`:**
```json
{
  "mcpServers": {
    "runly": { "command": "runly", "args": ["mcp"] }
  }
}
```

Then in Claude Code:

> *"Use runly_open_url to smoke-test https://staging.myapp.dev."*

Claude calls Runly, the browser opens, the result streams back as a tool response.

### Six tools exposed over MCP

| Tool | Does |
|---|---|
| `runly_test` | Run one English instruction (`"open x.com and verify login visible"`) |
| `runly_run_file` | Run a `.runly` file or directory, with tag/grep filters |
| `runly_list_tests` | Discover `.runly` files under a path without running them |
| `runly_inspect` | Find DOM elements on a page by English description |
| `runly_open_url` | Quick URL health check (status + title + duration) |
| `runly_last_run` | Fetch the most recent run's metadata |

---

## Migrate from Playwright in 60 seconds

Already have a `.spec.ts` suite? Convert it:

```bash
runly import tests/e2e/
```

Runly rewrites each `page.goto`, `page.click`, `page.fill`, `expect.toBeVisible` (and friends) into plain English `.runly` lines. `describe` / `test` nesting is preserved as tags. Lines it can't translate are flagged `# TODO (unconverted)` — nothing drops silently.

Example round-trip — this `.spec.ts`:

```ts
test('standard user logs in', async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.getByPlaceholder('Username').fill('standard_user');
  await page.getByPlaceholder('Password').fill('secret_sauce');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/inventory/);
});
```

…becomes this `.runly`:

```
@name: standard user logs in

open https://www.saucedemo.com/
type standard_user in Username
type secret_sauce in Password
click Login button
verify url contains inventory
```

---

## 30-Second Demo

**1. Write a test in plain English** — save as `tests/login.runly`:

```
@name: Login flow works
@tags: critical, auth

open {{site}}/login
type {{user}} in username
type {{pass}} in password
click sign in button
verify dashboard is visible
```

**2. Run it:**

```bash
runly run tests/ --vars '{"site":"https://app.acme.dev","user":"admin","pass":"secret"}'
```

**3. See results:**

```
  ──────────────────────────────────────────────────────────
  Suite Results   1 passed, 0 failed, 3829ms total
  ──────────────────────────────────────────────────────────

   1. ✓ Login flow works                     3829ms [critical,auth]

   ALL PASSED    1/1 tests
```

**4. Commit the test file to your repo.** Review it in PR diffs. Grep it. Diff it. Like any other code.

---

## Installation

```bash
npm install -g runly
npx playwright install chromium
runly doctor                     # verify setup
```

That's the full install. No accounts. No config files. No cloud services.

---

## Quick Start

### One-off test
```bash
runly test "open google.com and search playwright"
```

### Test files in your repo
```
my-app/
├── src/
└── tests/
    ├── login.runly
    ├── checkout.runly
    └── smoke.runly
```

```bash
runly run tests/                         # all tests
runly run tests/ --tag critical          # filter by tag
runly run tests/ --parallel 4            # run 4 at a time
runly run tests/login.runly              # single file
runly run tests/ --grep "login|auth"     # filter by content
```

### Interactive REPL
```bash
runly              # drops into a shell with history, tab-completion,
                   # and a persistent browser pool for instant reruns
```

### In GitHub Actions
```yaml
# .github/workflows/test.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ritikpal1122/Runly@v1
        with:
          tests: tests/
```

### Pipe to jq / scripts
```bash
# NDJSON output for scripting
runly run tests/ --json | jq '.results[] | select(.success == false)'
```

---

## The `.runly` Format

Plain text. One instruction per line. Metadata lines start with `@`. Comments start with `#`.

```
# Tests the entire signup flow
@name: Signup flow works
@tags: auth, critical, signup
@timeout: 30
@retry: 2

open {{site_url}}/signup
type {{email}} in email field
type {{password}} in password field
click create account button
verify welcome message is visible
verify url contains /dashboard
```

### Multiple tests in one file

Separate with `---`:

```
@name: Homepage loads
open example.com
verify Example Domain

---

@name: Title is correct
open example.com
verify title contains Example
```

### Reusable modules (`@use`)

Keep shared flows DRY. `login.runly`:

```
@name: Login module

open {{site}}/login
type {{user}} in username field
type {{pass}} in password field
click sign in button
```

`checkout.runly`:

```
@name: Checkout
@tags: critical, e2e

@use login.runly with user=admin pass=secret site=https://staging.app

click add to cart for the premium plan
click checkout button
verify order confirmation is visible
```

`@use` inlines the module's steps with your variable overrides, and detects cycles if two modules reference each other.

### AI assertions (`verify ai: …`)

When exact text matching is too brittle, ask the LLM to make the call:

```
open https://shop.example/cart

verify ai: the cart total equals the sum of all item prices plus tax
verify ai: a promo banner with this month's discount is visible
verify ai: no error messages are shown anywhere on the page
```

On each `verify ai:` step, Runly snapshots the DOM, asks Claude for a strict pass/fail verdict with reasoning, and logs the evidence.

### Synthetic data (Faker)

Any `{{faker.*}}` expression resolves at interpolation time:

```
type {{faker.person.firstName}} in first name
type {{faker.internet.email}} in email
type {{faker.location.zipCode}} in zip
type {{faker.phone.number}} in phone
```

### Variables

Use `{{variable}}` syntax. Values come from:

1. `--vars '{"key":"value"}'` inline
2. `--vars-file path/to/vars.json`
3. `~/.runly/vars/*.json` global defaults
4. `{{faker.*}}` synthetic values
5. `@use` inline `with` overrides

---

## Features

### Core
- **English parser** — converts natural language into atomic test steps
- **12-strategy selector engine** — finds elements by testid, role, text, label, placeholder, alt, title, and more
- **Session reuse** — auto-saves login state per domain (skip login on next run)
- **Persistent browser pool** — 10× faster than launching fresh (~50 ms reconnect vs ~2 s launch)
- **Variable substitution** — `{{site}}`, `{{faker.*}}`, and `@use` `with` overrides
- **Tag filtering** — `--tag critical` runs only what matters
- **Parallel execution** — `--parallel 4` runs tests simultaneously
- **Retry on flake** — `--retry 3` auto-retries failures

### AI mode (optional)
When `ANTHROPIC_API_KEY` is set, Runly becomes agentic:

- **Smart parsing** — complex English decomposed into atomic steps
- **DOM-aware element finding** — Claude picks the right selector when the regex fallback can't
- **Self-healing** — on step failure, Claude diagnoses and retries with an alternative
- **Semantic assertions** — `verify ai: …` routes to Claude with a DOM snapshot
- **Learning cache** — successful heals are cached so future runs are free and fast

AI mode is **completely optional**. Runly works great without it.

### MCP server
- **stdio transport** — one-line config in Claude Code / Cursor / any MCP client
- **Six tools** — test, run_file, list_tests, inspect, open_url, last_run
- **Zero state** — same local browser + reports as the CLI

### Output
- **Terminal** — colored step-by-step results with a summary badge
- **JSON** — full report at `output/reports/report-{timestamp}.json`
- **Screenshots** — `output/screenshots/result-*.png` and `failure-*.png`
- **Auto-generated Playwright specs** — every `runly test` / `runly run` emits standalone `.spec.js` next to the report
- **HTML dashboard** — `runly report` generates a pretty view of all past runs
- **NDJSON** — `--json` flag for piping into jq, shell scripts, or CI systems

### Commands
```bash
runly                     # Interactive REPL
runly run <path>          # Run .runly test files
runly test "..."          # One-off test from English
runly import <spec.ts>    # Convert Playwright specs to .runly
runly mcp                 # Start MCP server (for Claude Code etc.)
runly watch "..."         # Re-run at intervals
runly inspect <url>       # Find elements on a page
runly diff A.json B.json  # Compare two runs
runly report              # HTML dashboard
runly record [url]        # Record user actions into an instruction
runly replay last         # Re-run last test
runly sessions            # Manage saved auth sessions
runly doctor              # Health check
runly auth sk-ant-...     # Enable AI mode
runly serve               # HTTP API server
```

---

## Philosophy

**Tests should live in your repo, not someone else's dashboard.**

When tests are in your repo:
- You can git-diff them
- You can review them in PRs
- You can grep them
- You can refactor them like any other code
- You can version them alongside the code they test
- You own them forever

When tests are in a SaaS dashboard:
- They disappear when your subscription lapses
- You can't diff them across branches
- You can't review them in PRs
- You're locked in
- You pay per seat

**Runly takes Camp 1's ownership and adds Camp 2's ergonomics — and makes the result addressable by your AI agent.**

---

## FAQ

**Is this production-ready?**
Yes for small/medium projects. For enterprise needs (SOC 2, on-prem, SSO), you'll want a cloud test platform.

**Does it work with React/Vue/Angular?**
Yes. Runly uses Playwright under the hood — any SPA framework works.

**Do I need an Anthropic API key?**
No for core usage. The regex parser handles most common patterns. AI mode is optional and only improves complex flows, self-healing, and `verify ai:` assertions.

**How does it compare to Playwright codegen?**
Playwright codegen needs a GUI and produces verbose code. Runly is text-first and produces plain-English `.runly` files that humans read and edit. Runly also imports Playwright tests in the other direction via `runly import`.

**Can I export back to Playwright code?**
Yes. Every `runly test` / `runly run` auto-emits a standalone `.spec.js` in `output/specs/`. Opt out with `--no-spec`.

**What about mobile?**
Not yet. Currently Chromium / Firefox / WebKit on desktop. Mobile via Appium is planned.

**Does it support visual regression?**
Yes — `runly test "..." --baseline` saves a baseline, `--diff` compares against it.

**Does it work from Cursor / Windsurf?**
Yes. Both support MCP. Same `runly mcp` config.

---

## Contributing

Runly is MIT-licensed. The codebase is ~7000 LOC and organized by concern:

```
src/
  parser/       # Regex tokenizer + action map
  importer/     # Playwright → .runly converter
  ai/           # Claude client, prompts, healer, assertions
  runner/       # Playwright execution + session store + browser pool
  mcp/          # MCP stdio server + tool handlers
  commands/     # CLI commands
  utils/        # Logger, config, paths
```

See `skills/runly.md` for a complete architectural reference.

---

## License

MIT
