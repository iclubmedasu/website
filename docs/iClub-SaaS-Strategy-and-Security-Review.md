# iClub → SaaS: Strategy & Security Review

**Prepared:** July 2026
**Context:** iClub was built for the Innovation Club at the Faculty of Medicine, Ain Shams University. This document captures the plan for commercializing it as a SaaS product, starting with a pilot client (Dr. Ashraf's event management company).

**Note before anything else:** iClub was built in the context of a university club — before commercializing it, get clear (ideally in writing with the club) that this is your personal IP to license/sell, not the club's. Cheap insurance against an awkward conversation later.

---

## 1. Protecting the Code

**Problem:** The current setup (public GitHub repo + public Hugging Face Space) means anyone can read the entire source, including auth logic and route structure.

**Two distinct risks:**
- Someone copying the *running app's behavior* — low real-world risk for a small event company competitor.
- Someone copying the *actual source code* — real risk while the repo/Space are public.

**Action plan:**
1. **Make the GitHub repo private** before showing this to anyone outside the club. This is the single biggest lever.
2. **Use a private Hugging Face Space** for any commercial deployment (requires HF PRO), or move to a host with private-by-default hosting (Railway, Render, Fly.io).
3. **Fully separate infrastructure** for the free/public club deployment vs. the paid client deployment — different repo, different database, different host. Never let a paying client run on the same instance as the club.
4. **Legal protection matters more than technical protection here.** A signed agreement stating the software is proprietary, licensed (not sold), and may not be copied or redistributed protects you far more than code obfuscation does.

---

## 2. Liability & the Free Trial

**Original framing to avoid:** "It's a free trial, so nobody can blame me if something breaks." This doesn't hold up — a client (especially a perfectionist) will still be upset and the relationship/reputation damage happens regardless of payment status.

**Better framing:**
- Use a short, signed **trial agreement** before onboarding: software provided "as-is" during the trial, no warranty, no SLA, limitation of liability, explicit acknowledgment it's a beta product.
- Be upfront about what data he's trusting you with (attendee PII, if any payment info later) and what your backup/security posture actually is.
- Use the trial period to **gather structured feedback** — what breaks, what he complains about, what he uses most — rather than just hoping nothing goes wrong.

This is also the framing that converts a perfectionist into a paying customer: showing you've thought about failure modes professionally, not hiding behind "it was free."

---

## 3. Backups & Failover

**Database backups (do this — cheap, high value):**
- Check your DB provider's (e.g. Supabase) backup tier — paid plans typically include point-in-time recovery; free tiers often don't.
- Add an independent scheduled `pg_dump` to external storage as a second layer, regardless of provider backups.
- **Backup files contain plaintext PII** — they must be encrypted/access-controlled wherever they're stored, not just "somewhere safe."

**App failover — be realistic about scope:**
- True automatic failover (a live secondary instance with instant takeover) requires infrastructure (health checks, DNS failover, data sync) that isn't worth the maintenance burden for 1–2 clients.
- More realistic and honest: keep uptime monitoring (e.g. UptimeRobot) + a **documented manual recovery playbook** ("if the Space goes down, redeploy from last known-good backup within X minutes").
- Communicate this honestly to clients: "best-effort uptime, backups every N hours, manual recovery within X hours" is a normal, honest thing to tell a small-business client.

---

## 4. Central Control Plane / Multi-Tenant Roadmap

**The vision:** A central admin dashboard (like Slack/Shopify) from which you provision, manage, and customize access for multiple client companies.

**Reality check:** The current codebase is **single-tenant** — nothing in the schema distinguishes "which company does this data belong to." Building true multi-tenancy (shared app, per-company data isolation, custom branding, feature flags) is a large engineering effort — likely bigger than any single feature built so far.

**Recommended phasing:**
- **Phase A (now, 1–2 clients):** Deploy a **separate, isolated instance per client** — own repo fork/config, own database, own host. Manually provisioned. Gives full customization per client for free (it's their own copy) and total data isolation, with zero multi-tenancy engineering risk.
- **Phase B (once 3–5 paying clients validate demand):** Invest in a real control-plane — provisioning, billing, and potentially a unified multi-tenant schema. Worth the investment once you know what customization patterns clients actually need.

Avoid building the "big company" platform before a single client has proven willing to pay — classic premature-scaling trap.

---

## 5. Pricing

**Principle:** Price based on value delivered, not how the code was built (vibe-coded vs. hand-written is irrelevant to the client).

**Market anchors:**
- Eventbrite — mostly per-ticket fees, not flat SaaS.
- Cvent — enterprise-tier, not a small-business comparable.
- More relevant: small-business event/ticketing SaaS tools typically use **flat monthly tiers** based on event volume, attendee count, or feature access.

**Practical approach:**
1. Don't fix a price before the trial ends — use the 3 months to learn what he actually values and how much time/money it saves his business.
2. Near the end of the trial, ask directly (or infer from usage data) what he'd realistically budget — local small-business price ceilings differ a lot from US SaaS pricing pages.
3. Structure pricing in **tiers by usage** (events/month, attendees, certificate volume) rather than one flat number.
4. Consider a modest **setup/onboarding fee** separate from the monthly fee, since the isolated-instance model (see §4) means real configuration work per client.

---

## 6. Usage & Data Collection Strategy

**Rejected approach:** Facebook-style exhaustive behavioral tracking. Wrong model for B2B software — the people generating data are Dr. Ashraf's employees and event attendees, not consenting consumer users. Undisclosed profiling risks the client relationship and creates real legal exposure under Egypt's Personal Data Protection Law (151/2020) and GDPR if any EU attendees are involved.

**What to track instead — tied to features that drive pricing decisions:**

| Metric | Why it matters |
|---|---|
| # events created / month | Usage-tier driver |
| # registrations/attendees processed | Usage-tier driver |
| # certificates issued | Flagship feature — direct value signal |
| # check-ins via QR scan | Confirms live-event feature adoption |
| Feature adoption (Finance, site editors, etc. touched or not) | Informs what to bundle vs. charge extra for |
| Login frequency / active users per week | "Are they actually relying on this" signal |
| Support/incident report volume | Surfaces where the product is breaking |

**Implementation approach:**
- Build on the existing `activityLogService.ts` pattern already in the backend, or self-host an open-source product analytics tool (e.g. PostHog) rather than building a full tracking stack from scratch.
- **Disclose this in the trial agreement** — tell Dr. Ashraf upfront that anonymized usage analytics will be collected during the trial to improve the product and inform pricing. Transparency here builds trust rather than eroding it.

---

## 7. Security Review Findings

**Caveat:** This review is based on the project's documentation (`docs/security/`, `docs/architecture.md`, `docs/project_structure.md`) and file/folder structure — not a direct scan of the source code. The documented AI pentest plan (Shannon/Strix) has never actually been executed (dry-run log dated 2026-07-20 shows Docker and API keys were missing). Treat this as a structured starting checklist, not a substitute for running a real scan against staging.

### Already solid (Phase 0, confirmed in docs)
- JWT secret fails closed in production (no insecure default).
- Developer backdoor disabled by default; requires explicit opt-in flag.
- Rate limiting on login, contact form, incident reports, event registration.
- Helmet enabled; CORS is an explicit allowlist, not a wildcard.
- Debug `/test-db` route only exists outside production.
- Supabase Row-Level Security enabled on all tables (blocks anon/public API access, though bypassed by the backend's own direct Prisma connection).

### Needs attention — prioritized

**Critical / high priority:**
1. **JWT stored in `localStorage`** (members-portal) — if any XSS vulnerability exists anywhere in the app, an attacker's script can read this and steal a live session token. Documented as an open residual risk. Fix: move to httpOnly-cookie-only sessions.
2. **Password hashing algorithm unconfirmed** — no documentation confirms bcrypt/argon2/salt rounds are actually used. Needs direct verification in `auth.ts`.
3. **Export endpoint authorization** (`registrationExcelExport.ts`, `financeExport.ts`, `incidentReportExport.ts`) — must confirm only event owners/leadership can trigger these, not any authenticated member. These expose full PII (phone, email) in bulk if authz is loose.
4. **Custom registration fields are attacker-controlled input** rendered later in admin tables — if not escaped, this is a stored XSS vector, which compounds directly with risk #1 (XSS → token theft).
5. **No pentest has actually been run.** A focused Strix scan against staging (auth, IDOR, admin RBAC bypass) is the single highest-value action given limited ability to personally audit code.

**Medium priority:**
6. **Certificate template background path** accepts client-supplied path/SHA without a prefix allowlist — a privileged user could potentially point it at unintended storage locations. Documented as an open risk.
7. **WebSocket auth query-string token fallback** — leaks via browser history, logs, and Referer headers. Same risk family as #1.
8. **GitHub-as-file-storage scoping** — confirm the storage repo (profile photos, certificates, project/event files) is private and its PAT is scoped only to that repo, not the whole GitHub account.
9. **Verbose error messages** in production may leak stack traces or schema details, including PII fragments.
10. **Password policy enforcement** — confirm complexity rules are enforced server-side, not just as frontend form validation.

**Lower priority / forward-looking:**
11. **`NODE_ENV` misconfiguration risk** — many protections (backdoor, debug routes, JWT secret) hinge entirely on this being set correctly on every deploy target; worth a startup assertion rather than relying on manual checklist discipline.
12. **Multi-tenant data isolation** — not urgent with isolated per-client instances (§4 Phase A), but must be designed deliberately, not bolted on, once a shared control-plane is built.

### Recommended sequence before onboarding a paying client
1. Confirm password hashing algorithm and strength.
2. Fix `localStorage` JWT storage + WebSocket query-token fallback.
3. Audit authorization on every export endpoint.
4. Sanitize/escape custom field rendering (stored XSS).
5. Confirm GitHub storage repo/PAT scoping is private and minimally scoped.
6. Run a real Strix scan focused on auth/IDOR/RBAC against a staging copy.

---

## Summary of Open Decisions

- [ ] Confirm IP ownership status with the club before commercializing.
- [ ] Move commercial deployments to private repo + private hosting.
- [ ] Draft a one-page trial agreement (as-is, no warranty, data disclosure, usage analytics disclosure).
- [ ] Set up independent DB backup (beyond provider default) with encryption at rest.
- [ ] Confirm isolated-instance-per-client approach for now; defer control-plane build.
- [ ] Hold pricing decision until trial data is in; use tiered usage-based pricing.
- [ ] Execute the security fix list above before real client data enters the system.
