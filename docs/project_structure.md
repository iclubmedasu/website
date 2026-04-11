
## Project Structure (Filtered)

```text
website/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   └── deploy.yml
│   └── SECRETS.md
├── backend/
│   ├── __tests__/
│   │   ├── middleware/
│   │   │   └── auth.test.ts
│   │   ├── routes/
│   │   │   ├── auth.routes.cookies.test.ts
│   │   │   ├── members.routes.test.ts
│   │   │   ├── notifications.routes.test.ts
│   │   │   ├── projects.routes.test.ts
│   │   │   ├── scheduleSlots.routes.test.ts
│   │   │   ├── tasks.routes.test.ts
│   │   │   ├── teamMembers.routes.test.ts
│   │   │   └── testHarness.ts
│   │   ├── services/
│   │   │   ├── activityLogService.test.ts
│   │   │   ├── notificationService.test.ts
│   │   │   └── wbsService.test.ts
│   │   └── utils.test.ts
│   ├── config/
│   ├── middleware/
│   │   └── auth.ts
│   ├── prisma/
│   │   ├── migrations/  # excluded
│   │   └── schema.prisma
│   ├── routes/
│   │   ├── administration.ts
│   │   ├── alumni.ts
│   │   ├── api_documentation.md
│   │   ├── auth.ts
│   │   ├── index.ts
│   │   ├── members.ts
│   │   ├── notifications.ts
│   │   ├── phases.ts
│   │   ├── projectFiles.ts
│   │   ├── projects.ts
│   │   ├── roleHistory.ts
│   │   ├── scheduleSlots.ts
│   │   ├── tasks.ts
│   │   ├── teamMembers.ts
│   │   ├── teamRoles.ts
│   │   ├── teams.ts
│   │   └── teamSubteams.ts
│   ├── scripts/
│   │   └── testGithubStorage.ts
│   ├── services/
│   │   ├── activityLogService.ts
│   │   ├── githubStorage.ts
│   │   ├── githubStorageService.ts
│   │   ├── notificationService.ts
│   │   ├── notificationsRealtime.ts
│   │   └── wbsService.ts
│   ├── types/
│   │   ├── auth.ts
│   │   ├── contracts.ts
│   │   ├── env.d.ts
│   │   └── express.d.ts
│   ├── .env
│   ├── .gitignore
│   ├── .gitkeep
│   ├── db.ts
│   ├── Dockerfile
│   ├── package.json
│   ├── prisma.config.ts
│   ├── server.ts
│   ├── tsconfig.json
│   ├── typescript-migration-checklist.md
│   └── vitest.config.ts
├── docs/
│   ├── .gitignore
│   ├── api.md
│   ├── architectural_summary.md
│   ├── architecture.md
│   ├── common git commands.md
│   ├── css-standards.md
│   ├── deployment.md
│   ├── list of common commands.md
│   ├── project_structure.md
│   ├── README.md
│   └── setup.md
├── e2e/
│   └── auth.smoke.spec.ts
├── members-portal/
│   ├── public/
│   │   ├── fallback-7rrQ5r1-LlbkAiq4qhBwk.js
│   │   ├── manifest.json
│   │   ├── offline.html
│   │   ├── screenshots/  # excluded
│   │   ├── sw.js
│   │   └── workbox-3a9bdd4e.js
│   ├── src/
│   │   ├── app/
│   │   │   ├── (protected)/
│   │   │   │   ├── administration/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── alumni/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── dashboard/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── help/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── members/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── past-projects/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── projects/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── teams/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── user/
│   │   │   │   │   ├── page.client.tsx
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── UserPage.css
│   │   │   │   ├── layout.tsx
│   │   │   │   └── loading.tsx
│   │   │   ├── (public)/
│   │   │   │   ├── layout.tsx
│   │   │   │   └── login/
│   │   │   │       ├── LoginPage.css
│   │   │   │       ├── page.client.tsx
│   │   │   │       └── page.tsx
│   │   │   ├── favicon.ico
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   ├── not-found.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   ├── ActivityTimeline/
│   │   │   │   └── ActivityTimeline.tsx
│   │   │   ├── AlumniGate/
│   │   │   │   ├── AlumniGate.css
│   │   │   │   └── AlumniGate.tsx
│   │   │   ├── AuthGuard/
│   │   │   │   ├── AdminGuard.tsx
│   │   │   │   └── AuthGuard.tsx
│   │   │   ├── badges/
│   │   │   │   └── badge.css
│   │   │   ├── buttons/
│   │   │   │   └── buttons.css
│   │   │   ├── cards/
│   │   │   │   └── universalcard.css
│   │   │   ├── charts/
│   │   │   │   ├── BarChart.tsx
│   │   │   │   ├── LineChart.tsx
│   │   │   │   └── PieChart.tsx
│   │   │   ├── checkbox/
│   │   │   │   └── checkbox.tsx
│   │   │   ├── dropdown/
│   │   │   │   ├── dropdown.css
│   │   │   │   └── dropdown.tsx
│   │   │   ├── errormsg/
│   │   │   │   └── errormsg.css
│   │   │   ├── fields/
│   │   │   │   ├── InputField.tsx
│   │   │   │   ├── SwitchField.tsx
│   │   │   │   └── TextField.tsx
│   │   │   ├── FileUpload/
│   │   │   │   ├── FileUploadZone.css
│   │   │   │   └── FileUploadZone.tsx
│   │   │   ├── fixedPlugin/
│   │   │   │   └── FixedPlugin.tsx
│   │   │   ├── footer/
│   │   │   │   ├── Footer.tsx
│   │   │   │   └── FooterAuthDefault.tsx
│   │   │   ├── form/
│   │   │   │   └── form.css
│   │   │   ├── header/
│   │   │   │   └── header.css
│   │   │   ├── input/
│   │   │   │   └── input.css
│   │   │   ├── minicalendar/
│   │   │   │   └── MiniCalendar.tsx
│   │   │   ├── modal/
│   │   │   │   └── modal.css
│   │   │   ├── navbar/
│   │   │   │   ├── Dropdown.tsx
│   │   │   │   ├── navbar.tsx
│   │   │   │   └── RTL.tsx
│   │   │   ├── nftcard/
│   │   │   │   └── NftCard.tsx
│   │   │   ├── page/
│   │   │   │   └── page.css
│   │   │   ├── pagetitle/
│   │   │   │   └── pagetitle.css
│   │   │   ├── PhoneInput/
│   │   │   │   ├── PhoneInput.css
│   │   │   │   └── PhoneInput.tsx
│   │   │   ├── popover/
│   │   │   │   └── popover.tsx
│   │   │   ├── providers/
│   │   │   │   └── AuthProvider.tsx
│   │   │   ├── PWAInstallPrompt/
│   │   │   │   ├── PWAInstallPrompt.css
│   │   │   │   └── PWAInstallPrompt.tsx
│   │   │   ├── scrollbar/
│   │   │   │   └── scrollbar.css
│   │   │   ├── SideBarNavigationSlim/
│   │   │   │   ├── SideBarNavigationSlim.css
│   │   │   │   └── SideBarNavigationSlim.tsx
│   │   │   ├── StepProgressBar/
│   │   │   │   ├── StepProgressBar.css
│   │   │   │   └── StepProgressBar.tsx
│   │   │   ├── switch/
│   │   │   │   └── switch.tsx
│   │   │   ├── table/
│   │   │   │   └── table.css
│   │   │   ├── toggle/
│   │   │   │   └── toggle.css
│   │   │   ├── tooltip/
│   │   │   │   └── tooltip.tsx
│   │   │   ├── UnassignedGate/
│   │   │   │   ├── UnassignedGate.css
│   │   │   │   └── UnassignedGate.tsx
│   │   │   ├── UploadPhotoModal/
│   │   │   │   ├── UploadPhotoModal.css
│   │   │   │   └── UploadPhotoModal.tsx
│   │   │   ├── widget/
│   │   │   │   └── Widget.tsx
│   │   │   ├── AdminProtectedRoute.tsx
│   │   │   ├── card.tsx
│   │   │   ├── ProtectedRoute.css
│   │   │   └── ProtectedRoute.tsx
│   │   ├── context/
│   │   │   └── AuthContext.tsx
│   │   ├── features/
│   │   │   ├── HelpAndSupport/
│   │   │   │   ├── HelpAndSupportPage.css
│   │   │   │   └── HelpAndSupportPage.tsx
│   │   │   ├── Personnel/
│   │   │   │   ├── Administration/
│   │   │   │   │   ├── AdministrationPage.css
│   │   │   │   │   ├── AdministrationPage.tsx
│   │   │   │   │   └── modals/
│   │   │   │   ├── Alumni/
│   │   │   │   │   └── AlumniPage.tsx
│   │   │   │   ├── Members/
│   │   │   │   │   ├── MembersPage.tsx
│   │   │   │   │   └── modals/
│   │   │   │   └── Teams/
│   │   │   │       ├── TeamsPage.tsx
│   │   │   │       └── modals/
│   │   │   ├── Projects/
│   │   │   │   ├── components/
│   │   │   │   │   ├── GanttChart/
│   │   │   │   │   ├── PhaseRow/
│   │   │   │   │   ├── ProjectCardView/
│   │   │   │   │   └── ScheduleTimetable/
│   │   │   │   ├── modals/
│   │   │   │   ├── PastProjectsPage.tsx
│   │   │   │   ├── ProjectsPage.css
│   │   │   │   └── ProjectsPage.tsx
│   │   │   ├── User/
│   │   │   │   └── UserPage.css
│   │   │   ├── LoginPage.css
│   │   │   └── SideBarNavigationSlim.css
│   │   ├── hooks/
│   │   │   ├── use-breakpoint.ts
│   │   │   └── useTitleCaseInput.ts
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── types/
│   │   │   └── backend-contracts.ts
│   │   └── utils/
│   │       ├── countryCodes.ts
│   │       └── titleCase.ts
│   ├── .env.local
│   ├── .env.local.example
│   ├── Dockerfile
│   ├── lighthouse-pwa-v11.json
│   ├── lighthouse-pwa.json
│   ├── next.config.ts
│   ├── next-env.d.ts
│   ├── next-pwa.d.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.tsbuildinfo
│   └── utils/
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── types/
│       │   │   ├── __tests__/
│       │   │   │   └── types.test.ts
│       │   │   ├── auth.ts
│       │   │   ├── index.ts
│       │   │   ├── member.ts
│       │   │   ├── notification.ts
│       │   │   ├── phase.ts
│       │   │   ├── project.ts
│       │   │   ├── task.ts
│       │   │   └── team.ts
│       ├── package.json
│       └── tsconfig.json
├── public-website/
│   ├── public/
│   │   ├── file.svg
│   │   ├── globe.svg
│   │   ├── next.svg
│   │   ├── vercel.svg
│   │   └── window.svg
│   ├── src/
│   │   └── app/
│   │       ├── favicon.ico
│   │       ├── globals.css
│   │       ├── layout.tsx
│   │       ├── page.module.css
│   │       └── page.tsx
│   ├── .gitignore
│   ├── eslint.config.mjs
│   ├── next.config.ts
│   ├── next-env.d.ts
│   ├── package.json
│   ├── README.md
│   ├── tsconfig.json
│   ├── tsconfig.tsbuildinfo
│   └── vitest.config.ts
├── .editorconfig
├── .env
├── .env.example
├── .gitignore
├── .prettierignore
├── .prettierrc
├── docker-compose.yml
├── eslint.config.mjs
├── iClub Website Development Roadmap.pdf
├── package.json
├── playwright.config.ts
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── pwa-devtools-check.json
├── test-setup.ts
├── vitest.config.ci.ts
├── vitest.config.ts
```

Excluded directories: .git, node_modules, .next, dist, cache, logs, migrations, assets, icons, generated, coverage, test-results.
