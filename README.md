# Runly

**Natural Language to Playwright Tests — Instantly.**

Runly is a CLI-first test automation tool that converts plain English into Playwright tests and runs them with smart optimizations. No UI, no setup, no boilerplate.

```bash
runly test "open google.com and search for playwright"
```

That's it. One command. Test runs.

---

## What Problem Does Runly Solve?

| Current Workflow |  
|---|---|
| Write Playwright boilerplate manually | Describe test in English |
| Open browser for codegen | Stay in terminal |
| Login every test run | Session auto-reused |
| New browser per test | Persistent browser |
| Run all tests blindly | Smart selection — run only what matters |
| Hard-coded waits | Intelligent wait detection |

---

## How It Works

### The Pipeline

```
English Command
     |
     v
  [Parser]         "open google and type hello"
     |                    |
     v                    v
  [Steps]           [ {action: "goto", value: "https://google.com"},
     |                {action: "type", value: "hello"} ]
     v
  [Generator]       Converts steps into Playwright API calls
     |
     v
  [Runner]          Executes in browser with optimizations
     |
     v
  [Result]          Pass/Fail + screenshot + timing
```

### Step-by-Step

1. **You type** a natural language command
2. **Parser** breaks it into tokens, maps keywords to actions (open → goto, click → click, type → fill, verify → assert)
3. **Resolver** figures out the details — adds `https://`, maps "login button" to `getByRole('button', {name: 'login'})`
4. **Generator** converts each step into real Playwright code
5. **Runner** executes it in a browser (headless by default)
6. **Reporter** shows you the result with timing and screenshots

---

## Architecture

```
runly/
  bin/
    runly.js                 # CLI entry point (commander)
  src/
    commands/
      test.js                # runly test "..."
      doctor.js              # runly doctor (health check)
      login.js               # runly login --save
      replay.js              # runly replay last
    parser/
      index.js               # Main parse() — English → Step[]
      tokenizer.js           # Sentence → clean tokens
      actionMap.js           # Keyword → action mapping rules
      resolver.js            # URL/selector/key resolution
    generator/
      index.js               # Step[] → Playwright code
      templates.js           # Action → code snippet mapping
    runner/
      index.js               # Orchestrator: parse → generate → execute
      browserPool.js         # Persistent browser (reuse across runs)
      sessionStore.js        # Auth state save/load
    reporter/
      index.js               # Terminal output formatting
    utils/
      logger.js              # Colored output (chalk + ora)
      config.js              # ~/.runly/ config management
```

### Core Modules

| Module | Responsibility |
|---|---|
| **Parser** | Converts English into structured `Step[]` array using keyword matching and regex rules |
| **Generator** | Transforms `Step[]` into executable Playwright code |
| **Runner** | Manages browser lifecycle, executes steps, handles errors |
| **Reporter** | Formats results for terminal — pass/fail, timing, screenshots |
| **BrowserPool** | Keeps browser alive across runs for speed |
| **SessionStore** | Saves and reuses login state so you don't re-authenticate every run |

---

## Approach

### Phase 0 — Foundation
> Get a working CLI that can navigate to a URL

- Node.js CLI with `commander`
- Playwright integration
- `runly test <url>` and `runly doctor`

### Phase 1 — NLP Parser
> Turn English into structured test steps

- Regex/keyword-based parser (no AI dependency)
- Supported actions: `open`, `click`, `type`, `press`, `wait`, `verify`
- Smart resolvers for URLs, selectors, and keyboard keys

```
Input:  "open google.com and type hello and press enter"
Output: [
  { action: "goto",  value: "https://google.com" },
  { action: "type",  value: "hello" },
  { action: "press", value: "Enter" }
]
```

### Phase 2 — Test Generator
> Convert steps into real Playwright code and execute

- Each action maps to a Playwright API call
- Run programmatically (not eval)
- `--save` flag exports a standalone `.spec.js` file

### Phase 3 — Speed Layer
> Make it fast — really fast

- **Persistent browser** — launch once, reuse via WebSocket
- **Session reuse** — save auth state, skip login on repeat runs
- **Smart waits** — replace `waitForTimeout(5000)` with network idle + DOM stability detection
- **Auto parallelization** — detect CPU cores, scale workers automatically

### Phase 4 — AI Layer (Optional)
> Add intelligence for complex commands

- LLM integration for better NLP parsing
- Auto-healing selectors (if selector fails, try alternatives)
- Intent memory (remember past successful test flows)

---

## Generated Test Files

Every time you run a test, Runly can save the generated Playwright code as a `.spec.js` file. You get a working, editable automation script — not a black box.

```bash
runly test "open google.com and search for playwright" --save
```

This generates:

```js
// Generated by Runly — google-search.spec.js
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Step 1: open google.com
  await page.goto('https://google.com');

  // Step 2: search for playwright
  await page.locator('input[name="q"]').fill('playwright');
  await page.keyboard.press('Enter');

  // Step 3: auto-screenshot
  await page.screenshot({ path: 'runly-result.png' });

  await browser.close();
})();
```

You can run this file standalone: `node google-search.spec.js`

The generated code is clean, commented, and reusable. Edit it, commit it, plug it into CI — it's yours.

