# Security Strategy

Defense-in-depth guide for the iClub platform: threat model, AI pentest tools (Shannon / Strix), what Phase 0–1 already hardened, CI automation, and how Phases 2–4 fit together.

**Companion runbook:** step-by-step staging commands, env vars, and tool install live in [security-pentest.md](./security-pentest.md). Use this page for the *why* and the operating model; use that page when you are about to run a scan.

Related: [deployment.md](../deployment.md), [setup.md](../setup.md), [api.md](../api.md), [.github/SECRETS.md](../.github/SECRETS.md).

---

## 1. Overview and threat model

### Stack under attack

| Surface | What it is | Typical exposure |
|---------|------------|------------------|
| Public website | Next.js marketing / events site | Public Hugging Face Space |
| Members portal | Authenticated Next.js app | Public HF Space URL (login-gated) |
| Express API | JWT auth, RBAC, finance, files, certificates | Public HF Space (`/api`, `/health`) |
| Postgres | Supabase-managed | Private DB; Prisma uses `DATABASE_URL` |

Deploy topology and env vars: [deployment.md](../deployment.md).

### Why private hosting ≠ security

Moving API/portal off public Hugging Face Spaces (or making Spaces private) reduces **casual source scraping** and noisy probes against a well-known free host. It does **not**:

- Fix broken authorization (IDOR, admin RBAC bypass)
- Stop attackers who only need a live URL
- Replace rate limits, CORS allowlists, or secret hygiene
- Make Supabase safe if anon keys + permissive RLS policies exist

Treat hosting changes as **Phase 3 hardening**, not as the security model. Public source on HF means anyone can read how auth and `/api/public` work — authz bugs, leaked secrets, and misconfig are the real risks, not “hiding” the repo.

### Realistic goal

“Maximum security” is not attainable. The program is **defense in depth**:

1. Fix known hotspot classes (Phase 0)
2. Automate cheap continuous checks (Phase 1)
3. Periodically prove exploits against **staging** with AI agents (Phase 2)
4. Harden hosting / RLS when budget allows (Phase 3)
5. Optional paid human pentest using AI findings as a brief (Phase 4)

**Never** point mutative exploit agents at production `*.hf.space`, production Supabase, or real member accounts.

---

## 2. Shannon and Strix

Both are real, widely used open-source **AI penetration-testing agents** (developer tools you run yourself, plus optional paid platforms). They are not a substitute for SOC2/ISO evidence alone, and findings vary by auth setup and orchestration — treat proven PoCs as high-signal leads, not a complete audit.

