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
│   │   │   ├── projects.routes.test.ts
│   │   │   ├── tasks.routes.test.ts
│   │   │   └── testHarness.ts
│   │   ├── services/
│   │   │   ├── activityLogService.test.ts
│   │   │   └── wbsService.test.ts
│   │   └── utils.test.ts
│   ├── config/
│   ├── middleware/
│   │   └── auth.ts
│   ├── prisma/
│   │   └── schema.prisma
│   ├── routes/
│   │   ├── administration.ts
│   │   ├── alumni.ts
│   │   ├── api_documentation.md
│   │   ├── auth.ts
│   │   ├── index.ts
│   │   ├── members.ts
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
│   │   ├── manifest.json
│   │   ├── sw.js
│   │   └── workbox-0f7cba1c.js
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
│   │   │   │   ├── login/
│   │   │   │   │   ├── LoginPage.css
│   │   │   │   │   ├── page.client.tsx
│   │   │   │   │   └── page.tsx
│   │   │   │   └── layout.tsx
│   │   │   ├── favicon.ico
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   ├── not-found.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   ├── __tests__/
│   │   │   │   ├── ProtectedRoute.integration.test.tsx
│   │   │   │   └── RouteGuards.test.tsx
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
│   │   │   │   │   ├── modals/
│   │   │   │   │   │   ├── AddOfficerModal.tsx
│   │   │   │   │   │   ├── EditAdminMembersModal.tsx
│   │   │   │   │   │   └── OfficerHandoverModal.tsx
│   │   │   │   │   ├── AdministrationPage.css
│   │   │   │   │   └── AdministrationPage.tsx
│   │   │   │   ├── Alumni/
│   │   │   │   │   └── AlumniPage.tsx
│   │   │   │   ├── Members/
│   │   │   │   │   ├── modals/
│   │   │   │   │   │   └── AssignToTeamModal.tsx
│   │   │   │   │   └── MembersPage.tsx
│   │   │   │   └── Teams/
│   │   │   │       ├── modals/
│   │   │   │       │   ├── ActivateRoleModal.tsx
│   │   │   │       │   ├── ActivateSubteamModal.tsx
│   │   │   │       │   ├── ActivateTeamModal.tsx
│   │   │   │       │   ├── AddMembersModal.tsx
│   │   │   │       │   ├── AddRoleModal.tsx
│   │   │   │       │   ├── AddSubteamModal.tsx
│   │   │   │       │   ├── AddTeamModal.tsx
│   │   │   │       │   ├── DeactivateRoleModal.tsx
│   │   │   │       │   ├── DeactivateSubteamModal.tsx
│   │   │   │       │   ├── DeactivateTeamModal.tsx
│   │   │   │       │   ├── EditMembersModal.tsx
│   │   │   │       │   ├── EditRoleModal.tsx
│   │   │   │       │   ├── EditSubteamModal.tsx
│   │   │   │       │   ├── EditTeamModal.tsx
│   │   │   │       │   └── ViewMemberModal.tsx
│   │   │   │       └── TeamsPage.tsx
│   │   │   ├── Projects/
│   │   │   │   ├── components/
│   │   │   │   │   ├── GanttChart/
│   │   │   │   │   │   ├── GanttChart.css
│   │   │   │   │   │   └── GanttChart.tsx
│   │   │   │   │   ├── PhaseRow/
│   │   │   │   │   │   ├── PhaseRow.css
│   │   │   │   │   │   └── PhaseRow.tsx
│   │   │   │   │   ├── ProjectCardView/
│   │   │   │   │   │   └── ProjectCardView.tsx
│   │   │   │   │   └── ScheduleTimetable/
│   │   │   │   │       ├── ScheduleTimetable.css
│   │   │   │   │       └── ScheduleTimetable.tsx
│   │   │   │   ├── modals/
│   │   │   │   │   ├── AbortProjectModal.tsx
│   │   │   │   │   ├── AddPhaseModal.tsx
│   │   │   │   │   ├── AddTaskModal.tsx
│   │   │   │   │   ├── ArchiveProjectModal.tsx
│   │   │   │   │   ├── CreateProjectModal.tsx
│   │   │   │   │   ├── DeletePhaseTaskModal.tsx
│   │   │   │   │   ├── EditPhaseModal.tsx
│   │   │   │   │   ├── EditTaskModal.tsx
│   │   │   │   │   ├── FileCommentsModal.tsx
│   │   │   │   │   ├── FinalizeProjectModal.tsx
│   │   │   │   │   ├── HoldProjectModal.tsx
│   │   │   │   │   ├── ProjectActivityModal.tsx
│   │   │   │   │   ├── ReactivateProjectModal.tsx
│   │   │   │   │   ├── TaskActivityModal.tsx
│   │   │   │   │   ├── TaskCommentsModal.tsx
│   │   │   │   │   └── TaskScheduleSlotsModal.tsx
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
│   ├── next.config.ts
│   ├── next-env.d.ts
│   ├── next-pwa.d.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── tsconfig.tsbuildinfo
├── packages/
│   └── shared/
│       ├── src/
│       │   └── types/
│       │       ├── __tests__/
│       │       │   └── types.test.ts
│       │       ├── auth.ts
│       │       ├── index.ts
│       │       ├── member.ts
│       │       ├── phase.ts
│       │       ├── project.ts
│       │       ├── task.ts
│       │       └── team.ts
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
├── test-setup.ts
└── vitest.config.ts
```

Excluded directories: .git, node_modules, .next, dist, cache, logs, migrations, assets, icons, generated, coverage, test-results.
