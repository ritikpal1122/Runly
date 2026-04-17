# Runly v0.3.0 — Build · Demo · Pitch · Outreach

Goal: ship features that go beyond KaneAI/Momentic so Runly becomes a credible lead for a hiring offer at Browserbase / Anthropic (Claude Code) / Cursor / Cognition / Windsurf / Vercel / Replit / Bolt / E2B / Momentic / LambdaTest tier.

**Positioning:** *Plain-English browser tests for AI agents, via MCP.* Not "KaneAI but OSS" — picks-and-shovels for the Claude Code / Stagehand wave.

---

## Phase 1 — Build (Week 1)

- [x] **#1 — Audit + commit current repo state.** REPL (342 LOC, was untracked) and auto-spec/dashboard finalization are now committed as `bc08bf5`.
- [x] **#2 — Build MCP server (`runly mcp`).** Committed as `331da57`. Six tools (`runly_test`, `runly_run_file`, `runly_list_tests`, `runly_inspect`, `runly_open_url`, `runly_last_run`) exposed over stdio. End-to-end smoke test passes — `runly_open_url` fetches example.com in 314ms.
- [x] **#3 — Build Playwright → .runly migrator (`runly import`).** Committed as `1c7ebab`. Regex-based converter handles all common Playwright patterns. Round-trip verified on login.spec.ts — 3 tests / 15 steps / 0 TODOs, converted file runs green in 1020ms.
- [x] **#4 — Modules/reusable-flows (`@use` directive).** Committed as `6a6a701`. Syntax `@use login.runly with user=admin pass=secret` inlines steps with variable overrides; cycle detection throws on recursive imports.
- [x] **#5 — AI assertions (`verify ai: ...`).** Committed as `d730a28`. Parser routes `verify ai: X` to a structured step; runner snapshots DOM, asks Claude, gets a strict JSON verdict with reasoning.
- [x] **#6 — Faker integration.** Committed as `28a774d`. Any `{{faker.<path>}}` resolves via `@faker-js/faker` at interpolation time — e.g. `{{faker.person.firstName}}`, `{{faker.internet.email}}`.
- [ ] **#7 — Add Playwright trace + video capture.** Wire `context.tracing.start()` + `recordVideo`. Add `--trace` flag. Output `output/traces/run-{ts}.zip`. Print `npx playwright show-trace <path>` instruction on completion.
- [ ] **#8 — Swap byte-level visual diff for pixelmatch.** Replace `src/runner/visualDiff.js` byte compare with `pixelmatch` + `pngjs`. Write a `diff.png` highlighting changed regions. Configurable `--threshold` (default 0.1).

## Phase 2 — Demo content (late Week 1 / early Week 2)

- [x] **#9 — Swag Labs head-to-head.** Committed as `c6dc239`. Full port of momentic-ai/examples/web: 245 lines of Momentic YAML → 70 lines of Runly plain text (3.5× smaller). Uses every new feature from #4-#6.
- [ ] **#10 — Write 20+ tests for core modules.** Zero coverage = hiring red flag. Cover parser, interpolate, selectorEngine, sessionStore, visualDiff, MCP tool handlers. Use `node --test`. Green CI badge in README.
- [ ] **#11 — Rewrite README with MCP hero demo + GIF.** Lead with *"Plain-English browser tests for AI agents, via MCP."* Terminalizer GIF showing Claude Code calling Runly. Move feature table below the fold.
- [ ] **#12 — Record 90-sec Loom demos.** Three Looms:
  - (a) Claude Code says "smoke test my app" → browser opens → result back in chat (90 s)
  - (b) `.spec.ts` → `.runly` migration in 60 s
  - (c) Test fails → auto-heal → passes (45 s)

## Phase 3 — Pitch assets

- [ ] **#13 — Build outreach target list (50 companies × 2 people each).**
  - **Tier 1 (market-aligned):** Browserbase, Stagehand, Anthropic (Claude Code team), Cursor, Cognition (Devin), Windsurf, Vercel, Replit, Bolt.new, E2B, Modal, Factory.
  - **Tier 2 (browser-test incumbents):** Momentic, KaneAI / LambdaTest, Mabl, Testim.
  - Each row: company, eng lead, X/LinkedIn URL, one specific hook line tied to their product.
  - Store as `outreach/targets.csv` in the repo.
- [ ] **#14 — Draft outreach templates (DM + email × Tier 1 + Tier 2 = 4 variants).**
  - Short, specific, single CTA. Loom link + GitHub.
  - Tier 1 pitch angle: "I built the MCP layer for browser testing."
  - Tier 2 pitch angle: "I ported your examples to a plain-text format — worth a chat?"

## Phase 4 — Launch & outreach

- [ ] **#15 — Update HN + Product Hunt + Reddit launch copy** (`launch/` drafts) with new MCP + migrator positioning. Aim for 200+ HN upvotes = social proof for outreach.
- [ ] **#16 — Publish v0.3.0 to npm + cut GitHub release.** Bump version, update CHANGELOG, `npm publish`, `git tag`, `gh release create`. Verify `runly doctor` and `runly mcp` both work from a fresh global install.
- [ ] **#17 — Send Tier 1 outreach** (Day 1 of launch — ride the HN bump).
- [ ] **#18 — Send Tier 2 outreach** (Day 3–5 after warming up with Tier 1 replies).

---

## What we are NOT building (and why)

- **YAML test format** — Momentic's mistake (UUIDs, GUI-editor lock-in). `.runly` plain text is strictly better.
- **Multi-user / SSO / team features** — enterprise plumbing, hurts demo, not what OSS portfolios are judged on.
- **Mobile device farm** — BrowserStack's category. Not winnable solo.
- **Cloud dashboard / hosted tier** — would make Runly acquirable someday but distracts from the hiring goal.
- **Full agentic explorer mode** (`runly explore --goal "find broken flows"`) — too ambitious for v0.3. Revisit in v0.4 if v0.3 lands well.

---

## Success criteria for v0.3.0 release

- `runly mcp` works inside Claude Code (verified by demo Loom)
- `runly import my.spec.ts` produces a valid `.runly` file that actually runs green
- Swag Labs head-to-head test demonstrably shorter than Momentic YAML
- 20+ tests passing in CI, green badge in README
- 90-second Loom ready to embed in outreach DMs
