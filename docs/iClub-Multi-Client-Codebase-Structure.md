# Multi-Instance Foundation (Claude Code edition)

**Goal:** Run iClub for several organizations (the club, Dr. Ashraf's
company, future clients) from ONE codebase, where every difference between
clients is stored as configuration or database data, never as copied or
edited code. Each client still gets its own database, Hugging Face Spaces,
and email domain ("multi-instance"). True multi-tenant (one shared
database) is deliberately NOT part of this phase.

### Decisions already made (do not re-ask these)

1. **One private GitHub repo, `main` branch only.** No client branches, no
   copied repos. Clients never see the source code. Work happens directly
   on `main` (owner decision, 2026-11-02: one developer + Claude, working
   sequentially). Because the next push deploys whatever is on `main`,
   **every commit must leave the app working and deployable**; unfinished
   work stays uncommitted or behind a default-off setting.
2. **A tenant is data, not code (decided 2026-11-02).** Anything a client
   could reasonably want to change — theme colors, logo, names, wording,
   links and addresses, contact details, feature switches, team/role
   structure, login identifiers — lives in **that client's own database**
   and is editable from an admin screen, not in a file in the repo. Each
   deployment already has its own database, so the database *is* the
   tenant's configuration. Code holds only defaults (today's club values)
   used when a setting has never been saved.
   `clients/<id>.json`, if kept at all, is a **seed template** read by the
   setup script (C7) to fill a new tenant's database, never read at
   runtime and never bundled into a deployment.
3. **Secrets never go in the repo.** Database URLs, JWT secrets, API keys,
   and Resend keys stay in Hugging Face Space secrets and GitHub
   Environment secrets.
4. **Defaults equal today's club behavior.** A database with no tenant
   settings saved must look and behave exactly like today's club, except
   for changes the owner explicitly approves (for example the color
   consolidation in `docs/css-standards.md` §13).
5. **Hiding is not protecting.** A disabled feature must be blocked in the
   backend API, not only hidden from menus.
6. **Two levels of switches.** The platform owner decides what a tenant
   *may* use (their plan/contract); the tenant's admins switch features on
   or off *within* that. Tenant admins can never enable something the
   owner has not allowed. Platform-level limits are stored where tenant
   admins cannot edit them (environment variable or an owner-only table).
