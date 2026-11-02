# iClub Platform Roadmap — one platform, many organizations

**Goal:** Turn iClub into one shared platform ("pool" model) that serves
many organizations: the club, Dr. Ashraf's company, and future clients.
The owner creates a new organization from a local console in minutes;
its members use the organization's own portal domain
(`portal.ashraf.com`) and its visitors the organization's own website
domain (`ashraf.com`), both served by the same shared apps; and its
admins customize everything that belongs to them. No new servers,
databases, or deployments per client.

> Decided by the owner on 2026-11-02 after comparing pool, silo and
> bridge models: **pool**, because it is the industry-standard approach
> (Slack, Notion, Shopify), it is the most comfortable to run alone, and
> onboarding needs no per-client setup. No fixed deadline: quality first.
> The earlier per-client plan is in git history
> (`docs/iClub-Multi-Client-Codebase-Structure.md`).

---

## 1. Everything we agreed (the checklist)

Each item names the phase that delivers it (§6). Nothing here is dropped
without the owner's say-so.

### Layer 1 — the owner (you)

- [ ] **Owner console, run locally on the owner's laptop** (no public
      page): list all organizations, see their health and usage, create /
      suspend / reactivate / export / delete. (P3, P9)
- [ ] **Create an organization in minutes** from the console, as one
      guided checklist that remembers each step's status: create the
      organization (defaults seeded, first admin invited by email) →
      create its private GitHub storage repo → register its domains with
      Cloudflare and its sending domain with Resend → show the DNS records
      the client must add → check until everything is green. (P9, P10)
- [ ] **Everything recorded in the console** so nothing is forgotten or
      lost: each organization's domains, storage repo, Resend and
      Cloudflare ids and statuses, plan, notes. Platform keys (GitHub,
      Resend, Cloudflare, Hugging Face tokens) stored **encrypted** with a
      master password, plus an encrypted backup file kept elsewhere. (P9)
- [ ] **Edit all settings of any organization** from one page, including
      the ones the organization can edit itself. (P3)
- [ ] **Owner-only controls**, read-only for the organization: plan /
      price tier, which features are **available**, **limits** (members,
      storage, emails per month, events, …), status. (P3, P6)
- [ ] **Usage meters** per organization against its limits. (P6)
- [ ] **Separate owner sign-in** for the console, replacing today's
      developer backdoor. (P3, P9)
- [ ] **Connect an organization's domains** (website and portal) with a
      button; HTTPS issued automatically. (P10)
- [ ] **Audit trail**: every settings change records who, when, old → new. (P3)

### Layer 2 — each organization (their admins)

- [ ] **Turn features on/off** within what the owner made available. (P6)
- [ ] **Leadership structure** of their choice: officers + president/VP,
      CEO + vice + board of directors, departments, … Teams have a stored
      *kind* (admin / HR / finance / regular) and roles a *level*, so names
      are free text and permissions never depend on a name. Cannot remove
      the last admin. (P7)
- [ ] **Sign-up / login identifiers**: one or several of email, phone,
      student ID, with their rules (e.g. official email domain, phone
      country). (P8)
- [ ] **Brand colors**: pick one accent color → the 11-step scale
      (50 … 950) is generated, like today's purple scale; contrast is
      checked so text stays readable. The club keeps its exact hand-picked
      purples. (P4)
- [ ] **Logos and icons** (site, portal, emails, installed app). (P4)
- [ ] **Their own installed app**: the portal installed from
      `portal.ashraf.com` shows the organization's name, icon and colors. (P4)
- [ ] **Identity**: organization name, short name, tagline, copyright,
      contact emails, phones, postal addresses, social and other links. (P5)
- [ ] **Terminology**: "member"/"employee", "club"/"company",
      "team"/"department", leadership titles. (P5)
- [ ] **Site content** (About, Contact, Support — already built; becomes
      per organization). (P2, P5)
- [ ] **Emails sent from their own domain** (`noreply@ashraf.com`) once
      they add the DNS records shown; until then sent as "Ashraf's
      Company" from the platform's address with their reply-to. (P9)
