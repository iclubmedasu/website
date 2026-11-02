# Multi-Instance Foundation (Claude Code edition)

**Goal:** Run iClub for several organizations (the club, Dr. Ashraf's
company, future clients) from ONE codebase, where every difference between
clients is stored as configuration or database data, never as copied or
edited code. Each client still gets its own database, Hugging Face Spaces,
and email domain ("multi-instance"). True multi-tenant (one shared
database) is deliberately NOT part of this phase.

### Decisions already made (do not re-ask these)

1. **One private GitHub repo, `main` branch only for deployment.** No
   client branches, no copied repos. Clients never see the source code.
   (Claude Code works on a temporary feature branch, `feat/client-
   profiles`, which merges back into `main`. That is normal and different
   from a client branch.)
2. **A client is a profile, not a fork.** Non-secret differences live in
   one JSON profile per client inside the repo (`clients/<id>.json`).
   Each deployment selects its profile with a single variable: `CLIENT_ID`.
3. **Secrets never go in the repo.** Database URLs, JWT secrets, API keys,
   and Resend keys stay in Hugging Face Space secrets and GitHub
   Environment secrets.
4. **Defaults equal today's club behavior.** If `CLIENT_ID` is missing or
   set to `club`, the app must behave and look exactly as it does today.
5. **Hiding is not protecting.** A disabled feature must be blocked in the
   backend API, not only hidden from menus.

### How Claude Code changes the way you run this phase

| Claude Code feature | How this phase uses it |
|---|---|
| **CLAUDE.md** (project instructions it re-reads every session) | The ground rules live there once. You never re-paste them, and they survive `/clear`. |
| **Plan mode** (read-only; it can look but not edit) | Stage 1 audits run in plan mode, so it physically cannot change code while auditing. |
| **Subagents** (helper agents with their own context) | The audit fans out across the repo in parallel without filling your main conversation. |
| **Question tool** (multiple-choice popups) | Every CHECKPOINT uses it, so you tap an answer or type your own. |
| **Task list** | Each stage shows its progress as a checklist you can watch. |
| **Permissions** (`/permissions`, `.claude/settings.json`) | Blocks it from reading your secret `.env` files or pushing to GitHub. |
| **Runs commands itself** | It runs typecheck, tests, and the local apps and reports real results, instead of describing what to run. |

**Working rhythm:**
1. Do **C0 once** (setup).
2. For each stage, start a fresh conversation (`/clear`), paste that
   stage's prompt, and watch the checklist.
3. After each prompt finishes, review the summary, then say "commit this"
   (it commits to the feature branch, giving you a rollback point).
4. Never let it push to GitHub or trigger a deploy. You do that yourself
   after Stage 2 is fully verified.

---

### C0 — One-time setup (CLAUDE.md, permissions, branch)

Paste into Claude Code at the repo root:

```
Do this setup only, then stop.

1. Create the git branch feat/client-profiles from main and switch to it.

2. Add the section below to CLAUDE.md at the repo root. If CLAUDE.md
   already exists, APPEND under a new heading and do not change anything
   else in it.

   ## Multi-client rules (Phase C)
   - iClub is a pnpm monorepo (backend, members-portal, public-website,
     packages/shared). One codebase serves several clients, each with its
     own deployment (own Supabase DB, own Hugging Face Spaces, own Resend
     domain).
   - The owner is a medical student, not a developer. Explain in plain
     English and define each technical term at first use.
   - One repo. Never create client-specific branches or copy files per
     client.
   - Client differences live in clients/<id>.json (NON-SECRET only),
     selected by CLIENT_ID (NEXT_PUBLIC_CLIENT_ID for the frontends).
     Secrets stay in environment variables, never in the repo.
   - With CLIENT_ID unset or "club", the app must look and behave exactly
     as today. Any visible change for the club is a bug.
   - A disabled feature must be blocked in the backend, not just hidden
     in the UI.
   - After each step run typecheck, lint, and the existing tests, and
     report the real results.
   - Never run git push, never trigger or modify deployments, and never
     run migrations against any non-local database.
   - Never read or print .env files or secret values. Use .env.example
     files only.
   - At steps marked CHECKPOINT: use the question tool with 2 to 4
     options, put your recommendation first, explain the trade-off in
     plain language, and wait for the answer before writing code.
   - Work in small steps, and keep a task list.

3. Create or update .claude/settings.json so these are denied: reading
   backend/.env, members-portal/.env.local, public-website/.env.local,
   any other .env* file except *.example files, and the commands git push
   and gh workflow run. First check the current Claude Code permissions
   syntax (use the /permissions command or consult the docs) rather than
   guessing, and show me the final file.

4. Report what you created, in 5 lines or fewer.
```

