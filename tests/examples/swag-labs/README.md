# Swag Labs — plain-text browser tests

This directory is a full end-to-end suite for [Swag Labs](https://www.saucedemo.com/) (the Sauce Labs demo e-commerce app), written entirely in the `.runly` format.

It's a working reference for how to structure real-world tests in Runly — reusable modules, semantic AI assertions, and synthetic checkout data.

## What this suite covers

| | Cloud-editor YAML tools | Runly |
|---|---|---|
| Format | YAML with UUIDs | Plain text |
| Test authoring | Cloud GUI editor | Any text editor |
| Git-diffable | No (UUID churn) | Yes |
| Module reuse | `moduleId: 68aab6c6-21e6-…` | `@use login.runly` |
| AI assertions | `type: AI_ASSERTION` block | `verify ai: …` line |
| Synthetic data | `{{faker.person.firstName()}}` | `{{faker.person.firstName}}` |
| Runtime dependency | Vendor cloud | None (local Playwright) |
| License | Usually closed | MIT |
| LOC (same 2 tests + 3 modules) | **~245 lines YAML** | **70 lines plain text** — 3.5× smaller |

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
