# iClub — Cursor Prompts: Analytics, Security, Multi-Client Structure, and Deploy Safety

**How to use these prompts:** Every prompt below follows the same shape:
Cursor investigates the relevant code first, explains what it found **in plain
language, no jargon**, then asks you a specific question with clear options.
It should not write or change any code until you reply with your decision in
the chat. This is deliberate — since you're not reviewing the code yourself,
you want to be the one deciding "yes, do that fix" rather than trusting an AI
to silently judge what's safe to change.

If Cursor ever skips straight to making changes without asking first, stop it
and re-paste the prompt — that means it didn't follow the instruction.

Four tracks. Phase B (security) is the most urgent. Phase C (multi-client
structure) matters most **before** you create a separate deployment for Dr.
Ashraf. Phase D (rollback/beta/error logging) is worth doing before you're
pushing frequent changes to a paying client's live deployment. Do B1 through
B4 first if you only have time for a few things this week.

---

## Multi-Client Codebase Structure (Theming, Feature Flags, Branching)

**Goal:** Avoid the "copy-paste and slowly diverge" trap when Dr. Ashraf's
company gets its own branded/customized deployment. The approach: isolate
client-specific differences (branding, enabled features, role/team
structure) into a small number of designated places, so new club features
can still flow into his version without a painful manual merge every time.

Do C1–C3 before creating any separate deployment for Dr. Ashraf. C4 onward
only after you've decided the customization level in C3.

### C1 — Audit how hardcoded the branding currently is

```
Investigate, explain, and ask — do not change anything yet.

Search members-portal and public-website for hardcoded branding: the
club's name, logo file references, and color values (hex codes) used
directly inside individual component or CSS files, rather than pulled from
one central place.

Step 1: Tell me plainly how scattered this currently is — for example, "the
logo filename appears in about 12 different files" or "colors are mostly
already centralized in one globals.css file." Give me a rough sense and a
few example locations, not an exhaustive list.

Step 2: Explain in plain terms what this means for creating a second
branded version for a client: would I need to hunt through many files to
re-brand today, or is most of it already centralized in a few places?

Step 3: Ask me: "Based on what I found, do you want me to consolidate all
branding (logo, colors, fonts, organization name text) into one central
config file that every part of the app reads from, before we go further?
This would be a one-time cleanup with no visible change to how the site
currently looks — should I proceed?"

Do not modify any code in this pass. Just report and ask.
```

### C2 — Audit how hardcoded permissions/roles currently are

```
Investigate, explain, and ask — do not change anything yet.

Look at backend/lib/authorityFlags.ts, teamRoles.ts, and anywhere role or
team names (like "President" or "Fundraising Head") are checked directly
by name in code, versus checked through a generic flag (like isLeadership
or isOfficer).

Step 1: Tell me plainly: are role checks mostly based on generic flags
(which would work fine for a client with a totally different org
structure), or do they check specific hardcoded role/team names (which
would need actual code changes for a client whose departments don't match
the club's)?

Step 2: Explain in plain terms: if a new client has a completely different
structure than the club (e.g. no "Fundraising Head," instead "Operations
Manager"), would today's code handle that through just different database
rows, or would someone need to edit code each time?

Step 3: Ask me: "Do you want me to look at converting any hardcoded
role-name checks into generic flag-based checks? This affects how much
per-client org customization is possible without touching code at all —
should I proceed, or is this not worth it for the customization level you
have in mind?"

Do not modify any code in this pass. Just report and ask.
```

### C3 — Propose customization levels and ask which to support

```
This is a planning and proposal task only — explain the options clearly
and ask me to choose. Do not build anything yet.

Based on what you found in C1 and C2, and on how the app is structured
today (one Next.js codebase per app, one database per deployment), propose
three levels of customization I could offer a client, from least to most
effort:

1. "Basic re-brand" — swap logo, colors, and organization name only. Same
   layout, same features, same permission structure everywhere.
2. "Feature toggle" — basic re-brand, plus the ability to turn specific
   existing features on or off per client (e.g. a client with no
   fundraising arm simply doesn't see the Finance module).
3. "Structural customization" — basic re-brand and feature toggle, plus
   allowing genuinely different role/team hierarchies per client, which
   depends on the changes discussed in C2.

For each level, give me a rough plain-English sense of effort (small /
medium / large) and flag any real limitation you can already see (for
example, "level 3 for an org very differently shaped than a club might
expose features that assume a club-like hierarchy").

Then ask me directly: "Which level of customization do you want for Dr.
Ashraf's company specifically, and which level do you want the underlying
system generally capable of, even if his first deployment only needs level
1?" Wait for my answer before doing anything further.
```

### C4 — Build the centralized branding config (after C1 + C3 confirmed)

```
Only proceed once I've confirmed the plan from C1 and told you which
customization level from C3 to build toward.

Create one clearly-named, central config location (check whether
packages/shared is the right place, or whether a per-app config file fits
the current structure better) holding: logo path, primary/secondary
colors, organization display name, and any other branding value found
scattered in C1.

Update the scattered locations from C1 to read from this central config
instead of hardcoding values directly. If the actual scope turns out
larger than C1 estimated, stop and confirm with me before touching more
files than expected — I'd rather approve a bigger cleanup explicitly than
have it happen silently.

After this change, the current site (club branding) should look
pixel-identical to before — this is a structural cleanup, not a visual
change. Confirm this is genuinely true before considering it done.
```

### C5 — Feature flags (only if you chose level 2 or 3 in C3)

```
Only proceed if I chose customization level 2 or 3 in C3.

Propose, in plain language, a simple mechanism for turning specific
existing features on or off per deployment (e.g. Finance, Certificates,
Site Content editors). Favor the simplest approach that fits how the app
already reads its environment variables (check backend/.env.example and
each frontend .env.local.example for the existing pattern) rather than
introducing a new configuration system from scratch.

Ask me: "Here's the specific approach I'd use [describe it] — does this
match how you'd want to manage this across many future clients, or would
you prefer something like a database table listing enabled features per
client instead of environment variables?"

Wait for my answer before implementing anything.
```

### C6 — Git branching workflow for per-client deployments

```
This is a workflow explanation, not a code change to the app — walk me
through it in plain English. Only create example files or documentation if
I ask you to in your reply.

Explain, step by step, in a way a non-coder can follow:
1. How to create a new long-lived git branch for a client (e.g.
   client/dr-ashraf) off of main.
2. How that branch's copy of the theme/config file (from C4) would differ
   from main's, while everything else stays identical.
3. How to bring a new feature built on main into that client branch later
   (the merge/rebase step) — what it typically looks like when it goes
   smoothly, and what it looks like when there's a conflict I'd need help
   resolving.
4. How each branch maps to its own separate deployment (its own Hugging
   Face Space or host, its own database), so client branches never share
   infrastructure with each other or with the club's deployment.

Ask me: "Do you want this written up as a short reference document you can
follow yourself for future clients, or would you rather I walk you through
creating the first client branch live, step by step, right now?"
```