- [ ] **Currency** for finance. (P5)

### Members and visitors

- [ ] **Each organization's portal on its own domain**
      (`portal.ashraf.com`): the login page is already branded, members
      sign in and are in their organization. Served by the one shared
      portal app, which picks the organization from the domain. (P2, P10)
- [ ] **Each organization's public website on its own domain**
      (`ashraf.com`), served by the one shared public-website app the same
      way. (P2, P10)
- [ ] **Temporary addresses** on the anchor domain so an organization can
      go live before connecting its own domain. (P10)
- [ ] **Secure first-time activation** by emailed one-time link (fixes
      the open account-takeover finding). (P1)

### Quality and safety (non-negotiable)

- [ ] **Isolation in layers**: automatic organization filter on every
      database call, database row-level security, cross-organization tests
      on every API route, sign-ins that only work on their own
      organization's domain, and a separate private storage repo per
      organization. (P2, P9)
- [ ] **Club unchanged** except changes the owner approved. (all)
- [ ] **No color literals**: everything through tokens
      (`docs/css-standards.md` §13, `pnpm color:audit` → 0); fix the 13
      broken token references; delete the unused template folders. (P4)
- [ ] **No club-specific hardcoded text, links or hosts** in code. (P5)
- [ ] **Disabled features and exceeded limits blocked in the backend**,
      not just hidden. (P6)
- [ ] **No account enumeration** in login messages; per-account rate
      limits; phone numbers normalized beyond Egypt. (P1, P8)
- [ ] **Emails, certificate PDFs, Excel exports, charts** use the
      organization's brand and name. (P4, P5)
- [ ] **Deploy safety net kept** (health checks, auto-revert, tags). (all)
- [ ] **Owner runbook** in plain language. (P10)

---

## 2. The picture

```
 members ──► portal.ashraf.com, portal.<club domain>, … ─┐
 visitors ─► ashraf.com, <club domain>, … ───────────────┴─► Cloudflare ─┬─► portal Space ──┐
                                                                         └─► website Space ─┤
 owner ────► console on the owner's laptop ── owner API ───────────────────────────────────┤
                                                                                            └─► backend Space ─► one database
                                                       backend ─► Resend (one account, a domain per org)    (rows tagged per org)
                                                       backend ─► GitHub (one private repo per org)
```

- **No public central domain.** The three Hugging Face Spaces keep their
  plain `.hf.space` addresses behind the scenes; people only ever see
  organizations' domains.
- **One anchor domain** owned by the platform owner (~$10/year), never
  shown to members or visitors. Cloudflare for SaaS needs it as the target
  that organizations' domains point to; it also provides the fallback
  email address and temporary addresses.
- **Cloudflare for SaaS** accepts each organization's domains, issues
  HTTPS, and forwards each visit (domain attached) to the right Space; the
  app looks up the organization from the domain. Cost: first 100 domains
  free, then $0.10/domain/month; each organization uses 2 (website +
  portal) ([plans](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/)).