7. **Client Spaces are private.** The deploy uploads source code to each
   Space, so "clients never see the source code" holds only while the
   Spaces are private. (Check the club's current Spaces as well.)
8. **Keep the existing deploy safety net.** `deploy.yml` already runs a
   health check after each upload, auto-reverts on failure, and records
   last-known-good tags (`deployed-backend`, `deployed-frontend`, ...).
   Multi-client work must extend these per client, never remove them.

### How Claude Code changes the way you run this phase

| Claude Code feature | How this phase uses it |
|---|---|
| **CLAUDE.md** (project instructions it re-reads every session) | The ground rules live there once. You never re-paste them, and they survive `/clear`. |
| **Plan mode** (read-only; it can look but not edit) | Stage 1 audits run in plan mode, so it physically cannot change code while auditing. |
| **Subagents** (helper agents with their own context) | The audit fans out across the repo in parallel without filling your main conversation. |
| **Question tool** (multiple-choice popups) | Every CHECKPOINT uses it, so you tap an answer or type your own. |
| **Task list** | Each stage shows its progress as a checklist you can watch. |
| **Permissions** (`.claude/settings.json`) | Blocks it from reading your secret `.env` files or pushing to GitHub. In the desktop app, edit the file directly (`/permissions` is terminal-only). Deny rules on file reads are a strong guard rail, not a sandbox: a shell command could still print a file, which is why CLAUDE.md also forbids it. |
| **Runs commands itself** | It runs typecheck, tests, and the local apps and reports real results, instead of describing what to run. |

**Working rhythm:**
1. Do **C0 once** (setup).
2. Run the prompts in order. You can either start a fresh conversation for
   each one or keep going in one conversation. Every prompt re-reads
   `docs/client-profiles-audit.md`, so nothing depends on chat memory.
   For a long run, a fresh conversation per stage keeps things faster.
3. After each prompt finishes, review the summary, then say "commit this"
   (it commits to `main`, giving you a rollback point; it is not pushed).
4. Never let it push to GitHub or trigger a deploy. You do that yourself
   after Stage 2 is fully verified.
5. Each prompt only counts as done when typecheck, lint, and tests pass,
   or when it has told you exactly which ones fail and whether they
   already failed on `main` before this phase.

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
   - A deployment must contain only its own clients/<id>.json, both in
     browser bundles and in files uploaded to Hugging Face.
   - Keep the deploy safety net in .github/workflows/deploy.yml (health
     checks, auto-revert, deployed-* tags). Extend it per client; never
     remove it.
   - Follow existing project rules: .cursor/rules/datetime.mdc and
     docs/css-standards.md. Build packages/shared before the backend
     (pnpm --filter @iclub/shared build).
   - Before a stage starts, record which tests already fail on main, so
     new failures can be told apart from old ones.

3. Create or update .claude/settings.json so these are denied: reading
   backend/.env, members-portal/.env.local, public-website/.env.local,
   any other .env* file except *.example files, and the commands git push
   and gh workflow run. First check the current Claude Code permissions
   syntax in the docs rather than guessing, and show me the final file.

4. Run typecheck, lint, and the unit tests once on the untouched branch,
   and save the results (which pass, which already fail) to
   docs/client-profiles-baseline.md.

5. Report what you created, in 5 lines or fewer.
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
   build time versus read at runtime. Also: which folders survive the
   "clean workspace" steps and each Dockerfile's COPY lines (a new
   clients/ folder must reach every build), the existing health checks,
   auto-revert, and deployed-* tags, and the single "production"
   Environment.
F. HARDCODED ADDRESSES: club-specific URLs, hostnames, and repo names in
   code or Dockerfiles (for example *.hf.space hosts, publicWebsiteUrl.ts,
   publicApiUrl.ts, GITHUB_REPO build args, email "from" addresses, CORS
   origins). For each, say whether it is already an environment variable.
G. ALREADY DATA-DRIVEN: what already lives in the database or seed files
   (site content, support content, teams/roles), so later stages reuse it
   instead of duplicating it in the JSON profile.

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