---

### STAGE 1 — Audit (read-only)

**Before pasting:** start a fresh conversation and switch to **plan mode**
(press Shift+Tab until the mode indicator shows plan mode).

### C1 — Audit everything that differs between clients

```
STAGE 1: audit only. You are in plan mode; do not change anything.

Use parallel read-only subagents (Explore) to investigate sections A to E
below at the same time, then merge their findings into ONE report in plain
English. For each section give a rough count, 3 to 5 example file
locations, and a verdict: "already config-friendly", "partly", or
"hardcoded". Verify any claim a subagent makes by opening the file
yourself before putting it in the report.

A. BRANDING: organization name, logo files, favicon, colors (hex values),
   fonts, and club-specific wording ("club", "iClub", "MED-ASU", "Ain
   Shams", "Innovation Club") across members-portal, public-website,
   emails (backend/assets/email, emailService.ts, certificate and ticket
   email services), certificate PDFs (certificatePdfService.ts), and the
   PWA manifest.
B. ROLES AND HIERARCHY: how backend/lib/authorityFlags.ts, teamRoles.ts,
   and every permission check work. Find any check that compares a role
   or team NAME (e.g. "President", "Administration", "Fundraising")
   instead of a generic flag. List each one.
C. LOGIN IDENTIFIER: everywhere a student ID, university email domain, or
   emailDomains.ts is assumed (login, setup-password, complete-profile,
   registration, member creation, validation, public forms, and database
   fields that are required or unique). Also how phone numbers are handled
   today (phoneUtils.ts).
D. FEATURES: every major module (events, certificates, finance, projects,
   tasks, alumni, site content editors, support, notifications, dashboard
   widgets) and whether each can currently be switched off without
   breaking anything, including its backend routes.
E. DEPLOYMENT: how deploy.yml and the Dockerfiles pass configuration
   (secrets, Variables, build args), and which values are baked in at
   build time versus read at runtime.

End with a table: item | where it lives | effort to make configurable
(small/medium/large).

CHECKPOINT 1: Use the question tool to ask me these together:
 1. Customization level: (a) re-brand only, (b) re-brand + feature on/off,
    (c) re-brand + features + different hierarchy and login identifier per
    client. Recommend one. My expectation is (c), because Dr. Ashraf's
    company has a CEO and board instead of president/VP and uses phone
    numbers instead of student IDs.
 2. Login identifiers: should each client allow exactly one type, or
    several (for example phone OR email)?
 3. For every role-name check found in section B: do I agree to convert
    them to generic flags?
Wait for my answers. Save the report and my answers to
docs/client-profiles-audit.md so later stages can read them, even after
/clear.
```

---

### STAGE 2 — Build the configuration layer

**Before each prompt:** `/clear`, exit plan mode, and make sure you are on
`feat/client-profiles`. Each prompt begins by reading the audit file.

### C2 — Client profile and typed config loader

