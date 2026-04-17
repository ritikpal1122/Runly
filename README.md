# Runly

**Playwright tests in plain English. Lives in your repo. Runs anywhere.**

```bash
npm install -g runly
runly test "open google.com and search playwright"
```

That's it. No dashboard. No subscription. No signup.

---

## Why Runly

Every browser testing tool today falls into two camps:

**Camp 1 — Raw Playwright/Cypress**
You write 20 lines of boilerplate for every test. Selectors break on every deploy. Debugging is an ordeal.

**Camp 2 — Enterprise SaaS**
$500/month minimum. Tests live in their cloud dashboard, not your repo. You can't grep them, diff them, or review them in a PR.

**Runly is camp 3 — Tests-as-code in plain English.**

| Feature | Raw Playwright | Enterprise SaaS | Runly |
|---|---|---|---|
| Tests in your repo | ✓ | ✗ | ✓ |
| Plain English | ✗ | ✓ | ✓ |
| Self-healing with AI | ✗ | ✓ | ✓ |
| Free & open source | ✓ | ✗ | ✓ |
| Runs in CI | ✓ | ✓ | ✓ |
| Works offline | ✓ | ✗ | ✓ |
| Git-diffable | ✓ | ✗ | ✓ |
| Pipe to jq | ✗ | ✗ | ✓ |
| Zero setup | ✗ | ✗ | ✓ |

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

### Option 1: One-off test

```bash
runly test "open google.com and search playwright"
```

### Option 2: Test files in your repo

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

### Option 3: In GitHub Actions

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

### Option 4: Pipe to jq / scripts

```bash
# NDJSON output for scripting
runly run tests/ --json | jq '.results[] | select(.success == false)'
```

---

## The `.runly` Format

A `.runly` file is plain text. One instruction per line. Metadata lines start with `@`. Comments start with `#`.

```
# Tests the entire signup flow
@name: Signup flow works
@description: User can create an account and reach dashboard
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

---

@name: Link navigates correctly
open example.com
click Learn more
verify url contains iana
```

### Variables

Use `{{variable}}` syntax. Values come from:

1. `--vars '{"key":"value"}'` inline
2. `--vars-file path/to/vars.json`
3. `~/.runly/vars/*.json` global defaults
4. Environment variables (future)

---

## Features

### Core

- **English parser** — converts natural language into atomic test steps
- **12-strategy selector engine** — finds elements by testid, role, text, label, placeholder, alt, title, and more
- **Session reuse** — auto-saves login state per domain (skip login on next run)
- **Persistent browser pool** — 10x faster than launching fresh (`~50ms` reconnect vs `~2s` launch)
- **Variable substitution** — `{{site}}`, `{{user}}` for parameterized tests
- **Tag filtering** — `--tag critical` runs only what matters
- **Parallel execution** — `--parallel 4` runs tests simultaneously
- **Retry on flake** — `--retry 3` auto-retries failures

### AI Mode (optional)

When you set `ANTHROPIC_API_KEY`, Runly becomes agentic:

- **Smart parsing** — complex English ("complete the checkout flow") decomposed into steps
- **DOM-aware element finding** — Claude reads the page and finds the right selector when the regex fallback fails
- **Self-healing** — when a step fails, Claude diagnoses and retries with an alternative selector
- **Learning cache** — successful heals are cached so future runs are free and fast

AI mode is **completely optional**. Runly works great without it.

### Output

- **Terminal** — colored step-by-step results with a summary badge
- **JSON** — full report at `output/reports/report-{timestamp}.json`
- **Screenshots** — `output/screenshots/result-...png` and `output/screenshots/failure-...png`
- **Generated Playwright specs** — `runly test "..." --save` exports standalone `.spec.js` files
- **HTML dashboard** — `runly report` generates a pretty HTML view of all past runs
- **NDJSON** — `--json` flag for piping into jq, shell scripts, or CI systems

### Commands

```bash
runly run <path>         # Run .runly test files
runly test "..."         # One-off test from English
runly watch "..."        # Re-run at intervals
runly inspect <url>      # Find elements on a page
runly diff A.json B.json # Compare two runs
runly report             # HTML dashboard
runly record [url]       # Record user actions into an instruction
runly replay last        # Re-run last test
runly sessions           # Manage saved auth sessions
runly doctor             # Health check
runly auth sk-ant-...    # Enable AI mode
runly serve              # HTTP API server
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

**Runly takes Camp 1's ownership and adds Camp 2's ergonomics.**

---

## Prior Art & Inspiration

| Tool | What it taught me |
|---|---|
| Playwright | The execution engine underneath |
| Cypress | Developer experience matters |
| AI-native test SaaS | Natural language parsing is possible |
| Vitest | Tests as code, fast feedback |
| vercel/commander | Clean CLI patterns |

---

## FAQ

**Is this production-ready?**
Yes for small/medium projects. For enterprise use (SOC 2, on-prem, SSO), you'll want one of the cloud test platforms.

**Does it work with React/Vue/Angular?**
Yes. Runly uses Playwright under the hood, which handles all modern frameworks.

**Do I need an Anthropic API key?**
No. The regex parser handles most common cases. AI mode is optional and only improves complex flows and self-healing.

**How does it compare to Playwright codegen?**
Playwright codegen needs a GUI and produces verbose code. Runly is text-first and produces plain English `.runly` files that humans can read and edit.

**Can I export to Playwright code?**
Yes: `runly test "..." --save` writes a standalone `.spec.js` file.

**What about mobile?**
Not yet. Currently chromium/firefox/webkit on desktop. Mobile via Appium is planned.

**Does it support visual regression?**
Yes: `runly test "..." --baseline` saves a baseline, `--diff` compares against it.

---

## Contributing

Runly is MIT-licensed and open to contributions. The codebase is small (~4000 LOC) and well-organized:

```
src/
  parser/       # Regex parser + tokenizer
  ai/           # Claude integration
  runner/       # Browser execution
  commands/     # CLI commands
  utils/        # Logger, config, paths
```

See `skills/runly.md` for a complete architectural reference.

---

## License

MIT
