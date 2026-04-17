# Hacker News — Show HN Post

## Instructions

1. Post on a **Tuesday or Wednesday** between **9:00–10:30 AM PT** (highest traffic window)
2. Do NOT edit the post in the first 2 hours (HN penalizes edited posts)
3. Respond to **every** comment within the first 4 hours
4. Do NOT be defensive about criticism — thank people for feedback
5. Expect 40% negative comments. Normal. Don't take it personally.

---

## Title (pick one — test which sounds best to you)

**Option A (recommended — clear positioning):**
```
Show HN: Runly – Playwright tests in plain English, in a CLI
```

**Option B (more intrigue):**
```
Show HN: I built a CLI that writes browser tests from English
```

**Option C (anti-enterprise angle):**
```
Show HN: Runly – An open-source CLI alternative to cloud test SaaS
```

---

## Body

```
Hi HN,

I built Runly because I was tired of writing the same 20 lines of
Playwright boilerplate for every quick smoke test. The enterprise
enterprise alternatives start at $500/month
and lock your tests in their dashboards, not your repo.

Runly is a CLI that converts English into Playwright actions:

    $ runly test "open google.com and search playwright"

It also supports tests-as-code via .runly files that live in your repo:

    # tests/login.runly
    @name: Login works
    @tags: critical

    open {{site}}/login
    type {{user}} in username
    type {{pass}} in password
    click sign in button
    verify dashboard is visible

Then in CI:

    - uses: runly/action@v1
      with:
        tests: tests/

Key design decisions:

- Regex parser first (works offline, $0 cost, deterministic)
- Claude as optional fallback for complex flows and self-healing
- Persistent browser pool (first run ~2s, subsequent runs ~50ms)
- Session reuse (save login state, skip login on repeat runs)
- 12-strategy selector engine (testid → aria → role → text → CSS)
- JSON/NDJSON output mode for piping into jq/CI
- Exports standalone Playwright .spec.js files with --save

What it is NOT:

- Not an enterprise SaaS. No dashboard, no team features, no cloud runner.
- Not a mobile testing tool (yet). Web browsers only.
- Not a replacement for deep Playwright knowledge. If you need fine
  control, export to .spec.js and edit directly.

It's MIT licensed and runs entirely on your laptop. Optional AI mode
uses your own Anthropic API key — no telemetry, no phoning home.

The core insight: enterprise test tools win on ergonomics by hiding
tests in dashboards. I wanted those ergonomics without losing
tests-as-code. The .runly file format is the compromise — plain English
that git can diff, GitHub can review in PRs, and you can refactor
like any other source file.

Happy to answer questions about the parser, the AI prompts (all 6 are
open source in src/ai/prompts.js), or how the self-healing loop works.

Repo: https://github.com/runly/runly
Docs: https://github.com/runly/runly#readme
Demo (30 sec): [ASCIINEMA LINK HERE]
```

---

## Preparing Comments (rehearse before posting)

These will come up. Have a calm answer ready.

### "Why not just use Playwright?"

> Runly uses Playwright as the execution engine. The difference is the
> authoring layer. If you're comfortable writing Playwright code directly,
> this isn't for you. Runly is for quick smoke tests, non-Playwright
> experts, and teams who want tests as English so they can review them
> in PRs without Playwright knowledge.

### "This is just a thin wrapper."

> Honestly, yes, at the core layer. The parser, selector engine, and
> self-healing loop are all above Playwright. The value isn't
> reinventing browser automation — it's the English → Step[] translation
> and the tests-as-code positioning. The AI prompt engineering and
> the .runly file format are where the interesting work is.

### "How is this different from Playwright codegen?"

> Codegen needs a GUI and produces verbose code. Runly is text-first,
> runs headless in CI, and the output is plain English that non-experts
> can review. Codegen is great for generating a first draft —
> Runly is for writing the actual test.

### "Why would I trust AI for tests?"

> You don't have to. The regex parser handles ~80% of cases and is
> entirely deterministic. AI mode is optional and only engages when:
> (a) the instruction is too vague for regex, or (b) a selector fails
> at runtime. When it heals a selector, it caches the result so future
> runs don't need AI.

### "How does this compare to the AI-native test platforms?"

> Different category. Those are enterprise SaaS platforms — they sell
> to non-technical QA teams with dashboards, cloud runners, SOC 2,
> teams, billing, etc. Runly is a CLI for developers. It will never
> have those enterprise features because that's not the target user.
> Runly's advantages: runs locally, free, tests in your repo, no
> signup. Their advantages: polish, visual recorder, cloud infra.

### "Can I use this commercially?"

> Yes — MIT license. Use it in any project, personal or commercial.

### "Will you accept contributions?"

> Yes. See CONTRIBUTING.md. Particularly interested in browser extension
> for recording, unit tests for the parser, and mobile support via Appium.

### "Are you building a paid version?"

> Not planning to. If enough people want it, I might build a simple
> hosted dashboard for shared test history ($10/mo). But the CLI will
> always be free and open source.

### "How much does AI mode cost?"

> Free if you don't enable it. If you do, you bring your own Anthropic
> API key. A typical 5-step test with clean parsing and no failures
> makes 0 API calls. A complex test with 1 self-heal makes ~3 calls
> (~$0.01 with Sonnet 4).

### Negative comments — respond to these gracefully

If someone says "this is a side project at best" or "yet another test
tool", just thank them for the feedback and move on. Don't argue.
The people who matter will upvote past the negativity.
```
