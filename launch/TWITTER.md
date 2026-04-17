# Twitter / X Launch Thread

## Instructions

1. Record a 15-second GIF of `runly run tests/examples/` first — pin this to tweet 1
2. Post on **Tuesday or Wednesday 10am PT** (aligned with HN post)
3. Quote-tweet the HN submission as the last tweet in the thread
4. Tag @playwright and any dev-tool influencers you follow
5. Use hashtags: `#opensource #devtools #testing #playwright`

---

## Thread (8 tweets)

### Tweet 1 (main hook)

```
I built a CLI that turns English into Playwright tests 🧪

$ runly test "open google.com and search playwright"

And it works. Here's the 15-second demo 👇

[DROP 15-SECOND GIF HERE]

Open source, MIT licensed, runs on your laptop.
```

### Tweet 2 (the problem)

```
Why?

Every browser testing tool today is one of two extremes:

🔴 Raw Playwright → 20 lines of boilerplate per test
🔴 Enterprise SaaS → $500/month, tests locked in dashboards

I wanted a third option: tests as plain English in my repo.
```

### Tweet 3 (tests-as-code pitch)

```
The killer feature isn't the CLI — it's the file format.

# tests/login.runly
@name: Login works
@tags: critical

open {{site}}/login
type {{user}} in username
type {{pass}} in password
click sign in button
verify dashboard is visible

Commit this. Review in PRs. Git-diff it. Like any other code.
```

### Tweet 4 (how it works)

```
Under the hood, a regex parser converts English → atomic steps:

"open X and type Y in Z" →
[
  { action: "goto", url: X },
  { action: "type", value: Y, target: Z }
]

Then a 12-strategy selector engine finds elements by testid, ARIA role,
text, placeholder, label, and more.

No AI needed for the common case.
```

### Tweet 5 (AI fallback)

```
For complex cases, Claude takes over (optional):

- "complete the checkout flow" → AI decomposes into steps
- Element not found → Claude reads the DOM and picks the right selector
- Step fails → Claude diagnoses and retries

AI mode is OFF by default. Bring your own API key if you want it.
```

### Tweet 6 (CI integration)

```
30-second CI integration:

# .github/workflows/test.yml
- uses: runly/action@v1
  with:
    tests: tests/

Runs all your .runly files on every PR. Auto-uploads screenshots
on failure. No cloud service, no signup.
```

### Tweet 7 (why now)

```
Every SaaS testing tool wants you to put your tests in their dashboard.

That's fine when you can afford $500/month.

But for solo devs, indie hackers, and small teams? Tests should live
in your repo. You should own them. You should be able to grep them,
diff them, and delete them whenever.

That's Runly's whole thesis.
```

### Tweet 8 (call to action)

```
Try it in 30 seconds:

$ npm install -g runly
$ runly run tests/examples/

GitHub: https://github.com/runly/runly
HN: [LINK TO HN POST]

RT if this scratches an itch. Happy to answer anything in replies 🙏
```

---

## Quote Tweet / Reply Template

For Playwright/Microsoft accounts:
```
@playwright Shoutout — Runly is built entirely on top of Playwright.
None of this would exist without your work. Thank you 🙏
```

For dev-tool influencers who retweet:
```
Thanks for the boost @username — means a lot from someone whose work
I've been using for years.
```

---

## What NOT to Tweet

- Don't say "revolutionary"
- Don't say "AI-first" (it's not — regex is first)
- Don't bash competitors by name in positive tweets
- Don't promise features that don't exist yet
- Don't claim numbers you can't back up ("10x faster" is fine if you have benchmarks)
