# Loom recording script — Runly v0.3

**Goal:** 90-second demo that lands with engineers at Browserbase / Anthropic / Cursor / Cognition / Momentic-tier companies.

**Tools needed:** Loom (loom.com, free), QuickTime, or OBS. Full-screen browser + terminal side-by-side. Good mic (laptop mic OK if quiet room).

**Resolution:** 1920×1080 or 1440×900. No webcam bubble (focus on the product).

---

## The script (read this word-for-word)

> "Hey — I'm Ritik. I built **Runly**, an open-source CLI that lets AI agents drive browsers using plain English — and I want to show you three things in the next 90 seconds."

*(pause 1 sec)*

> "First — the basics. Here's a test file." **[cut to `tests/examples/swag-labs/standard-user-purchases.runly` open in the editor]** "It's plain text. No YAML. No UUIDs. Humans read this. Git diffs this cleanly. `@use` pulls in a reusable login module. `verify ai:` lets me check things semantically — like *'the total equals the sum of items plus tax'* — instead of matching exact text. Two lines, LLM handles it."

*(pause 1 sec)*

> "Second — here's the part nobody else has." **[cut to Claude Code (or Cursor) window]** "Runly ships as an MCP server. I added two lines to my Claude Code config." **[briefly show `~/.claude.json` with the Runly block]** "Now I can just ask Claude to test my app."

**[type in Claude Code:]** *"Use runly_open_url to smoke-test example.com"*

*(wait for response, ~3 sec)*

> "Claude called Runly. A headless browser opened, fetched the URL, returned the title and status. Your AI agent can now run any `.runly` test, inspect elements, or chain into a larger flow. This is the piece the cloud test platforms can't ship — because their tests live in their dashboard, not your terminal."

*(pause 1 sec)*

> "Third — migration." **[cut back to terminal]** "If you've got an existing Playwright suite —" **[`cat tests/fixtures/playwright/login.spec.ts` — show it briefly]** "— one command:"

**[type:]** `runly import tests/fixtures/playwright/login.spec.ts`

*(wait ~2 sec for output)*

> "Three tests, fifteen steps, converted to plain English. `describe` blocks become tags. Expect-toBeVisible becomes `verify is visible`. Any line the regex can't translate gets flagged `# TODO` so nothing drops silently." **[cat the resulting `.runly` file briefly]**

*(pause 1 sec)*

> "That's Runly. MIT-licensed, lives in your repo, works offline, no dashboard. `npm install -g runly-cli` — link's in the replies. If you're building AI-agent infrastructure or test tooling and any of this is interesting, my DMs are open. Thanks."

**[end recording]**

---

## Before you record — do these

- [ ] Rehearse the script twice out loud. Time yourself. Cut anything that pushes past 95 sec.
- [ ] Open the files ahead of time: `standard-user-purchases.runly`, `~/.claude.json`, `login.spec.ts`, a fresh terminal tab.
- [ ] Close Slack / notifications / tabs that could bubble up mid-recording.
- [ ] Increase font size in terminal to ~18pt so it's readable at 720p.
- [ ] Pre-run `runly import` once so the output files exist — avoids a mid-demo install prompt.
- [ ] Claude Code: have the MCP config live so `runly_open_url` works on first try. Test it manually right before hitting Record.

## After you record

1. Upload to Loom. Set privacy to **Public link** (no login required).
2. Copy the share URL.
3. Add as a comment pinned under your launch tweet.
4. Embed in GitHub README (replace the placeholder once the rewrite is merged).
5. Drop the URL into the `outreach/templates.md` variables.

## If you mess up a take

Don't re-record the whole thing. Loom lets you trim. A 92-second take with one "umm" is better than a fourth retake. Ship.
