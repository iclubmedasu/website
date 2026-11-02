# Client profiles — baseline before Phase C

Recorded on 2026-11-02 on branch `feat/client-profiles`, before any code
change, at commit `541586d` (same as `main`). Node v22.14.0, pnpm 10.0.0.

| Check | Command | Result |
|---|---|---|
| Shared package build | `pnpm --filter @iclub/shared build` | passed |
| Typecheck (backend, portal, website) | `pnpm typecheck` | passed, 0 errors |
| Lint | `pnpm lint` | passed, 0 errors, 0 warnings |
| Unit tests | `pnpm test:run` | 99 files, 751 tests, all passed |
| E2E tests | `pnpm test:e2e` | not run (need running apps and a local database; run in C10) |

Any failure after this point is new and was caused by Phase C work.
