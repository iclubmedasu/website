# iClub Platform Roadmap — one platform, many organizations

**Goal:** Turn iClub into one shared platform ("pool" model) that serves
many organizations: the club, Dr. Ashraf's company, and future clients.
The owner creates a new organization from a console in minutes; its
members sign in through one central login page and land in their own
organization; its public website runs on the organization's own domain;
and its admins customize everything that belongs to them. No new servers,
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

- [ ] **Owner console**: list all organizations, see their health and
      usage, create / suspend / reactivate / export / delete. (P3, P9)
- [ ] **Create an organization in minutes** from the console: name,
      slug, plan, first admin's email → defaults seeded, first admin
      invited by email, site ready. (P9)
- [ ] **Edit all settings of any organization** from one page, including
      the ones the organization can edit itself. (P3)
- [ ] **Owner-only controls**, read-only for the organization: plan /
      price tier, which features are **available**, **limits** (members,
      storage, emails per month, events, …), status. (P3, P6)
- [ ] **Usage meters** per organization against its limits. (P6)
- [ ] **Separate owner sign-in** for the console, replacing today's
      developer backdoor. (P3, P9)
- [ ] **Add a custom domain** for an organization's public website with a
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
- [ ] **Identity**: organization name, short name, tagline, copyright,
      contact emails, phones, postal addresses, social and other links. (P5)
- [ ] **Terminology**: "member"/"employee", "club"/"company",
      "team"/"department", leadership titles. (P5)
- [ ] **Site content** (About, Contact, Support — already built; becomes
      per organization). (P2, P5)
- [ ] **Email sender name and reply-to**. (P9)
- [ ] **Currency** for finance. (P5)

### Members and visitors

- [ ] **One central login page.** A member types their email / phone /
      student ID; the platform finds their organization and takes them
      straight in. If the same identifier exists in more than one
      organization (rare), they pick the organization. (P2, P8)
- [ ] **Each organization's public website on its own domain**
      (`ashraf.com`), served by the one shared public-website app, which
      picks the organization from the domain. Organizations without a
      domain get `name.<your-domain>` until they have one. (P2, P10)
- [ ] **Secure first-time activation** by emailed one-time link (fixes
      the open account-takeover finding). (P1)

### Quality and safety (non-negotiable)

- [ ] **Isolation in three layers**: automatic organization filter on every
      database call, database row-level security, cross-organization tests
      on every API route. (P2)
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
 members ──► portal.<your-domain>  (one login page) ─┐
                                                     ├─► backend ─► one database
 visitors ─► ashraf.com, club domain, … ─► Cloudflare ─► public-website app ─┘   (every row
                                                     │                             tagged with
 you ──────► console (owner-only area) ──────────────┘                             its org)
```

- **Portal:** one address for everyone. Organization comes from the
  account, not the address.
- **Public websites:** many domains, one app. Cloudflare for SaaS is the
  front door: it accepts each organization's domain, issues HTTPS, and
  forwards the visit (with the domain attached) to the public-website
  Space, which looks up the owning organization and renders its site.
  Cost: first 100 domains free, then $0.10/domain/month
  ([plans](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/)).
- **Hosting:** the same 3 Hugging Face Spaces and 1 Supabase database as
  today, upgraded when load requires it. The owner holds all accounts and
  bills clients. Supabase free plan: 500 MB database; Pro is $25/month for
  the whole platform ([pricing](https://supabase.com/pricing)). Free Spaces
  sleep when idle — paid hardware before paying clients go live.

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
4. **Central login** with organization discovery. **Separate accounts per
   organization** (a person in two organizations has two accounts; the
   login page asks which one when an identifier matches several).
5. **Public websites on organizations' own domains** via Cloudflare for
   SaaS in front of the one public-website Space; subdomain of the owner's
   domain as fallback. Never path-based (`/org/...`).
6. **Isolation in three layers** (Prisma extension, RLS, cross-org tests).
7. **Brand scale generated from one accent color**; the club keeps its
   stored hand-picked scale.
8. **Generalize the existing About / Contact / Support customization**
   pattern for all settings screens.
9. **Owner holds all infrastructure accounts and bills clients.**
10. **Secrets never in the repo or in organization settings.**
11. **Work directly on `main`; every commit stays deployable.**
12. **Keep the deploy safety net** in `deploy.yml`.
13. **Security first**: P1 is done before any second organization exists.
14. Approved earlier: merge near-duplicate colors, Gantt color follows the
    brand, delete unused template folders (`docs/css-standards.md` §13).

## 4. Still open (asked at their checkpoints)

| # | Question | Recommendation | Phase |
|---|---|---|---|
| D3 | How the owner signs in to the console | Separate owner account (own table, own login, later two-factor); developer backdoor removed | P3 |
| D4 | Settings storage shape | Typed columns for what code enforces (features, limits, auth); validated JSON per group for display (theme, terminology, links) | P3 |
| D5 | Email sending per organization | One platform sending domain with organization name as sender and organization reply-to; own sending domain later as an add-on | P9 |
| D6 | File storage | Move from the GitHub repository to an object store before many organizations upload files | P9 |
| D7 | The platform's own name and domain | Needed for `portal.<domain>` and fallback subdomains; owner to choose | P2 |
| D8 | Installed app (PWA) identity | One installed app with the platform name; organization logo and colors after login | P4 |

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

1. **Proof first:** a test domain → Cloudflare → the current
   public-website Space, showing the requested domain over HTTPS. If it
   fails, stop and re-plan before touching the database. **CHECKPOINT D7.**
2. `Tenant` (organization) table; the club created as #1 by migration.
3. `tenantId` on every organization-owned table, staged: add nullable →
   backfill with the club → required → uniqueness rules become
   `(tenantId, …)`.
4. Every request knows its organization: from the login token (portal) or
   from the domain (public website). A token is useless for any other
   organization.
5. Prisma extension adds the organization filter to every read and write;
   calls without an organization context fail loudly. Raw SQL filtered by
   hand. RLS policies underneath.
6. Organization-aware email outbox, WebSocket channels, push
   subscriptions, usage events, file paths, site content.
7. Central login: identifier → organization(s) → straight in, or a picker
   when several match.
8. Public website resolves the organization from the domain.
9. Cross-organization test suite on every API route, export, download,
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
logos and icons per organization; emails, PDFs, Excel and charts themed.
**CHECKPOINT D8.**

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

### P9 — Organization lifecycle

Create in minutes (seed defaults, invite first admin by email), suspend,
export, delete with grace period, owner account replaces the developer
backdoor. **CHECKPOINT D5, D6.**

### P10 — Domains and operations

Custom-domain button in the console (Cloudflare for SaaS API), fallback
subdomains, single deploy pipeline with its safety net, per-organization
health and usage view, `docs/owner-runbook.md` with a "never do this"
list, free-tier check before each new organization.

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