- **Platform-wide accounts, one key each:** Hugging Face (3 Spaces),
  Supabase (1 database), Resend (a sending domain per organization; Pro is
  $20/month for 10 domains, Scale $90 for 1,000 —
  [pricing](https://resend.com/pricing)), Cloudflare, GitHub (a repo per
  organization). Adding an organization creates **no** new Spaces,
  databases or secrets.
- **Costs** stay on free tiers until there is a paying client: Supabase
  free = 500 MB database ([pricing](https://supabase.com/pricing)); free
  Spaces sleep when idle, so paid hardware before paying clients go live.

---

## 3. Decisions already made (do not re-ask)

1. **Pool model**: one database, one backend, one portal, one public
   website app, one console. Every organization-owned row has
   `tenantId` (code name; "organization" in the UI). Creating an
   organization is a button, not a deployment.
2. **Organization is data, not code.** Settings live in the database and
   are edited from screens; code holds defaults equal to today's club.
3. **Two levels of control**: owner decides availability, limits and plan;
   organization admins decide within that. Enforced in the API.
4. **Portal and public website on each organization's own domains**
   (`portal.ashraf.com`, `ashraf.com`) via Cloudflare for SaaS in front of
   the shared Spaces; the app picks the organization from the domain.
   Never path-based (`/org/...`). Temporary addresses on the anchor domain
   until the organization connects its own.
5. **Separate accounts per organization.** A person in two organizations
   has two accounts on two portal domains. No organization picker.
6. **Isolation in layers** (Prisma extension, RLS, cross-org tests,
   domain-bound sign-in, separate storage repo per organization).
7. **Brand scale generated from one accent color**; the club keeps its
   stored hand-picked scale.
8. **Generalize the existing About / Contact / Support customization**
   pattern for all settings screens.
9. **Owner holds all infrastructure accounts and bills clients.** One
   anchor domain (~$10/year) for Cloudflare, fallback email and temporary
   addresses.
10. **Secrets never in the repo or in organization settings.**
11. **Work directly on `main`; every commit stays deployable.**
12. **Keep the deploy safety net** in `deploy.yml`.
13. **Security first**: P1 is done before any second organization exists.
14. Approved earlier: merge near-duplicate colors, Gantt color follows the
    brand, delete unused template folders (`docs/css-standards.md` §13).
15. **Email per organization from its own domain** via the one Resend
    account; until verified: organization name as sender on the
    platform's address, organization reply-to.
16. **File storage: one private GitHub repo per organization** with
    `files/` and `user-data/` folders, one platform token for all repos.
    Each organization's record stores where its files live, so the club
    keeps its two existing repos and nothing is moved. (Supabase Storage
    is the upgrade path once there is revenue.)
17. **The console runs locally on the owner's laptop.** It keeps every
    organization's infrastructure details and setup status, automates the
    setup steps through the GitHub, Resend, Cloudflare and platform APIs,
    and stores platform keys encrypted with a master password (plus an
    encrypted backup).
18. **Installed app per organization**: name, icon and colors come from
    the portal domain it was installed from.

## 4. Still open (asked at their checkpoints)

Everything else is locked. Only these two remain, by the owner's choice:

| # | Question | Known so far | Phase |
|---|---|---|---|
| D3 | How the local console signs in and talks to the platform | Console is local; exact mechanism decided later (for example an owner-only API key used only by the console) | P3 |
| D4 | Settings storage shape | Decided later; all code reads settings through one settings service, so the shape can change without touching features | P3 |

---

## 5. What the code looks like today (measured 2026-11-02)

- 74 database tables, ~1,550 database calls in 61 backend files, all
  through one Prisma client (`backend/db.ts`) → automatic filtering can be
  added in one place.
- 2 raw-SQL calls bypass Prisma (`lib/atomicJsonMerge.ts`,
  `services/emailOutbox.ts`) → filter by hand.
- 19 single-field uniqueness rules; ~9 become "unique within an
  organization" (member email/phones/student ID, team name, event and
  project slugs, project type, incident report type).
- RLS already enabled on every table (`prisma/sql/enable-public-rls.sql`).
- Background work: one email outbox worker, one WebSocket server.
- Files stored in a GitHub repository, paths not organization-scoped.
- Findings: `docs/client-profiles-audit.md`; colors:
  `docs/css-standards.md` §13; baseline: `docs/client-profiles-baseline.md`.

---

## 6. Phases

Every phase: small steps, typecheck + lint + all tests, real results,
plain-language summary, commit on `main` only when the owner says so.
Migrations are additive, run locally only, SQL shown first. The club keeps
working after every commit.

### P0 — Setup, audit, color inventory ✅ done

### P1 — Secure account activation

First-time activation and profile completion need an emailed one-time
link (single use, ~1 hour) sent to the email on file. `/setup-password`,
`/complete-profile`, `/complete-officer-profile` stop accepting an
identifier alone. Per-account rate limits beside per-IP ones. Tests prove
knowing a student ID is no longer enough.

### P2 — Organization foundation (the club becomes organization #1)

1. **Proof first:** buy the anchor domain; a test domain → Cloudflare →
   the current public-website and portal Spaces, showing the requested
   domain over HTTPS. If it fails, stop and re-plan before touching the
   database.
2. `Tenant` (organization) table; the club created as #1 by migration.
3. `tenantId` on every organization-owned table, staged: add nullable →
   backfill with the club → required → uniqueness rules become
   `(tenantId, …)`.
4. Every request knows its organization from the domain (portal and
   public website); the login token also carries it, and the two must
   match. Sign-in cookies belong to the organization's portal domain
   (today some sign-in calls go straight to the backend's address — move
   them behind the portal's own domain). The backend accepts browser
   requests only from verified organization domains.
5. Prisma extension adds the organization filter to every read and write;
   calls without an organization context fail loudly. Raw SQL filtered by
   hand. RLS policies underneath.
6. Organization-aware email outbox, WebSocket channels, push
   subscriptions, usage events, site content, and file storage (each
   organization's record says which repo(s) and folders hold its files).
7. Portal and public website resolve the organization from the domain;
   unknown domains get a neutral "not found" page.
8. Cross-organization test suite on every API route, export, download,
   realtime event and public page.

### P3 — Settings service, owner console, organization settings

**CHECKPOINT D3, D4.** One settings model per organization for every
group in §1; club defaults; one cached backend settings service; public
endpoint for the safe subset; owner-only fields enforced in the API;
audit trail. Owner console (list, create, select → all settings on one
page) and the same settings page inside each organization's portal with
owner-only fields read-only. Built on the About / Contact / Support
editor pattern.

### P4 — Theme and brand

Accent → generated scale with contrast check; color migration to tokens
until `pnpm color:audit` is 0 (then strict in CI); broken tokens fixed;
unused template folders deleted; theme applied on the server (no flash);
logos and icons per organization; emails, PDFs, Excel and charts themed;
installed-app details (name, icon, theme color) served per portal domain.

### P5 — Identity, terminology, links, currency

Every name, word, contact detail, address, link and currency from
settings; club-specific hosts removed from code (CORS, fallbacks).

### P6 — Features and limits

Two-level switches enforced in backend and frontend, with dependencies;
limits enforced with clear messages and usage meters;
`docs/feature-switches.md`.

### P7 — Leadership structure

Team kinds and role levels replace ~45 name checks; free renaming;
last-admin guard; `requireAdmin` behavior preserved for the club; a
"CEO + vice + board" test organization gets the right permissions.

### P8 — Login identifiers per organization

One or several of email / phone / student ID with rules; builds on P1;
phone normalization beyond Egypt; no enumeration; duplicates handled
within and across organizations.

### P9 — Local console and organization lifecycle

The console app on the owner's laptop: encrypted key store with master
password and backup; organization list with health and usage; the
"new organization" checklist (create organization + seed + invite first
admin → create private storage repo → Resend sending domain → Cloudflare
hostnames → show DNS records → verify until green), each step automated
through its API and its status saved; suspend, export, delete with grace
period. Per-organization email from its own domain with the fallback
sender. The developer backdoor is removed.

### P10 — Domains and operations

Cloudflare for SaaS on the anchor domain; connect-domain step in the
console for website and portal; temporary addresses; installed app per
organization verified; single deploy pipeline with its safety net;
`docs/owner-runbook.md` (plain language, with a "never do this" list);
free-tier check before each new organization.

### P11 — Final proof

Everything run for real (typecheck, lint, unit, e2e, cross-organization
suite, `pnpm color:audit --strict`); two organizations side by side with
confirmed differences and confirmed isolation; club unchanged versus the
baseline; honest list of what could not be verified and remaining risks.
Then tick every box in §1.

---

## 7. How we work

One phase at a time, in order. Checkpoints use the question tool with a
recommendation first. At the end of each phase: summary → owner says
"commit this" → commit on `main` (never pushed by Claude). The owner
pushes and deploys. Production migrations happen only through the deploy,
after the owner has seen the SQL.
