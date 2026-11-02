# iClub — Claude Code instructions

## Platform rules (multi-tenant roadmap)
- iClub is a pnpm monorepo (backend, members-portal, public-website,
  packages/shared) being turned into ONE shared platform for many
  organizations ("tenants"): one database, one backend, one portal, one
  public website, one owner console. The club is tenant #1.
- The plan is docs/iClub-Platform-Roadmap.md: §1 is the checklist of
  everything agreed with the owner, then decisions, open checkpoints and
  phases P0–P11. Audit findings and owner answers are in
  docs/client-profiles-audit.md. Read both before starting a phase.
- The owner is a medical student, not a developer. Explain in plain
  English and define each technical term at first use.
- One repo, work directly on main (no branches, no per-tenant copies).
  Every commit must leave the app working and deployable, because the
  owner's next push deploys.
- A tenant is data, not code: anything a tenant may change (theme,
  logo, names, wording, links, addresses, features, limits, teams/roles,
  login identifiers) lives in the database and is edited from screens.
  Code holds only defaults (today's club values).
- One central login page (organization found from the account); each
  organization's public website on its own domain, served by the one
  public-website app that picks the organization from the domain.
- Two levels of control: the owner decides what a tenant may use (plan,
  available features, limits); tenant admins choose within that.
  Owner-only fields must be enforced in the API, not just hidden.
- Tenant isolation is the top risk. Every tenant-owned table has
  tenantId; every database call is tenant-scoped (Prisma extension), RLS
  is the safety net, and new routes need cross-tenant tests. Never write
  a query that can return another tenant's rows.
- With no settings changed, the club must look and behave exactly as
  today, except changes the owner approved. Any other visible change for
  the club is a bug.
- A disabled feature must be blocked in the backend, not just hidden in
  the UI.
- Colors: never write a color literal; use the tokens in
  docs/css-standards.md §13 and check with pnpm color:audit.
- After each step run typecheck, lint, and the existing tests, and
  report the real results. Compare against
  docs/client-profiles-baseline.md to tell new failures from old ones.
- Never run git push, never trigger or modify deployments, and never
  run migrations against any non-local database. Show the generated SQL
  of every migration before running it locally; migrations are additive
  (no data loss, no reset).
- Never read or print .env files or secret values. Use .env.example
  files only.
- At steps marked CHECKPOINT: use the question tool with 2 to 4
  options, put your recommendation first, explain the trade-off in
  plain language, and wait for the answer before writing code.
- Work in small steps, and keep a task list.
- Keep the deploy safety net in .github/workflows/deploy.yml (health
  checks, auto-revert, deployed-* tags); never remove it.
- Follow existing project rules: .cursor/rules/datetime.mdc and
  docs/css-standards.md. Build packages/shared before the backend
  (pnpm --filter @iclub/shared build).
- If you notice a security issue on the way, report it to the owner
  instead of silently changing it.
