# Launch Day Checklist

Print this. Check items as you go. Don't skip steps.

---

## T-7 days (one week before launch)

- [ ] Pick launch date — **Tuesday or Wednesday** (not Monday, not Friday)
- [ ] Record the demo GIF (see `DEMO_SCRIPT.md`)
- [ ] Create GitHub repo at `github.com/runly/runly`
- [ ] Push all code with clean commit history
- [ ] Test `npm install -g runly-local-path` on a fresh machine/VM
- [ ] Ask 3 friends to try the README install — get confused-moment feedback
- [ ] Fix the 3 things they got confused by
- [ ] Write the HN post and rehearse answering the comments (see `HACKER_NEWS.md`)
- [ ] Draft the Twitter thread (see `TWITTER.md`)
- [ ] Draft Reddit posts (see `REDDIT.md`)
- [ ] Create Product Hunt listing draft (see `PRODUCT_HUNT.md`)

## T-3 days

- [ ] Publish to npm as `runly` (or `runly-cli` if name taken)
      - Run `npm login` if not already logged in
      - Run `npm publish --dry-run` first to verify
      - Run `npm publish`
      - Verify `npm install -g runly-cli` works on a clean machine
- [ ] Publish the GitHub Action to the marketplace
      - Create `runly/action` repo with just `action.yml`
      - Tag a release `v1`
      - Submit to marketplace via GitHub UI
- [ ] Add repo topics on GitHub: `playwright`, `testing`, `e2e`, `cli`, `ai`, `natural-language`
- [ ] Add a social preview image (1280×640px)
- [ ] Pin the demo GIF as the first image in the README

## T-1 day (day before launch)

- [ ] Final README review — any typos, broken links?
- [ ] Verify demo GIF loads correctly on GitHub mobile view
- [ ] Schedule Product Hunt submission for 12:01 AM PT launch day
- [ ] Test `runly doctor` and `runly run tests/examples/` one more time
- [ ] Clear `~/.runly/` cache and re-test install from scratch
- [ ] Write down the exact commands you'll type during the demo
- [ ] Get a good night's sleep

## T-0 (launch day)

### 9:00 AM PT — Hacker News

- [ ] Post the Show HN (see `HACKER_NEWS.md`)
- [ ] Set a timer: **do not edit the post for 2 hours**
- [ ] Open HN in a tab, keep it open all day
- [ ] Respond to every comment within 30 minutes

### 10:00 AM PT — Twitter / X

- [ ] Post the 8-tweet thread (see `TWITTER.md`)
- [ ] Quote-tweet the HN submission in the last tweet
- [ ] Reply to the first comment yourself to keep the thread active

### 12:00 PM PT — Reddit (first sub)

- [ ] Post to r/webdev or r/javascript (NOT both on the same day)
- [ ] Respond to comments

### 1:00 PM PT — Cross-platform checks

- [ ] Check HN position — is it on front page?
- [ ] Check Twitter engagement — getting retweets?
- [ ] Check GitHub stars — count is going up?
- [ ] Check npm downloads — any installs?

### 3:00 PM PT — Second wave

- [ ] Post to r/node or r/opensource (different from first Reddit post)
- [ ] Tweet a reply to your thread with any user feedback
- [ ] If HN is still on front page, share to dev Discord/Slack groups you're in

### 6:00 PM PT — Review

- [ ] Keep responding to HN comments for another hour
- [ ] Retweet any positive mentions
- [ ] Star count check
- [ ] Go to bed, don't stay up obsessing

---

## T+1 day

- [ ] Post to Product Hunt (if not scheduled already)
- [ ] Post to the remaining Reddit subs (r/QualityAssurance, r/selenium)
- [ ] Write a follow-up tweet with numbers: "24 hours since launch, X stars, Y installs"
- [ ] Reply to the last wave of HN comments
- [ ] Create issues for every bug/feature request people mentioned

## T+7 days

- [ ] Triage all GitHub issues
- [ ] Ship at least one fix based on launch feedback
- [ ] Tweet the fix with "Shipped: X based on feedback from launch"
- [ ] Write a "What I learned from launching Runly" blog post
- [ ] Submit blog post to HN as a followup if you have something interesting

---

## Metrics to Track

Write these down BEFORE launch so you have something to compare against.

| Metric | Before launch | 24h after | 7 days after |
|---|---|---|---|
| GitHub stars | 0 | _ | _ |
| npm downloads | 0 | _ | _ |
| Twitter followers | _ | _ | _ |
| HN post karma | 0 | _ | _ |
| HN comments | 0 | _ | _ |
| GitHub issues | 0 | _ | _ |
| GitHub PRs | 0 | _ | _ |

Realistic targets for a first-time launch:
- 100-500 stars in 24h
- 50-200 npm downloads
- 20-50 HN karma (front page = 100+)
- 10-30 issues/PRs

Beating these means you hit viral territory. Not beating them is still
a success — it means you shipped and learned.

---

## If Launch Fails (no front page, low engagement)

DO NOT DELETE THE POST. DO NOT APOLOGIZE.

Options:
1. Wait 2 weeks, iterate based on any feedback you got, then relaunch
   with a different title/angle
2. Post to a different community (Indie Hackers, Lobsters, dev.to)
3. Write a technical deep-dive blog post and submit that to HN as a
   followup ("I built a natural language → Playwright parser — here's
   how it works")

The fact that you shipped something is already valuable. Put it on
your resume, move on.

---

## If Launch Succeeds (front page, 1000+ stars)

DO NOT PROMISE FEATURES YOU CAN'T DELIVER.

- Do NOT say "paid version coming soon" unless you actually mean it
- Do NOT say "enterprise features coming" unless you want that burden
- Do NOT take investment meetings unless you actually want to run a company
- DO thank people, respond to issues, ship fixes
- DO take notes on every piece of feedback
- DO enjoy the win

Most "viral" launches don't turn into businesses. They turn into
respected open-source projects that get the author a better job. That's
a great outcome. Own it.
