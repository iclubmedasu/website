# Client profiles — Stage 1 audit

Audited on 2026-11-02, branch `feat/client-profiles` at `541586d`.
Five read-only search helpers covered sections A–G in parallel; the key
claims below were re-checked by opening the files. Paths are relative to
the repo root. "Effort" is small / medium / large.

## A. Branding — verdict: partly (public site) / hardcoded (portal, emails)

- **Names and wording.** `public-website/src/lib/site.ts:2-17` already
  holds a `siteConfig` (name, tagline, contact, social links) used by
  layouts and the footer. The portal has no equivalent: about 22 page
  titles say `"… | iClub Members Portal"`, plus
  `members-portal/src/app/layout.tsx:11-33`,
  `members-portal/public/manifest.json:2-4`, `public/offline.html:7`,
  `PWAInstallPrompt.tsx:73-160`. "Ain Shams University" also appears in
  `public-website/src/content/home.ts:11,34` and `content/about.ts:5`.
- **Logos and icons.** Portal: 10 logos in `src/assets/` imported directly
  (login, forgot/reset password, `SideBarNavigationSlim.tsx:346`) and 15
  PWA icons. Public site: 3 logos referenced in `BrandLogos.tsx:3-4` and
  `Navbar.tsx:10`. Backend emails: 3 PNGs in `backend/assets/email/`.
- **Colors.** Tokens exist in both `globals.css` files, but they are named
  after the color (`--purple-900`, ~415 uses in the portal), and roughly
  550 hex values are hardcoded outside the token files in the portal
  (CSS + TSX, incl. Excel exports) and ~50 in the public site. Theme color
  `#662f91` is repeated in manifest and both public layouts.
- **Fonts.** Centralized in each app's `src/app/fonts.ts` (Poppins, Arimo);
  PDFs use `backend/assets/fonts/`. Easy to make configurable.
- **Emails.** Three services (certificate, event ticket, password reset)
  each copy ~300 lines of HTML with "iClub Med-asu", "Ain Shams
  University · Faculty of Medicine", the logos, and a duplicated purple
  palette. Default sender `asu.medicine.iclub@gmail.com`
  (`backend/services/emailService.ts:3`), overridable by
  `RESEND_FROM_EMAIL`. No sender-name setting.
- **Certificate PDF.** Only the no-template fallback is branded
  (`certificatePdfService.ts:185,707-708`); real templates live in the DB.
- **Not needing change:** code identifiers like `@iclub/shared`,
  `X-Iclub-*` headers. The `IHUB` social-platform enum value is
  club-specific but changing it needs a DB enum migration; leave it.

## B. Roles and hierarchy — verdict: partly

- Flags are computed in `backend/lib/authorityFlags.ts:39-89` and put in
  the login token. A generic number, `systemRoleKey`, already exists
  (1 Head, 2 Vice, 3 Member, 10 Officer, 11 President, 12 VP) and is
  checked alongside names almost everywhere.
- The portal menu and guards already use flags only
  (`members-portal/src/app/(protected)/layout.tsx:112-149`).
- **Name-based checks (~45 in 12 backend files, ~12 in the portal):**
  - Team named `"Administration"` decides officer/admin status
    (`authorityFlags.ts:21,59`), `requireAdmin`
    (`middleware/auth.ts:158`), `tasks.ts:39,86`, `members.ts:267`,
    `teams.ts` (hides it from the team list), `administration.ts`
    (auto-creates it), `publicMemberDirectory.ts`.
  - Role names `Officer / President / Vice President / Head of Team /
    Vice Head of Team` as fallbacks next to `systemRoleKey`
    (`authorityFlags.ts:63-79`, `documentPermissions.ts`,
    `documentAccess.ts`, `documentCategories.ts`, `auth.ts:238-241`).
  - HR team found by name aliases `"hr"`, `"human resources"`
    (`lib/supportPermissions.ts:5`) → support-forms editor.
  - Finance team found by name aliases `"fr"`, `"finance"`,
    `"accounting"`, … (`lib/financePermissions.ts:5-13`) → finance viewer.
  - Role type words `"Leadership"`, `"Regular"`, `"Special Roles"`
    (`teamRoles.ts:97-98`, portal role modals,
    `packages/shared/src/types/team.ts`).
  - Portal Administration page buttons by role name
    (`AdministrationPage.tsx:18,463,663-826`).
- **Behavior to preserve exactly:** `requireAdmin` lets in ANY active
  member of the Administration team (officers included), which is looser
  than the `isAdmin` flag (President/VP only).
