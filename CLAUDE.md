# iClub — Claude Code instructions

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
- The plan for this phase is docs/iClub-Multi-Client-Codebase-Structure.md;
  decisions and audit results are in docs/client-profiles-audit.md.
