# Demo Recording Script

You need ONE killer demo GIF for the launch. This script captures it in 30 seconds.

## Recording Setup

**Tool:** [asciinema](https://asciinema.org/) or [vhs](https://github.com/charmbracelet/vhs)

**Terminal:**
- Font: JetBrains Mono, 18pt
- Theme: Dracula or Tokyo Night (high contrast)
- Size: 100×28 characters
- Clean prompt: just `$ ` (no hostname/user/path)

**Before recording:**
```bash
clear
export PS1='$ '
```

---

## Scene-by-Scene (30 seconds total)

### Scene 1 (0-3s) — The brand reveal

```bash
$ runly
```

Shows ASCII logo + help.

### Scene 2 (3-7s) — One-line test

```bash
$ runly test "open example.com and verify Example Domain" --no-ai
```

Shows:
- Banner
- Parsed steps
- Step-by-step green checks
- PASSED badge
- Summary

### Scene 3 (7-12s) — Show the .runly file

```bash
$ cat tests/examples/homepage.runly
```

Reveals the clean file format with metadata + instructions.

### Scene 4 (12-20s) — Run a directory of tests

```bash
$ runly run tests/examples/ --no-ai --parallel 2
```

Shows:
- Found N tests
- Parallel execution
- Mixed pass/fail output
- Suite summary table

### Scene 5 (20-25s) — JSON output for piping

```bash
$ runly run tests/examples/homepage.runly --json --no-ai | jq '.results[0].success'
true
```

Proves it's scriptable.

### Scene 6 (25-30s) — CI integration tease

Show `.github/workflows/example.yml` snippet:

```yaml
- uses: runly/action@v1
  with:
    tests: tests/
```

Then fade to black with the GitHub repo URL.

---

## Recording Commands (asciinema)

```bash
# Start recording
asciinema rec runly-demo.cast

# Run the scenes above

# Stop recording
Ctrl+D

# Upload
asciinema upload runly-demo.cast

# Or convert to GIF with agg
agg runly-demo.cast runly-demo.gif --font-size 18 --theme dracula
```

## Recording Commands (vhs — produces GIF directly)

Save this as `runly-demo.tape`:

```
Output runly-demo.gif

Set FontSize 18
Set Width 1200
Set Height 700
Set Theme "Dracula"

Type "runly" Sleep 500ms Enter
Sleep 2s

Type 'runly test "open example.com and verify Example Domain" --no-ai'
Sleep 500ms
Enter
Sleep 5s

Type "cat tests/examples/homepage.runly" Sleep 500ms Enter
Sleep 4s

Type "runly run tests/examples/ --no-ai --parallel 2" Sleep 500ms Enter
Sleep 12s

Type 'runly run tests/examples/homepage.runly --json --no-ai | jq .results[0].success'
Sleep 500ms
Enter
Sleep 3s
```

Then:
```bash
vhs runly-demo.tape
```

Produces `runly-demo.gif` ready to upload to HN/Twitter/README.

---

## What to Highlight in the GIF

✓ The ASCII logo (shows branding)
✓ Fast execution (test completes in 1-2 seconds)
✓ The `.runly` file format (this is the differentiator)
✓ Parallel execution (shows it's not just a toy)
✓ JSON output (proves it's scriptable)

✗ Don't show AI mode (needs API key, confuses the "free" message)
✗ Don't show failures (first impression matters)
✗ Don't go over 30 seconds (attention span)
✗ Don't include any sensitive data

---

## Alternative: Short Video (60 seconds)

If you can record a screen video instead of a GIF, add:

0-10s: CLI demo (scenes 1-2 above)
10-25s: Editor view of the `.runly` file format with syntax highlighting
25-40s: CI run in a real GitHub Actions screen
40-55s: HTML dashboard (`runly report`) opened in a browser
55-60s: GitHub repo page with stars + README

Export as MP4, upload to YouTube (unlisted), embed in HN post.
