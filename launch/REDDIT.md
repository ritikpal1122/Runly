# Reddit Launch Posts

## Instructions

- Post to **one subreddit per day** (spacing matters, avoid spam flags)
- Use a slightly different angle in each post
- Flair correctly (most subs require it)
- Respond to every comment in the first 2 hours
- Never say "please upvote"
- Do NOT crosspost — write unique content per sub

---

## r/webdev (1.5M members)

**Title:** `I built a CLI that writes Playwright tests from plain English`

**Flair:** Showoff Saturday (save for Saturday) or Discussion

**Body:**
```
After writing the same Playwright boilerplate for the 100th time,
I built Runly — a CLI that converts English into browser tests.

Example:

    $ runly test "open google.com and search for playwright"

It breaks the instruction into atomic steps using a regex parser,
then runs them against a real Chromium browser. Optional AI mode
uses Claude to handle vague commands and self-heal broken selectors.

The real differentiator is the .runly file format — tests live in
your repo as plain-text files that git can diff and GitHub can
review in PRs. No dashboard, no subscription, no cloud service.

Features:
- 12-strategy selector engine (testid → aria → role → text → CSS)
- Persistent browser pool (10x faster reruns)
- Session reuse (skip login on repeat runs)
- Export to standalone Playwright .spec.js files
- GitHub Action for 30-second CI setup
- JSON/NDJSON output for piping to jq

Free, MIT licensed, works offline. Feedback welcome.

Repo: https://github.com/runly/runly
```

---

## r/javascript (2.5M members)

**Title:** `Runly: Natural language → Playwright tests, written in plain JS`

**Flair:** Showcase

**Body:**
```
Runly is a Node.js CLI I built for one specific problem: I wanted to
write browser smoke tests in English instead of 20 lines of Playwright
boilerplate every time.

The architecture is pure JS/ESM:

- bin/runly.js → commander-based CLI entry
- src/parser → tokenizer + action map + regex resolver
- src/runner → Playwright wrapper with 12-strategy selector engine
- src/ai → optional Claude integration (prompt-engineered XML templates)
- src/generator → exports .spec.js files for hand-editing

Total codebase is ~4000 LOC, zero build step, runs directly from source.
Only 6 dependencies (playwright, commander, chalk, ora, fs-extra,
@anthropic-ai/sdk).

Try it:
    npm install -g runly
    runly test "open google.com and search playwright"

Or write tests as files:
    # tests/login.runly
    @name: Login works
    open {{site}}/login
    type {{user}} in username
    click sign in button
    verify dashboard

Source: https://github.com/runly/runly

Curious what other JS devs think of the tokenizer/parser approach —
happy to dive into implementation details in the comments.
```

---

## r/node (300K members)

**Title:** `Built a CLI browser automation tool in Node — tests-as-code + natural language`

**Flair:** Tool

**Body:**
```
Runly is a Node CLI I built over the past few weeks to scratch my own
itch: writing quick browser smoke tests without the Playwright boilerplate.

It's a thin layer above playwright that does three things:

1. Parses English into Step[] (regex + keyword matching)
2. Runs steps with a 12-strategy fallback selector engine
3. Optionally uses Claude for self-healing when selectors break

The more interesting piece is the .runly file format — tests are plain
text files you commit to your repo:

    # tests/smoke.runly
    @name: Homepage works
    @tags: critical

    open example.com
    verify Example Domain

Then:
    runly run tests/ --tag critical --parallel 4

And in CI (GitHub Action):
    - uses: runly/action@v1
      with: { tests: tests/ }

Architecture notes:
- ESM only (import/export, "type": "module")
- Zero build step
- 6 runtime deps
- Uses commander + chalk + ora for the CLI shell
- Optional Anthropic SDK for AI mode

Source + docs: https://github.com/runly/runly
```

---

## r/QualityAssurance (80K members)

**Title:** `Free open-source alternative to cloud test platforms for devs who test their own code`

**Flair:** Automation

**Body:**
```
Fair warning: this is a dev-first tool, not an enterprise QA platform.
If you need visual test recorders, cloud dashboards, SSO, or SOC 2
compliance, Runly isn't for you — stick with the enterprise SaaS options.

But if you're a QA engineer or developer at a small team who:
- Can't afford $500/month per seat
- Wants tests in your repo, not a dashboard
- Prefers CLI + Git workflows over web UIs

...then Runly might fit.

It's a CLI that converts English into Playwright tests:

    $ runly test "open site.com/login and type admin in username"

And supports .runly test files that live in your repo:

    # tests/login.runly
    @name: Login flow
    @tags: critical, smoke
    open {{url}}/login
    type {{user}} in username
    type {{pass}} in password
    click sign in button
    verify dashboard

Features:
- Selector engine with 12 fallback strategies
- Optional AI self-healing (Claude) for flaky selectors
- Visual regression (--baseline / --diff)
- Retry on flake (--retry 3)
- Tag filtering and parallel execution
- Exports to standalone Playwright .spec.js for hand-editing
- GitHub Action for CI

Free, MIT licensed. Feedback welcome — especially from folks who've
tried the enterprise tools and know what they're missing.

https://github.com/runly/runly
```

---

## r/selenium (50K members)

**Title:** `Runly: Migrate from Selenium to plain English tests`

**Body:**
```
If you're maintaining Selenium test suites that break every sprint,
check out Runly — a CLI that converts English into Playwright tests.

Selenium:
    WebElement loginBtn = driver.findElement(By.cssSelector("button.login-btn"));
    loginBtn.click();
    WebElement userField = driver.findElement(By.name("username"));
    userField.sendKeys("admin");
    // ... 15 more lines

Runly:
    runly test "click login button and type admin in username"

Or as a .runly test file committed to your repo:
    open {{site}}
    click login button
    type admin in username
    verify dashboard is visible

The underlying engine is Playwright (faster, more reliable than
Selenium), but you write tests at a much higher abstraction level.

Open source, MIT licensed, works offline. Optional Claude self-healing
for flaky flows.

Repo: https://github.com/runly/runly
```

---

## r/opensource (300K members)

**Title:** `Show: Runly — open-source CLI for natural language browser testing`

**Body:**
```
Releasing Runly today — a CLI I built to avoid writing Playwright
boilerplate for every smoke test.

MIT licensed, 4K LOC, ~6 runtime dependencies, zero build step.
Works entirely offline (optional Claude AI mode for complex cases,
BYO API key).

The interesting design decision: tests live in your repo as .runly
files, not in a SaaS dashboard. This keeps tests git-diffable,
PR-reviewable, and gives users full ownership.

    # tests/login.runly
    @name: Login works
    @tags: critical
    open {{site}}/login
    type {{user}} in username
    type {{pass}} in password
    click sign in button
    verify dashboard

Runly takes the ergonomics of modern AI-powered test tools
but keeps the ownership model of tests-as-code.

Commands:
    runly run tests/            # run all tests in a directory
    runly test "..."            # one-off test from English
    runly inspect <url> "btn"   # find elements on a page
    runly record                # record interactions as English
    runly serve                 # HTTP API mode
    runly report                # HTML dashboard from past runs

Source: https://github.com/runly/runly
```
