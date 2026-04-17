# Swag Labs — head-to-head against Momentic

This directory is a direct port of [momentic-ai/examples/web](https://github.com/momentic-ai/examples/tree/main/web), rewritten in `.runly` plain-text format.

## What the comparison shows

| | Momentic | Runly |
|---|---|---|
| Format | YAML with UUIDs | Plain text |
| Test authoring | Cloud GUI editor | Any text editor |
| Git-diffable | No (UUID churn) | Yes |
| Module reuse | `moduleId: 68aab6c6-21e6-4e0b-a8cf-217765f4fb1f` | `@use login.runly` |
| AI assertions | `type: AI_ASSERTION` | `verify ai: …` |
| Synthetic data | `{{faker.person.firstName()}}` | `{{faker.person.firstName}}` |
| Runtime dependency | Momentic cloud | None (local Playwright) |
| License | Closed | MIT |
| LOC (same 2 tests + 3 modules) | **245 lines YAML** | **70 lines plain text** — 3.5× smaller |

## Files

- `login.runly` — reusable module (username + password + submit)
- `add-item-to-cart.runly` — reusable module (parameterized by item name)
- `fill-personal-info.runly` — reusable module (Faker-generated checkout data)
- `standard-user-purchases.runly` — full checkout flow with 2 AI assertions
- `cart-and-sorting-behavior.runly` — cart invariance under sorting with 1 AI assertion

## Run them

```bash
export ANTHROPIC_API_KEY=sk-ant-...
runly run tests/examples/swag-labs/
```

Or a single test:

```bash
runly run tests/examples/swag-labs/standard-user-purchases.runly
```