```
Read docs/client-profiles-audit.md first (it holds the Stage 1 report and
my answers), then build the client-profile system:

1. Create clients/ at the repo root with club.json (matching today's
   behavior exactly, extracted from the audit) and example-client.json
   (used only for testing).
2. A profile contains NON-SECRET data only, in these groups:
   - identity: displayName, shortName, websiteName
   - theme: colors, fonts, border radius, logo/favicon paths, and any
     other token found in the audit
   - terminology: words that differ per organization (e.g. "member" vs
     "employee", "club" vs "company", "team" vs "department")
   - features: an on/off value per module from audit section D
   - auth: loginIdentifier ("studentId" | "phone" | "email"), allowed
     email domains if any, password rules
   - hierarchy: display names for leadership levels, mapped to the
     generic flags already used by the permission code
3. A typed, validated loader in packages/shared that reads CLIENT_ID,
   loads the matching profile, validates it (clear error for a missing or
   wrong field), and exports one object used by the backend and both
   frontends. A missing CLIENT_ID means "club".
4. Make it work on the server and in browser builds. Next.js bakes
   NEXT_PUBLIC_* values in at build time, so the frontends read
   NEXT_PUBLIC_CLIENT_ID.
5. Add unit tests for the loader (valid profile, missing field, unknown
   client, default to club).

CHECKPOINT 2: Explain in plain language that the profile is compiled in at
build time, so a theme change means redeploying that client's Spaces, and
offer the alternative (theme stored in the client's database and fetched
at runtime, which avoids redeploys but adds a database call and more
code). Use the question tool; recommend one. Wait for my answer, then
continue accordingly.

When done: run typecheck, lint, and tests, report real results, and stop.
I will ask you to commit.
```

### C3 — Apply branding and terminology from the profile

```
Read docs/client-profiles-audit.md and clients/club.json, then replace
every hardcoded branding value from audit section A with values from the
config loader:

1. Convert colors, radius, and fonts to CSS custom properties set from the
   profile theme at the root of each app, and update existing CSS to read
   them. Follow docs/css-standards.md.
2. Replace hardcoded names and wording in UI text, emails, certificate
   PDFs, the PWA manifest, page titles, and metadata with profile values.
3. Load logos and favicons from the profile paths; put the club's current
   assets in the club profile so nothing changes.
4. Keep changes small and mechanical per file. If the real scope is much
   larger than the audit estimated, stop and tell me before continuing.

Verification (required, actually run it):
 a. Start the apps locally with CLIENT_ID unset and confirm the club looks
    identical to before. List the pages you checked. If the Chrome or
    built-in browser tools are available, take screenshots; otherwise
    tell me which pages I should compare myself.
 b. Run with CLIENT_ID=example-client and show that name, colors, and logo
    change everywhere, including one email template and one generated
    certificate PDF.
Stop and report.
```

### C4 — Feature switches enforced in backend AND frontend

```
Using the features group in the profile:

1. BACKEND: add one middleware/helper (e.g. requireFeature("finance")) and
   apply it to every route module belonging to a switchable feature. A
   disabled feature must return a clear 404 or 403 on every route,
   including exports and WebSocket events.
2. FRONTEND: hide navigation items, dashboard widgets, buttons, and
   routes for disabled features in members-portal and public-website;
   direct visits to disabled pages must show the normal not-found page.
3. Handle feature dependencies (for example, disabling events must also
   deal with certificates linked to events). List the dependencies you
   found and how you handled each.
4. Add automated tests proving that with a feature off, its API routes
   are blocked even for the most privileged account.

Run the tests and report real results. Finish with a simple table of what
each switch controls, saved to docs/feature-switches.md.
```

### C5 — Hierarchy and permissions without hardcoded names

```
Read docs/client-profiles-audit.md (sections B and my Checkpoint 1
answers), then:

1. Convert every role-name comparison into a generic flag check, keeping
   behavior identical for existing club accounts.
2. Make the role and team structure data-driven: a new client's CEO, board
   of directors, and departments become ordinary database rows (teams,
   roles) that map to the same generic flags (isAdmin, isOfficer,
   isLeadership, and so on), with no code edits.
3. Use the profile's hierarchy names for display wording only.
4. Add tests showing a second structure ("CEO + Board") receives the
   correct permissions through the same flags.

CHECKPOINT 3: If any permission rule cannot be expressed through generic
flags without changing behavior, list it, explain the options in plain
language, and ask me with the question tool. Wait for my answer.
Run tests and report real results.
```

### C6 — Login identifier (student ID vs phone vs email)