- No hardcoded team or role IDs. No "Fundraising"/"Media" checks.
- **Developer backdoor** exists: `DEVELOPER_EMAIL`/`DEVELOPER_PASSWORD`,
  off in production unless `ALLOW_DEVELOPER_BACKDOOR=true`
  (`lib/securityEnv.ts:52-62`). The API middleware re-checks the gate on
  every request (`middleware/auth.ts:133-143`).
- **Fix direction:** add a "kind" to teams (admin / hr / finance /
  regular) so code asks "is this the admin team?" instead of comparing a
  name, and collapse the copied name fallbacks into one helper.
  Effort: medium.

## C. Login identifier — verdict: hardcoded

- `@med.asu.edu.eg` is hardcoded ~25 times in ~10 files
  (`backend/routes/auth.ts:62,185`, `members.ts:179`,
  `administration.ts:14`, portal login and member/officer modals).
- Database (`backend/prisma/schema.prisma`): `Member.email` required +
  unique (:15), `phoneNumber` required + unique (:18), `studentId Int?`
  unique and already optional (:20). Being a number, `studentId` cannot
  hold IDs with letters or leading zeros.
- New members are created from a student ID: email auto-set to
  `<id>@med.asu.edu.eg`, phone set to placeholder `pending-<id>`
  (`members.ts:184-245`).
- Login (`auth.ts:972`) already accepts email OR phone; a student ID is
  resolved to an email by `/check-email` first.
- `packages/shared/src/utils/emailDomains.ts` is only an autocomplete list
  of consumer domains (gmail, outlook, …). It does not restrict anything.
- `backend/lib/phoneUtils.ts` normalizes **Egyptian numbers only**; other
  countries pass through unchanged. A near-copy lives in
  `members-portal/src/utils/countryCodes.ts`. Event registration does not
  normalize phones at all.
- Rate limits (`backend/middleware/rateLimit.ts`) are per IP address only,
  e.g. 3000 identity checks / 15 min; nothing per account.
- Public event registration is already identifier-neutral (name + email).
- Effort: medium (string swaps are small; phone normalization for other
  countries and the studentId-to-email coupling are the real work).

### Security findings (existed before this phase — not changed)

1. **Personal data leak (important).** `POST /api/auth/check-email`
   (`backend/routes/auth.ts:344-428`) needs no login. For a member who
   has not set a password yet, it returns full name, phone numbers,
   secondary emails and member id. Student IDs are short sequential
   numbers and the limit is 3000 tries per 15 minutes per IP, so someone
   could collect this data for every member who has not activated.
2. **Account existence is revealed** by several endpoints
   (`/check-email`, `/check-student-id`, `/check-officer-identifier`,
   `/login` "Password not set", `/setup-password`). `/forgot-password`
   is correct. This is partly needed by the current multi-step login.
3. **Minor:** the session endpoint (`auth.ts:1126`) shows a developer
   profile for an old developer token even after the backdoor is
   switched off; real API calls are still blocked by the middleware.

## D. Features — verdict: hardcoded (no switches exist)

There are no feature flags anywhere. All routers are registered in
`backend/routes/index.ts:46-167`; the portal menu is in
`members-portal/src/app/(protected)/layout.tsx:38-110` and hides items by
role only (a hidden page is still reachable by URL).

| Module | Depends on | Easy to switch off? |
|---|---|---|
| Events (+ registrations, check-in, tickets, embed widget) | members, email, notifications | No: core; certificates, KPIs, dashboard, public site read it |
| Certificates | events, projects (optional links), email, PDF | Medium |
| Finance | nothing else | Yes, self-contained |
| Projects (+ files, photos) | teams, tasks, notifications | Medium |
| Tasks | projects, teams | Medium (dashboard, KPIs read it) |
| Personnel (teams, members, roles, administration) | — | No: core |
| Alumni | members | Small (gate built into the layout) |
| Site content editors | — | Yes (public site has fallbacks) |
| Support / incident reports / contact form | email | Yes |
| Notifications + push + WebSocket | — | Partly (push already off without VAPID keys) |
| Announcements | notifications | Yes |
| Documents | notifications, GitHub storage | Yes |
| Employee KPIs | tasks, events | Yes |
| Dashboard widgets | tasks, events, announcements, notifications | Per widget |

Realtime: one WebSocket at `/api/notifications/ws` sending
`resource.changed` events for events, projects, tasks. Email outbox worker
started at `backend/server.ts:162`. No cron jobs.

## E. Deployment — verdict: partly