---

## Under the Hood — How Each Module Works

This section walks through the internals so you understand exactly what Runly does at each stage.

### 1. Tokenizer — Breaking Down English

The tokenizer takes raw input and produces clean tokens.

```js
// Input
"open google.com and type 'hello world' then click search"

// Step 1: Lowercase
"open google.com and type 'hello world' then click search"

// Step 2: Remove filler words (and, then, the, a)
"open google.com type 'hello world' click search"

// Step 3: Preserve quoted strings, split on spaces
["open", "google.com", "type", "hello world", "click", "search"]
```

### 2. Action Mapper — Keywords to Actions

Each keyword maps to a Playwright action:

```js
const ACTION_RULES = [
  // Keyword          →  Playwright Action
  { patterns: /open|goto|visit|navigate/, action: 'goto'   },
  { patterns: /click|tap|press|hit/,      action: 'click'  },
  { patterns: /type|enter|fill|write/,    action: 'type'   },
  { patterns: /press/,                    action: 'press'  },  // keyboard key
  { patterns: /verify|check|assert|see/,  action: 'assert' },
  { patterns: /wait|pause/,              action: 'wait'   },
  { patterns: /screenshot|capture/,      action: 'screenshot' },
];
```

The parser walks left to right — when it hits a keyword, everything until the next keyword becomes the argument.

### 3. Resolver — Making Values Usable

Raw tokens need to become real Playwright values:

```js
// URL Resolution
"google"       → "https://google.com"
"google.com"   → "https://google.com"
"http://x.com" → "http://x.com"  // already valid, keep as-is

// Selector Resolution
"login button" → page.getByRole('button', { name: 'login' })
"search"       → page.getByText('search')
"#email"       → page.locator('#email')  // CSS selector, pass through

// Key Resolution
"enter" → "Enter"
"tab"   → "Tab"
"esc"   → "Escape"
```

### 4. Generator — Steps to Playwright Code

Each step becomes a Playwright API call:

```js
// Step: { action: "goto", value: "https://google.com" }
await page.goto('https://google.com');

// Step: { action: "click", selector: "getByRole('button', {name: 'login'})" }
await page.getByRole('button', { name: 'login' }).click();

// Step: { action: "type", value: "hello world" }
await page.locator('input:visible').first().fill('hello world');

// Step: { action: "assert", value: "dashboard" }
await expect(page.getByText('dashboard')).toBeVisible();

// Step: { action: "press", value: "Enter" }
await page.keyboard.press('Enter');
```

### 5. Runner — Execution with Optimizations

The runner doesn't `eval()` generated code. It walks the Step[] array directly:

```js
for (const step of steps) {
  switch (step.action) {
    case 'goto':
      await page.goto(step.value);
      break;
    case 'click':
      await page[step.selector].click();
      break;
    case 'type':
      await page.locator('input:visible').first().fill(step.value);
      break;
    case 'press':
      await page.keyboard.press(step.value);
      break;
    case 'assert':
      // verify text is visible on page
      const element = page.getByText(step.value);
      await element.waitFor({ state: 'visible', timeout: 5000 });
      break;
  }
}
```

This is safer than eval, easier to debug, and lets us add optimizations (smart waits, retries) per step.

### 6. Speed Optimizations — What Makes It Fast

```
Normal Playwright:                    Runly:
────────────────────                  ─────────────────
Launch browser     ~2s                Reuse browser     ~0s
New context        ~500ms             Reuse session     ~0s
Login flow         ~3s                Skip (cached)     ~0s
Hard waits         ~5s                Smart waits       ~1s
────────────────────                  ─────────────────
Total overhead:    ~10.5s             Total overhead:   ~1s
```

---

## Commands

```bash
runly test "open google and search playwright"   # Run a test from English
runly test "https://example.com"                 # Direct URL navigation
runly test --smart                               # Run only impacted tests
runly test --save                                # Export generated .spec.js
runly login --save                               # Save auth session for reuse
runly replay last                                # Re-run the last test
runly doctor                                     # Health check — Node, Playwright, browsers
```

---

## Tech Stack

| Tool | Purpose |
|---|---|
| **Node.js** | Runtime |
| **Commander** | CLI framework |
| **Playwright** | Browser automation engine |
| **Chalk** | Colored terminal output |
| **Ora** | Loading spinners |

---

## Design Decisions

1. **CLI-first, not UI** — Speed comes from staying in the terminal. No browser windows to click through for test generation.

2. **Regex parser before AI** — Start with deterministic keyword matching. It's fast, free, and predictable. AI layer is optional and additive.

3. **Playwright library, not test runner** — We use `playwright` (not `@playwright/test`) because Runly IS the test runner. We need programmatic browser control, not a test framework.

4. **ES Modules** — Modern Node.js. Required by latest versions of chalk and ora.

5. **Execute steps directly, don't eval generated code** — The generator produces code for export (`--save`). Actual execution walks the Step[] array and calls Playwright APIs directly. Safer and more controllable.

6. **Speed through elimination** — The fastest test is the one you don't run. Smart selection, session reuse, and persistent browsers eliminate unnecessary work.

---

## License

MIT