| Tool | Upstream | What it is | Best fit here |
|------|----------|------------|---------------|
| **Shannon** | [KeygraphHQ/shannon](https://github.com/KeygraphHQ/shannon) | White-box: reads source, then tries to prove bugs with real exploits | Strong — monorepo + Docker + APIs |
| **Strix** | [usestrix/strix](https://github.com/usestrix/strix) | Agents attack apps and report bugs with working PoCs; simpler CLI; hosted option at app.strix.ai | Strong for web/API; good first pass |

### How they differ

```text
Source + staging URL
        │
        ▼
   Recon / attack surface
        │
        ├─ Shannon: hypothesize from code (white-box), then exploit
        └─ Strix: agentic attack with PoC-gated reporting
        │
        ▼
   Report only (ideally) proven issues
```

| Dimension | Strix | Shannon |
|-----------|-------|---------|
| Speed to first PoCs | Usually faster | Often longer (full white-box pipeline) |
| Source awareness | Can take `-t` source trees | Designed around repo + config + live URL |
| Typical cost | LLM tokens — often single digits to low tens of USD per deep run | Similar or higher |
| Suggested order | Run first (focused instruction) | Run second for deeper code-guided exploitation |

You pay mainly for **LLM API tokens**, not a $50k human engagement. Shallow modes cost less and miss more.

### When to use which

- **Strix first** — focused instruction on auth/JWT/IDOR/RBAC/`/api/public`, with test member + admin credentials.
- **Shannon next** — same staging stack + monorepo root; use [`docs/security/shannon-iclub.example.yaml`](./shannon-iclub.example.yaml) (copy to gitignored `shannon.local.yaml`).
- **Neither against production** — only local Compose or a dedicated non-prod host with throwaway DB/secrets.

Full install, env tables, and commands: [security-pentest.md — Phase 2](./security-pentest.md#phase-2--ai-pentest-against-staging).

### Scan status for this repo

As of the runbook dry-run note (2026-07-20), **full Shannon/Strix scans were not completed** on the authoring workstation (Docker / LLM keys missing). Do not invent scan results. After a real run, attach tool artifacts (`strix_runs/`, Shannon workspace reports) to tickets — never paste fabricated PoCs.

---

## 3. Defense-in-depth program (Phases 0–4)

| Phase | Name | Status intent | Owner activities |
|-------|------|---------------|------------------|
| **0** | Hotspot hardening | Done / maintain | Fail-closed secrets, rate limits, Helmet, CORS allowlist, lock debug routes |
| **1** | CI automation | Wired in repo | Dependabot, Semgrep CE, Gitleaks; keep `pnpm audit` |
| **2** | AI pentest (staging) | Run when Docker + keys ready | Compose staging → Strix → Shannon → fix PoCs → re-run |
| **3** | Hosting + RLS | When budget / ops allow | Private host or private Spaces; WAF; verify Supabase RLS |
| **4** | Human pentest | Optional | Scoped engagement; AI reports as appendix |

### Success criteria

- Critical auth / IDOR / injection issues fixed and re-validated on staging
- CI blocks known vulnerable deps and obvious secret commits
- At least one successful Strix and/or Shannon run against **staging** with a written remediation log
- Production: no debug DB probes, no default JWT secrets, rate limits on public writes

### Explicit non-goals

- Exploit agents against live production HF Spaces
- Claiming “secure” after one scan or after “going private”
- Relying on private hosting alone

---

## 4. What we already hardened (Phase 0)

Verified against current backend code. Prefer linking to source over assuming chat history.

### JWT and developer backdoor — fail closed

[`backend/lib/securityEnv.ts`](../backend/lib/securityEnv.ts):

- `resolveJwtSecret()` — **required** when `NODE_ENV=production`; missing secret throws at startup (`backend/server.ts` calls this early). Non-production may use an insecure local fallback for tests only.
- `resolveDeveloperCredentials()` — enabled only when both `DEVELOPER_EMAIL` and `DEVELOPER_PASSWORD` are set; in production the backdoor stays **off** unless `ALLOW_DEVELOPER_BACKDOOR=true`. No hardcoded credential fallbacks.

Env documentation: [`backend/.env.example`](../backend/.env.example), [deployment.md](../deployment.md).

### Rate limits

[`backend/middleware/rateLimit.ts`](../backend/middleware/rateLimit.ts) (`express-rate-limit`; app sets `trust proxy`):

| Limiter | Window | Max | Applied on |
|---------|--------|-----|------------|
| `identityCheckLimiter` | 5 min | 60 | `check-email`, `check-student-id`, `check-officer-identifier` |
| `credentialPostLimiter` | 15 min | 40 | `/login`, setup/complete-profile, update-invited-profile |
| `passwordResetLimiter` | 15 min | 10 | `/forgot-password`, `/reset-password` |
| `contactPostLimiter` | 1 h | 10 | `POST /api/public/contact` |
| `incidentReportPostLimiter` | 1 h | 10 | `POST /api/public/support/incident-reports` |
| `registrationPostLimiter` | 1 h | 30 | Event registration writes |
| `publicCertificateReadLimiter` | 15 min | 60 | Unauthenticated certificate list/verify reads |

### Helmet and CORS

[`backend/server.ts`](../backend/server.ts):

- **Helmet** enabled (CSP left to frontends; `crossOriginResourcePolicy: cross-origin` for API file downloads).
- **CORS** is an explicit allowlist: localhost portal/web ports, hardcoded production HF portal/web origins, plus `FRONTEND_URL` and comma-separated `FRONTEND_ORIGINS`.
- Production no longer allows arbitrary `*.hf.space`. Dev-only: private LAN origins for mobile testing.
- Members portal on HF uses same-origin `/backend-api` BFF proxy (server → backend) because Spaces edge OPTIONS often omit `Access-Control-Allow-Credentials`.
- `credentials: true` for cookie-based auth across portal ↔ API hosts (direct CORS still required for non-proxied clients).

### Debug `/test-db`

Registered **only when** `NODE_ENV !== "production"`. Production builds must not expose this probe.

### Auth token extraction

[`backend/middleware/auth.ts`](../backend/middleware/auth.ts):

- Prefer `Authorization: Bearer` then httpOnly `token` cookie.
- Query-string `?token=` is **opt-in** (`allowQueryToken: true`) for documented cases only (WebSocket upgrade fallback; some file download/`<a href>` navigations).

Login sets an httpOnly `token` cookie via `backend/routes/auth.ts`. **Production** uses `SameSite=None` + `Secure` for cross-origin HTTPS portal ↔ API (e.g. HF Spaces). **Non-production** uses `SameSite=Lax` + non-`Secure` so cookies work on plain HTTP LAN mobile testing (`http://192.168…`); do not deploy non-production cookie flags to production HTTPS hosts.

### Residual risks (still open)

| Risk | Why it matters | Notes |
|------|----------------|-------|
| **JWT in `localStorage` (PWA only)** | XSS can still steal a bearer token when the installed PWA rehydrates `auth_token` | **Regular browser tabs** no longer read/write `localStorage` or send `Authorization: Bearer`; they rely on the httpOnly cookie only ([`members-portal/src/services/api.ts`](../members-portal/src/services/api.ts)). **Installed standalone PWA** still keeps a bearer copy because `SameSite=None` cookies are unreliable in some iOS standalone contexts — deliberate tradeoff, not full cookie-only. Prefer cookie-only for PWA too once device-verified. |
| **Query-string tokens** | Leak via Referer, logs, screenshots | Still used as WS / download fallback when a bearer token is available. Prefer cookie on WS upgrade when possible ([`RealtimeContext.tsx`](../members-portal/src/context/RealtimeContext.tsx)). |
| **Certificate template GitHub paths** | Privileged users could point a **new** template at an arbitrary path if create accepted `backgroundImagePath` | **CREATE** now always stores `null` background path/SHA; assignment only via allowlisted `PATCH`/`PUT` (`isValidTemplateBackgroundPath`). |
| **Developer backdoor JWT lifetime** | A token issued when the backdoor was enabled carries `isDeveloper` until expiry | Privilege gates (`requireDeveloperOnly`, developer short-circuits on admin/site-content) re-check `ALLOW_DEVELOPER_BACKDOOR` in production so disabling the flag revokes developer elevation immediately. |
| **Public HF + public source** | Attackers know routes and auth design | Mitigate with authz tests and Phase 2 staging scans, not obscurity. |
| **Verbose 500 messages** | Some route handlers may still return `err.message` to clients | Global middleware is generic in production; prefer the same in remaining route catch blocks. |
| **AI pentest not yet run** | Unknown PoCs remain | Complete Phase 2 when Docker + LLM keys are available. |

Portal sessions: **web = cookie-only**; **installed PWA = cookie + localStorage/Bearer** for reliability. Treat the residual risks above as source of truth until the PWA surface is cookie-only as well.

---

## 5. CI security (Phase 1)

Configs live under [`.github/`](../.github/). Enablement notes: [.github/SECRETS.md](../.github/SECRETS.md) (section **Security automation**). Deploy secrets (`HF_*`, `DATABASE_URL`) are unchanged and still required only for deploy/migrate jobs.

### Dependabot

- Config: [`.github/dependabot.yml`](../.github/dependabot.yml)
- Weekly PRs for the pnpm workspace root (`package-ecosystem: npm`, directory `/`) and GitHub Actions.
- **Enable:** once on the default branch, Dependabot runs automatically. Confirm **Settings → Code security → Dependabot**; turn on **Dependabot alerts** and **Dependabot security updates** if needed.

### Semgrep CE (SAST)

- Workflow: [`.github/workflows/semgrep.yml`](../.github/workflows/semgrep.yml)
- Pinned image `semgrep/semgrep:1.127.1`; rulesets `p/typescript`, `p/javascript`, `p/nodejs`, `p/react` (not `auto`).
- Ignore paths: [`.semgrepignore`](../.semgrepignore).
- **Why not CodeQL by default?** CodeQL code scanning on **private** repos needs GitHub Code Security / Advanced Security (paid). Semgrep Community Edition does not.
- Optional: `SEMGREP_APP_TOKEN` only if adopting Semgrep AppSec Platform (not required for CE).

### Gitleaks (secret scanning in CI)

- Workflow: [`.github/workflows/gitleaks.yml`](../.github/workflows/gitleaks.yml)
- Runs Gitleaks Docker image on full git history (no org license required — avoids `gitleaks-action` org licensing).
- Historical allowlist: [`.gitleaksignore`](../.gitleaksignore) — only for a deleted sample `JWT_SECRET` under `backend/azure-deployment-notes.md`. If that value was ever used in production, **rotate `JWT_SECRET`** on the backend HF Space; allowlisting only silences CI.
- Also enable **GitHub secret scanning** in repo settings when available (public: usually on; private: may need Secret Protection / Advanced Security).

### Existing audit

- `pnpm audit --audit-level moderate` remains in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (`Security Audit` job).
- Unfixable community `xlsx` advisories may be listed under root `pnpm.auditConfig.ignoreGhsas` when no free patched release exists; prefer replacing `xlsx` later if export allows.

### After CI fails

1. Fix the finding or document an accepted risk with expiry.
2. Rotate any secret that Gitleaks / GitHub scanning caught (assume compromise).
3. Do not disable the workflow to “make green” without a tracked exception.

---

## 6. Running AI pentests (Phase 2)

**Canonical how-to:** [security-pentest.md](./security-pentest.md). Summary only here so commands stay in one place.

### Staging shape (Docker Compose)

Repo [`docker-compose.yml`](../docker-compose.yml):

| Service | Host URL |
|---------|----------|
| `db` | `localhost:5432` (`iclub` / `iclub_dev_password`) |
| `api` | `http://localhost:3000` |
| `portal` | `http://localhost:7860` |

Compose sets `JWT_SECRET=local_dev_secret_change_in_production` and `NEXT_PUBLIC_API_URL=http://localhost:3000/api`.

```bash
docker compose up --build -d
curl -s http://localhost:3000/health   # {"status":"ok"}
```

Create **staging-only** member + admin users; give both tools those credentials. Focus instruction: auth, JWT, IDOR, admin RBAC, `/api/public` abuse — never `*.hf.space`.

Prereq helper (does not attack anything):

```powershell
powershell -NoProfile -File ./scripts/security/check-pentest-prereqs.ps1
```

### Tool commands (pointers)

- **Strix:** `STRIX_LLM` + `LLM_API_KEY`; target `./backend`, `./members-portal`, `http://localhost:3000`, `http://localhost:7860`.
- **Shannon:** `ANTHROPIC_API_KEY`; `npx @keygraph/shannon@beta start -u http://localhost:7860 -r . -c ./shannon.local.yaml`.

Local config files with real passwords must stay gitignored (`shannon.local.yaml`, `strix_runs/` — see root `.gitignore`).

### Triage rule

Keep **proven PoCs only**. Fix → re-run → log remediation. Do not invent results for status reports.

---

## 7. Hosting hardening and Supabase RLS (Phase 3)

Full checklists: [security-pentest.md — Phase 3](./security-pentest.md#phase-3--hosting-hardening).

### Hosting topology (short)

- Prefer **private** HF Spaces for API + members portal, or move to Fly / Railway / Render / VPS.
- Keep marketing site public if needed.
- Staging must use a **separate** database and secrets — never production `DATABASE_URL` / `JWT_SECRET`.
- Rotate secrets that ever lived in git, example files, or public Space logs.

### CORS / WAF / headers (short)

- Keep `FRONTEND_URL` / `FRONTEND_ORIGINS` as exact production origins (already required; no `*.hf.space` wildcard in current code).
- Add edge WAF / rate limits in front of the API when you can.
- Keep Helmet; consider frontend CSP separately.
- Prefer httpOnly-only sessions where possible; portal web tabs are cookie-only, installed PWA still dual-stores bearer intentionally (see residual risks).

### Supabase RLS (short)

Prisma’s direct `DATABASE_URL` role bypasses RLS for the API process. RLS still matters for **Supabase anon/authenticated** access if project URL/keys leak.

Repo already:

1. Migrations enable RLS on app tables
2. Auto-enable for future `public` tables
3. [`backend/prisma/sql/enable-public-rls.sql`](../backend/prisma/sql/enable-public-rls.sql) + [`backend/scripts/enablePublicRls.ts`](../backend/scripts/enablePublicRls.ts) (wired into `prisma:migrate` / `prisma:deploy`)

Enabling RLS **without** policies denies non-owner roles by default (good). Confirm no broad `USING (true)` policies and that clients never embed `service_role`. Prefer public data via Express `/api/public`, not open Supabase tables.

SQL verification queries: [security-pentest.md — RLS checklist](./security-pentest.md#c-supabase-rls-verification).

---

## 8. Human pentest brief (Phase 4)

Copy the template from [security-pentest.md — Phase 4](./security-pentest.md#phase-4--human-pentest-brief-template) into an SOW or email. Attach Strix/Shannon reports as appendices. AI tools do **not** replace a scoped human engagement for formal assurance.

In scope (typical): auth/JWT, IDOR/RBAC, `/api/public`, file upload/storage, finance authz, staging misconfig.  
Out of scope (typical): production HF/Supabase, social engineering, volumetric DoS.

---

## 9. Operational checklists

### Before each release

- [ ] `JWT_SECRET` set in production HF Space (non-empty; app fails closed without it)
- [ ] `ALLOW_DEVELOPER_BACKDOOR` not `true` in production (or backdoor unused)
- [ ] `FRONTEND_URL` / `FRONTEND_ORIGINS` list every real browser origin
- [ ] `/test-db` absent on production (`NODE_ENV=production`)
- [ ] `/health` returns 200; smoke `GET /api/public/...` from a browser
- [ ] Login works with cookies; no unexpected CORS errors
- [ ] CI green: lint/typecheck/build, `pnpm audit`, Semgrep, Gitleaks
- [ ] Dependabot / audit PRs for critical CVEs reviewed or temporarily waived with an expiry
- [ ] No new secrets in client bundles (`NEXT_PUBLIC_*` must stay non-secret)
- [ ] Migrations applied; RLS enable script still part of migrate/deploy path

### After finding PoCs (AI or human)

1. Reproduce on staging with the attached PoC (request, script, or agent transcript).
2. Classify severity by impact (auth bypass / data leak / privilege escalation first).
3. Fix in a dedicated PR; add a regression test when practical.
4. Re-run the same tool instruction (or human retest) against staging.
5. Rotate credentials if tokens, passwords, or storage PATs were exposed.
6. Update this doc or the pentest runbook only if process or ports/env names changed — do not paste fake “clean scan” claims.

### Quarterly (recommended)

- [ ] One focused Strix (or Shannon) staging pass even if no major feature launch
- [ ] Review Supabase policies and HF Space variable leakage (logs)
- [ ] Revisit residual risks table (PWA localStorage/Bearer, query tokens, cert paths)

---

## Quick links

| Need | Where |
|------|--------|
| Staging Compose + Strix/Shannon commands | [security-pentest.md](./security-pentest.md) |
| Shannon example config | [shannon-iclub.example.yaml](./shannon-iclub.example.yaml) |
| Deploy / production env | [deployment.md](../deployment.md) |
| CI secrets + security workflow enablement | [.github/SECRETS.md](../.github/SECRETS.md) |
| Local ports (`pnpm dev`) | [setup.md](../setup.md) — API `:3000`, portal `:3001`, public `:3002` |
| Compose portal port | `:7860` (Docker image), not `:3001` |