- `.github/workflows/deploy.yml`: 4 jobs (migrate, backend, portal,
  public site), all in one GitHub Environment `production`; secrets
  `DATABASE_URL`, `HF_TOKEN`, `HF_SPACE`, `HF_FRONTEND_SPACE`,
  `HF_PUBLIC_SPACE`; variables `*_HEALTH_URL` with club fallbacks.
- Health checks + auto-revert + tags `deployed-backend`,
  `deployed-frontend`, `deployed-public` already exist — one tag per app,
  so a second client would overwrite the club's rollback point.
- The "clean workspace" steps delete named folders only, so a new
  `clients/` folder **would be uploaded to every Space** (with every
  client's profile).
- **No Dockerfile copies `clients/`**, so builds would not see it.
- Frontends bake `NEXT_PUBLIC_API_URL` (and the portal's
  `NEXT_PUBLIC_PORTAL_USE_BFF`) in at build time through Docker `ARG`s.
  Some other `NEXT_PUBLIC_*` variables the portal reads are not declared
  as `ARG`s (to check in C2).
- `docs/security/security.md:26` suggests the current Spaces are
  **public**; nothing in the repo confirms it either way.
- Effort: medium.

## F. Hardcoded addresses — verdict: partly

- **Always allowed CORS origins** `iclubmedasu-members-portal.hf.space`,
  `iclubmedasu-public-website.hf.space` (`backend/server.ts:37-38`) —
  must become environment-only.
- Club fallbacks when an env var is missing: `server.ts:94,159`,
  `emailService.ts:3`, `passwordResetEmailService.ts:13`,
  `members-portal/src/lib/apiBaseUrl.ts:30`,
  `members-portal/src/app/backend-api/[...path]/route.ts:32`,
  `public-website/Dockerfile:33` (`GITHUB_REPO=iclubmedasu/website`).
- Already config-friendly: `backend/lib/publicWebsiteUrl.ts`,
  `publicApiUrl.ts`, `public-website/src/lib/api.ts`, cookies (no fixed
  domain), CSP (no hostnames).
- Docs and `README.hf.md` files contain many club URLs (fine for the club;
  the C9 runbook will cover other clients).

## G. Already data-driven

| Area | Stored in | Club text in defaults? |
|---|---|---|
| Site content (about, contact, social) | DB, seeded from `backend/lib/siteContentDefaults.ts` | Yes |
| Support content | DB, seeded by `backend/scripts/seedSupportContent.ts` | Yes (EN + AR) |
| Certificate templates, ticket / ID-card designs | DB per event/template | No |
| Teams and roles | DB, but Administration and default roles are created by code | Generic English names |
| Finance | DB; currency `EGP` hardcoded in schema and `lib/finance.ts` | Currency |
| Email templates | Code | Yes |

## Summary table

| Item | Where it lives | Effort |
|---|---|---|
| Org name / wording (portal, manifest) | ~45 strings, page titles | medium |
| Org name / wording (public site) | `site.ts` + 5 files | small |
| Logos, favicons, PWA icons | 3 apps' `public/`, `assets/` | small–medium |
| Color tokens (rename to semantic) | both `globals.css`, ~630 uses | large |
| Hardcoded hex outside tokens | ~600 places | large (can be phased) |
| Fonts | `fonts.ts` ×2, `backend/assets/fonts` | small |
| Email templates | 3 backend services | medium |
| Certificate fallback text | `certificatePdfService.ts` | small |
| Site/support content defaults | seed files | small |
| Role-name checks → flags | ~12 backend files, ~5 portal files | medium |
| Login identifier + email domain | auth, members, administration, portal login | medium |
| Phone normalization beyond Egypt | `phoneUtils.ts` ×2 | medium |
| Feature switches | `routes/index.ts`, portal layout, public pages | medium |
| Currency | schema + `lib/finance.ts` | small–medium |
| Deploy per client | `deploy.yml`, 3 Dockerfiles | medium |
| Hardcoded CORS / URL fallbacks | ~8 places | small |

## Checkpoint 1 answers

Answered 2026-11-02:

1. **Customization level: (c)** — re-brand + feature switches + a
   different hierarchy and login identifier per client.
2. **Login identifiers: several per client.** Each profile lists the
   allowed types (e.g. club: studentId, email, phone as today; company:
   phone, email).
3. **Role-name checks: convert all** to generic flags, via a team "kind"
   (admin / hr / finance / regular) stored in the database. Existing club
   teams are assigned their kind by migration so permissions stay
   identical, including `requireAdmin`'s current looser rule.
4. **`/check-email` data leak: fix first, separately on `main`**, before
   continuing with Stage 2. Not part of `feat/client-profiles`.
