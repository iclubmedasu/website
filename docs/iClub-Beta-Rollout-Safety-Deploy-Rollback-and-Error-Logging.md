##  Beta Rollout Safety, Deploy Rollback, and Error Logging

**Goal:** Let you ship risky/new features without every user seeing them
immediately (beta flags), automatically catch and reverse a broken deploy
before it stays live (rollback), and actually be able to investigate what
went wrong afterward (error logging) — three related but separate pieces.

Do D1–D2 first (audit + choose scope) before building anything else in this
phase.

### D1 — Audit what happens today if a deploy breaks

```
Investigate, explain, and ask — do not change anything yet.

Look at .github/workflows/deploy.yml and docs/deployment.md.

Step 1: Explain plainly, step by step, what currently happens from the
moment code is pushed to main until it's live on Hugging Face: does
anything check that the site is actually working after deploying, or does
it just upload the files and assume it worked?

Step 2: Tell me plainly: if a bad deploy goes out right now, what would
actually happen? Would the broken version just stay live until I notice
and manually fix it, or is there already some check/rollback in place?

Step 3: Look up (or tell me you're not fully certain and to double check
against Hugging Face's current documentation) how Hugging Face Spaces
handle version history — specifically, whether reverting to a previous
working version is something that can be automated as part of the
existing GitHub Actions workflow, or whether it would need to be done
manually through the Space's own interface.

Do not change anything yet — just report clearly so I understand the
current gap before we decide what to build.
```

### D2 — Propose scope tiers and ask which to build

```
This is a planning and proposal task only — do not build anything yet.

Based on D1's findings, propose three tiers, from least to most effort:

1. "Basic safety net" — after each deploy, automatically check that
   /health returns 200; if it doesn't within a short wait, automatically
   revert to the previous working version and notify me (however
   notification is simplest to wire up, e.g. a GitHub Actions failure
   email).
2. "Basic safety net + beta flags" — everything in tier 1, plus a simple
   way to mark specific new features as "beta" so they're only visible to
   me (or a short list of member accounts I choose) until I turn them on
   for everyone.
3. "Full pipeline" — everything above, plus a proper error-tracking
   service (like Sentry) capturing real stack traces after something
   breaks in production, and a separate staging deployment that changes
   go to first, before touching the real production Space.

For each tier, give me a plain-English sense of effort (small / medium /
large) and be honest about diminishing returns — e.g. whether tier 3 is
overkill right now for a small number of deployments versus something
worth building once you have several paying clients.

Ask me directly: "Which tier do you want to build toward right now?" Wait
for my answer before doing anything further.
```

### D3 — Build the health-check + rollback safety net (tier 1)

```
Only proceed once I've confirmed at least tier 1 from D2.

Modify .github/workflows/deploy.yml so that after deploying, it checks the
relevant /health endpoint (and equivalent basic checks for the frontends
if reasonable) and waits briefly for a healthy response.

If the check fails, explain to me first, in plain language, exactly what
you're proposing as the automatic recovery step (e.g. "revert the Space to
the last commit that passed this same check") before implementing it —
this is the part most likely to need Hugging Face's current documented
behavior confirmed, so double check rather than guessing.

Also add a way for me to actually notice a failed deploy happened (e.g. a
GitHub Actions job failure shows up in my email if that's already
connected, or a simple notification step) — ask me which notification
method I actually want before wiring it in.

Confirm with me before merging this into the actual deploy workflow used
for real deploys — I'd like to test this on a deliberately broken small
change first to see it actually catch something.
```

### D4 — Beta feature flags (tier 2+)

```
Only proceed if I chose tier 2 or 3 in D2.

Propose, in plain language, the simplest mechanism for marking a specific
new feature as "beta" so only you (or a short list of member accounts) see
it, while everyone else sees the current behavior. Check whether this can
reuse anything from the feature-flag work in Phase C (if that was already
built) before creating a separate new mechanism.

Ask me: "Do you want beta access controlled by a specific list of member
emails/IDs, or by a simple role like 'is this the developer/admin
account'? And once a beta feature is confirmed working, do you want a
manual step to turn it on for everyone, or should removing the flag from
the code be enough?"

Wait for my answer before implementing.
```

### D5 — Error tracking (tier 3)

```
Only proceed if I chose tier 3 in D2.

Explain plainly what a service like Sentry (or a similar error-tracking
tool) actually does: it captures the real error and stack trace whenever
something breaks while the app is live, and lets you look it up later,
instead of relying on Hugging Face's own logs which are harder to search
after the fact.

Explain the privacy tradeoff clearly: whatever data is present when an
error happens (e.g. request details) could be sent to this third-party
service unless it's deliberately configured not to include things like
registrant names, emails, or phone numbers. Propose a configuration that
excludes that kind of data from error reports.

Ask me: "Do you want to set this up with a specific service (I'd suggest
Sentry's free tier as a starting point, but confirm current pricing/limits
before committing), and are you comfortable with the privacy tradeoff as I
described it, configured to exclude PII from reports?"

Wait for my answer before implementing.
```

### D6 — Staging deployment (tier 3, most effort)

```
Only proceed if I chose tier 3 in D2, and only after D3–D5 are in place.

Propose, in plain language, what a staging deployment would look like
given the current setup (e.g. a second Hugging Face Space, or another
low-cost host, running the same code with a separate throwaway database)
and how the GitHub Actions workflow would deploy there first, giving you a
chance to check it before promoting the same change to the real production
Space.

Ask me: "Given you're currently managing this mostly on your own, do you
want a staging deployment that requires you to manually approve promotion
to production each time, or would you rather changes only go to staging
automatically and you decide when to push them to production yourself
through a separate manual step?"

Wait for my answer before building anything.
```
