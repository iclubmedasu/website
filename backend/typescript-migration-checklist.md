# Backend TypeScript Migration Checklist

This file tracks every backend runtime JavaScript file to guarantee nothing is missed.

## Core
- [x] db.js -> db.ts (legacy db.js removed)
- [x] server.js -> server.ts (legacy server.js removed)

## Middleware
- [x] middleware/auth.js -> middleware/auth.ts

## Services
- [x] services/activityLogService.js -> services/activityLogService.ts
- [x] services/githubStorage.js -> services/githubStorage.ts
- [x] services/githubStorageService.js -> services/githubStorageService.ts
- [x] services/wbsService.js -> services/wbsService.ts

## Routes
- [x] routes/index.js -> routes/index.ts
- [x] routes/auth.js -> routes/auth.ts
- [x] routes/members.js -> routes/members.ts
- [x] routes/teams.js -> routes/teams.ts
- [x] routes/teamMembers.js -> routes/teamMembers.ts
- [x] routes/teamRoles.js -> routes/teamRoles.ts
- [x] routes/teamSubteams.js -> routes/teamSubteams.ts
- [x] routes/roleHistory.js -> routes/roleHistory.ts
- [x] routes/alumni.js -> routes/alumni.ts
- [x] routes/administration.js -> routes/administration.ts
- [x] routes/projects.js -> routes/projects.ts
- [x] routes/tasks.js -> routes/tasks.ts
- [x] routes/phases.js -> routes/phases.ts
- [x] routes/scheduleSlots.js -> routes/scheduleSlots.ts
- [x] routes/projectFiles.js -> routes/projectFiles.ts

## Scripts
- [x] scripts/testGithubStorage.js -> scripts/testGithubStorage.ts

## Cleanup Gate
- [x] tsconfig allowJs set to false
- [x] no runtime source .js files remain in backend (excluding dependencies and generated output)
- [x] backend typecheck passes
- [x] backend build passes
- [x] backend smoke tests pass (health, auth, teams, and full route matrix)