**Before each prompt:** exit plan mode and make sure you are on `main`
(C0's feature branch was merged into `main` on 2026-11-02). Each prompt
begins by reading the audit file.

### C2 — Tenant settings stored in the database

```
Read docs/client-profiles-audit.md (Stage 1 report, my answers, and the
"tenant is data" decision) and docs/css-standards.md §13, then build the
tenant-settings system. Everything a tenant may change lives in its own
database and is edited from an admin screen; code only holds defaults.

1. Design the settings data model (Prisma) and explain it to me in plain
   language BEFORE writing the migration. It must cover, at minimum:
   - identity: organization name, short name, website name, tagline,
     legal/copyright line, contact email(s), phone(s), postal address
   - links: social links, website URLs, any "official channel" links
     (reuse the existing SiteContent / SocialLink tables where they
     already fit instead of duplicating them — audit section G)
   - theme: the 11 --brand-* values from §13 (optionally generated from
     one base color, always stored as 11 explicit values), logo, icon /
     favicon, email header logo
   - terminology: words that differ per organization ("member" vs
     "employee", "club" vs "company", "team" vs "department"), with
     singular/plural forms
   - features: on/off per module (audit section D), in two levels —
     what the platform owner allows (not editable by tenant admins) and
     what the tenant enabled within that
   - auth: allowed login identifiers (several per tenant), allowed or
     official email domains, phone default country
   - email: sender display name and reply-to (the sending address itself
     stays an environment variable, because it must match the Resend
     domain)
   - currency for finance
   Use typed columns or a validated JSON document per group — recommend
   one at CHECKPOINT 2. Every field has a default equal to today's club
   value, so an empty table behaves exactly like today.
2. One backend service that reads settings (cached in memory, refreshed
   when an admin saves), validates them, and fills in defaults. Backend
   code (emails, PDFs, permission checks, auth) reads only through it.
3. A public read endpoint for the NON-sensitive subset the frontends
   need before login (name, theme, logos, terminology, enabled features,
   login identifiers), and an admin-only write endpoint with validation
   (including the WCAG contrast check from §13.1 rule 5).
4. Frontends: load the public settings on the server (no flash of the
   wrong colors or name) and apply the theme as CSS variables at the
   document root. The PWA manifest and theme-color become dynamic routes
   instead of static files.
5. Logos and icons uploaded by the tenant go through the existing storage
   service; keep the club's current files as the defaults.
6. Tests: defaults when nothing is saved, validation errors, cache
   refresh after save, admin-only write, public endpoint never returns
   sensitive fields.

CHECKPOINT 2: Present the data model (typed columns vs JSON document per
group), the caching approach, and which settings tenant admins may edit
vs only the platform owner. Use the question tool; recommend one; wait.

Do NOT build the admin editing screens yet beyond what is needed to test
— each later stage adds the screen for its own group.
When done: run typecheck, lint, and tests, report real results, and stop.
I will ask you to commit.
```

### C2.5 — Color token migration (from css-standards §13)

```
Read docs/css-standards.md §13. Migrate in small, reviewable commits:
1. Add the §13 tokens to BOTH apps' :root with identical names; keep
   --purple-* as aliases of --brand-*.
2. Fix the broken token references in §13.3 first (real bugs today).
3. Replace literals file by file with tokens; brand transparency becomes
   color-mix(). Server/export code reads the theme object instead of hex.
4. Delete the unused template folders listed in §13.6.
5. After each batch run pnpm color:audit, typecheck, lint, tests; take
   before/after screenshots of the affected pages and show me any
   visible change.
Finish when pnpm color:audit reports 0, then add --strict to CI.
```

### C3 — Apply identity, links, and terminology from tenant settings

```
Read docs/client-profiles-audit.md (sections A, F, G) and the tenant
settings service from C2, then replace every hardcoded identity value
with tenant settings:

1. Names and wording in UI text, page titles, metadata, emails,
   certificate PDFs, and the PWA manifest come from settings
   (identity + terminology). Colors are already handled by C2.5.
2. Every hardcoded link, address, email address, phone number, and
   social URL (audit sections A.7 and F) comes from settings or from the
   existing SiteContent tables. Seed defaults stay in one place only.
3. Hostnames that are deployment facts, not tenant choices (CORS origins,
   API URLs), come from environment variables with NO club fallback in
   production code; remove the always-allowed iclubmedasu origins.
4. Logos and favicons come from settings (club files as defaults).
5. Build the admin screen for identity, links, contact details and
   terminology, following docs/css-standards.md.
6. Keep changes small and mechanical per file. If the real scope is much
   larger than the audit estimated, stop and tell me before continuing.

Verification (required, actually run it):
 a. With no settings saved, the club looks identical to before (except
    approved §13 color changes). List the pages checked, with screenshots
    from the built-in browser.
 b. Save a test tenant's settings locally and show name, links, logo and
    wording change everywhere, including one email and one certificate
    PDF. Then restore the defaults.
Stop and report.
```

### C4 — Feature switches enforced in backend AND frontend

```
Using the features group in tenant settings (both levels: owner-allowed
and tenant-enabled):

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
each switch controls, saved to docs/feature-switches.md. Switches take
effect without a redeploy (they are read from the database). Build the
admin screen for switches; tenant admins see only what the owner allows.
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
3. Give each team a stored "kind" (admin / hr / finance / regular — my
   Checkpoint 1 answer) and each role a stored level, so tenant admins
   can rename teams and roles freely without breaking permissions. The
   club's existing rows get their kind by migration.
4. Build the admin screen to manage teams, roles, kinds and levels, with
   guards that prevent locking everyone out (at least one active admin
   must always remain).
5. Display wording for leadership levels comes from tenant terminology.
6. Add tests showing a second structure ("CEO + Board") receives the
   correct permissions through the same flags, and that renaming a team
   does not change anyone's permissions.

CHECKPOINT 3: If any permission rule cannot be expressed through generic
flags without changing behavior, list it, explain the options in plain
language, and ask me with the question tool. Wait for my answer.
Run tests and report real results.
```

### C6 — Login identifier (student ID vs phone vs email)

```
Read docs/client-profiles-audit.md (section C and my answers), then make
the login identifier configurable through the auth group of tenant
settings. First-time account activation must use the emailed one-time
setup link (see the open account-takeover finding in the audit) — do not
build on the current unverified setup flow.

1. If student ID must become optional at the database level, explain the
   Prisma migration to me in plain language BEFORE creating it, then show
   me the exact generated SQL and point out any line that drops, rewrites,
   or re-creates a column, index, or unique constraint. The migration must
   be additive only (no data loss, no reset). Test it only against the
   LOCAL development database, using a copy of realistic club-shaped data.
   Never run prisma migrate reset or db push against anything else.
2. Registration, setup-password, and login must use the
   identifiers allowed in settings: studentId, phone, and/or email. Reuse
   phoneUtils.ts so the same number written different ways matches one
   account.
3. Keep rate limits and brute-force protections on every identifier type.
   Error messages must not reveal whether an identifier exists.
4. Public registration forms and the member directory must show correct
   field labels from tenant settings.
5. Add tests for each identifier type, including duplicates and
   badly-formatted input.

Do not weaken password hashing or session handling. If you notice a
security issue on the way, report it to me instead of silently changing
it.
```

### C7 — Per-client setup: seed scripts and first admin

```
A new client database starts empty. Build a seeding system driven by a
seed template (clients/<id>.json — read only by this script):

1. A command (e.g. pnpm --filter backend seed:client) that, given
   CLIENT_ID and a database, seeds default site content, support content,
   tenant settings, the team and role structure (with team kinds), and finance
   defaults only if the finance feature is on.
2. A safe way to create the FIRST administrator for a new client (a
   one-time script taking an identifier and temporary password from the
   command line), without using the developer backdoor. The temporary
   password must be forced to change on first login. The script refuses
   to run if an administrator already exists, never prints the password,
   and reads it from a prompt or environment variable rather than a
   command-line argument (arguments end up in shell history and CI logs).
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
4. Keep the existing health checks and auto-revert, and make them
   per client: health URLs come from each Environment's variables, and
   known-good tags become per client (for example
   deployed-<client>-backend) so one client's deploy never moves another
   client's rollback point. Keep the club's existing tag names working.
5. Before each upload, delete every clients/*.json except that client's
   own, and fail the job if the health response reports a different
   client id than expected.
6. Review the concurrency group: one client's slow deploy should not
   cancel or silently queue behind another's without being reported.

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
   public-website) as PRIVATE Spaces, and set their Variables and Secrets
   (say which are Variables because Next.js needs them at build time).
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
2. Run two instances locally side by side (docker compose or local dev),
   each with its own local database: one with no settings saved (club
   defaults) and one seeded from clients/example-client.json. Give me a checklist of confirmed differences: name, theme,
   hierarchy, login identifier, disabled features blocked at the API
   level, emails and certificates branded correctly.
3. Confirm the club instance is unchanged from before this phase, and
   compare test results against docs/client-profiles-baseline.md.
   Confirm no deployment bundle contains another tenant's data.
4. List anything you could not verify, shortcuts taken, and new risks
   introduced. Be honest, not reassuring.

Then give me a one-paragraph summary of what I should test by hand before
I push main and deploy.
```

---
