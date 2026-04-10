# Contributing to Runly

Thanks for your interest in Runly! This document explains how to contribute.

## Ways to Contribute

- **Report bugs** — open an issue with a reproduction case
- **Suggest features** — open an issue tagged `enhancement`
- **Improve docs** — README, skill file, code comments
- **Fix bugs** — check issues labeled `good first issue`
- **Add features** — discuss in an issue first, then PR

## Development Setup

```bash
git clone https://github.com/runly/runly.git
cd runly
npm install
npm link
npx playwright install chromium
runly doctor
```

Run the example test suite to verify everything works:

```bash
runly run tests/examples/ --no-ai
```

## Project Structure

```
runly/
├── bin/runly.js              # CLI entry point (commander)
├── src/
│   ├── commands/             # Each CLI subcommand
│   ├── parser/               # English → Step[] (regex)
│   ├── ai/                   # Claude integration
│   ├── runner/               # Playwright execution
│   ├── generator/            # Step[] → .spec.js exports
│   ├── reporter/             # Terminal + JSON output
│   └── utils/                # Logger, config, paths
├── tests/examples/           # .runly example tests
├── skills/runly.md           # Complete architectural reference
└── action.yml                # GitHub Action manifest
```

## Code Style

- **ES modules** (`import`/`export`)
- **No TypeScript** (yet — keeps iteration fast)
- **Minimal dependencies** — each new dep needs justification
- **No build step** — runs directly from source
- **Clean CLI output** — use the logger, not `console.log`

## Before Opening a PR

1. Run `runly doctor` — all checks must pass
2. Run `runly run tests/examples/ --no-ai` — all passable tests should still pass
3. Update `CHANGELOG.md` with your changes
4. Keep PRs focused — one feature/fix per PR
5. Write clear commit messages

## Testing Your Changes

There's no formal test suite yet. Manual verification via the example tests is the current standard. If you add a new command, add an example test for it.

## Areas Where Help Is Wanted

- **Unit tests** for the parser and selector engine
- **Mobile support** via Appium
- **More prompt templates** for specific frameworks (React, Vue, etc.)
- **Documentation** — more recipes, tutorials, videos
- **Browser extension** for recording interactions
- **VS Code extension** for `.runly` file syntax highlighting

## Code of Conduct

Be kind. Be constructive. Assume good intent. Disagreements are fine — personal attacks are not.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