```
Read docs/client-profiles-audit.md (section C and my answers), then make
the login identifier configurable through the profile's auth group:

1. If student ID must become optional at the database level, explain the
   Prisma migration to me in plain language BEFORE creating it, and test
   it only against the LOCAL development database. It must not break
   existing club data.
2. Registration, setup-password, and login must use the profile's
   identifier: studentId (current behavior), phone, or email. Reuse
   phoneUtils.ts so the same number written different ways matches one
   account.
3. Keep rate limits and brute-force protections on every identifier type.
   Error messages must not reveal whether an identifier exists.
4. Public registration forms and the member directory must show correct
   field labels from the profile.
5. Add tests for each identifier type, including duplicates and
   badly-formatted input.

Do not weaken password hashing or session handling. If you notice a
security issue on the way, report it to me instead of silently changing
it.
```

### C7 — Per-client setup: seed scripts and first admin

```
A new client database starts empty. Build a seeding system driven by the
profile:

1. A command (e.g. pnpm --filter backend seed:client) that, given
   CLIENT_ID and a database, seeds default site content, support content,
   the team and role structure from the profile's hierarchy, and finance
   defaults only if the finance feature is on.
2. A safe way to create the FIRST administrator for a new client (a
   one-time script taking an identifier and temporary password from the
   command line), without using the developer backdoor. The temporary
   password must be forced to change on first login.
3. The seed must be safe to run twice (no duplicates, no overwriting real
   data), with a test proving it.

CHECKPOINT 4: Explain the first-admin approach in plain language and ask
me to confirm it with the question tool before you build it. Test only on
the local database.
```

---

### STAGE 3 — Deploy many clients from one repo

### C8 — Multi-client deploy workflow

```
Plan first (use plan mode), build only after confirmation.

Read .github/workflows/deploy.yml and docs/deployment.md, then design the
deployment so one release can deploy every client:

1. Each client becomes a GitHub "Environment" holding its own secrets and
   variables (HF space paths, HF token, DATABASE_URL, CLIENT_ID, and so
   on). Explain Environments in plain language.
2. The workflow deploys the club first, then other clients in order,
   running migrations and seed:support-content against each client's own
   database and passing CLIENT_ID to each deployment.
3. A failure at one client must never be silent or leave a half-deployed
   state unreported. Propose how failures are surfaced.
4. Leave hooks for the health check and rollback work in Phase D.

CHECKPOINT 5: Present the plan and ask, one question at a time, with the
question tool:
 a. Should every push deploy to all clients, or should client deployments
    happen only from a release tag I create manually, so Dr. Ashraf never
    receives half-finished work? Recommend one.
 b. Should the club always deploy first as a test, with client
    deployments waiting for my approval?
After my answers, implement it, but you cannot run GitHub Actions
yourself. So: validate the YAML syntax, show me the full diff in plain
English, and give me a step-by-step test plan I run myself (first on the
club only). Do not push.
```

### C9 — New-client runbook

```
Create docs/new-client-checklist.md, written for a non-developer, with
exact click-by-click steps and exact variable names, covering everything
needed to onboard one new client:

1. Create the Supabase project and copy the connection string.
2. Create the three Hugging Face Spaces (backend, members-portal,
   public-website) and set their Variables and Secrets (say which are
   Variables because Next.js needs them at build time).
3. Create the Resend domain, DNS records, and sender address.
4. Create the GitHub Environment and add its secrets.
5. Create clients/<id>.json from a template and set CLIENT_ID everywhere
   it is needed.
6. Run migrations, seed, and create the first admin.
7. Verify: health check, login, test registration, test email, test
   certificate, and the post-deploy asset checks already in
   deployment.md.
8. A "never do this" list (for example: never reuse another client's
   database, JWT secret, or Resend key).

Add a short "current limits" section reminding me to check Supabase and
Hugging Face free-tier limits before adding each new client.
```

### C10 — Final proof

```
Final verification for the whole phase. Run everything for real and report
actual output:

1. typecheck, lint, unit tests, and e2e tests across the repo.
2. Run two instances locally side by side (docker compose or local dev):
   CLIENT_ID=club and CLIENT_ID=example-client, each with its own local
   database. Give me a checklist of confirmed differences: name, theme,
   hierarchy, login identifier, disabled features blocked at the API
   level, emails and certificates branded correctly.
3. Confirm the club instance is unchanged from before this phase.
4. List anything you could not verify, shortcuts taken, and new risks
   introduced. Be honest, not reassuring.

Then give me a one-paragraph summary of what I should test by hand before
merging feat/client-profiles into main.
```

---
