
## Project Structure (Filtered)

```text
website/
├── .cursor/
│   └── rules/
│       └── datetime.mdc
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── deploy.yml
│   │   ├── gitleaks.yml
│   │   └── semgrep.yml
│   ├── dependabot.yml
│   └── SECRETS.md
├── backend/
│   ├── __tests__/
│   │   ├── lib/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils.test.ts
│   ├── .artifacts/
│   │   └── backend/
│   ├── assets/
│   │   ├── email/
│   │   └── fonts/
│   ├── config/
│   ├── lib/
│   │   ├── atomicJsonMerge.ts
│   │   ├── authorityFlags.ts
│   │   ├── certificateBackgroundCache.ts
│   │   ├── certificateRecipientKey.ts
│   │   ├── conflictResponse.ts
│   │   ├── customFields.ts
│   │   ├── eventPermissions.ts
│   │   ├── eventSessionCapacity.ts
│   │   ├── eventSessionTime.ts
│   │   ├── finance.ts
│   │   ├── financeExport.ts
│   │   ├── financePermissions.ts
│   │   ├── incidentReportExport.ts
│   │   ├── memberProfileVisibility.ts
│   │   ├── optimisticLock.ts
│   │   ├── optimizeCertificateBackground.ts
│   │   ├── optimizeEventPhoto.ts
│   │   ├── phoneUtils.ts
│   │   ├── publicApiUrl.ts
│   │   ├── publicEntitySlug.ts
│   │   ├── publicMemberDirectory.ts
│   │   ├── publicWebsiteUrl.ts
│   │   ├── resourceRealtime.ts
│   │   ├── securityEnv.ts
│   │   ├── siteContent.ts
│   │   ├── siteContentDefaults.ts
│   │   ├── siteContentSeed.ts
│   │   ├── supportContent.ts
│   │   └── supportPermissions.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   └── rateLimit.ts
│   ├── prisma/
│   │   ├── migrations/  # excluded
│   │   ├── sql/
│   │   └── schema.prisma
│   ├── routes/
│   │   ├── administration.ts
│   │   ├── alumni.ts
│   │   ├── api_documentation.md
│   │   ├── auth.ts
│   │   ├── certificates.ts
│   │   ├── certificateTemplates.ts
│   │   ├── dashboard.ts
│   │   ├── eventFiles.ts
│   │   ├── eventPhotos.ts
│   │   ├── events.ts
│   │   ├── finance.ts
│   │   ├── index.ts
│   │   ├── members.ts
│   │   ├── notifications.ts
│   │   ├── phases.ts
│   │   ├── projectFiles.ts
│   │   ├── projects.ts
│   │   ├── public.ts
│   │   ├── roleHistory.ts
│   │   ├── scheduleSlots.ts
│   │   ├── siteContent.ts
│   │   ├── supportContent.ts
│   │   ├── tasks.ts
│   │   ├── teamMembers.ts
│   │   ├── teamRoles.ts
│   │   ├── teams.ts
│   │   └── teamSubteams.ts
│   ├── scripts/
│   │   ├── enablePublicRls.ts
│   │   ├── seedFinance.ts
│   │   ├── seedSiteContent.ts
│   │   ├── seedSupportContent.ts
│   │   └── testGithubStorage.ts
│   ├── services/
│   │   ├── activityLogService.ts
│   │   ├── certificateEmailService.ts
│   │   ├── certificatePdfService.ts
│   │   ├── emailSendPool.ts
│   │   ├── emailService.ts
│   │   ├── eventActivityHelpers.ts
│   │   ├── eventCode.ts
│   │   ├── eventDates.ts
│   │   ├── eventTicketEmailService.ts
│   │   ├── githubStorage.ts
│   │   ├── githubStorageService.ts
│   │   ├── notificationService.ts
│   │   ├── notificationsRealtime.ts
│   │   ├── sessionTokenService.ts
│   │   ├── taskActivityHelpers.ts
│   │   └── wbsService.ts
│   ├── types/
│   │   ├── auth.ts
│   │   ├── contracts.ts
│   │   ├── env.d.ts
│   │   └── express.d.ts
│   ├── .dockerignore
│   ├── .env
│   ├── .env.example
│   ├── .gitignore
│   ├── .gitkeep
│   ├── db.ts
│   ├── Dockerfile
│   ├── package-lock.json
│   ├── package.json
│   ├── prisma.config.ts
│   ├── server.ts
│   ├── tsconfig.json
│   ├── typescript-migration-checklist.md
│   └── vitest.config.ts
├── docs/
│   ├── security/
│   │   ├── security-pentest.md
│   │   ├── security.md
│   │   └── shannon-iclub.example.yaml
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
│   │   ├── icons/
│   │   ├── fallback-u4S87rthrAVTIlj26q2hf.js
│   │   ├── favicon.ico
│   │   ├── manifest.json
│   │   ├── offline.html
│   │   ├── sw.js
│   │   └── workbox-620770c0.js
│   ├── scripts/
│   │   └── capture-pwa-screenshots.ts
│   ├── src/
│   │   ├── app/
│   │   │   ├── (protected)/
│   │   │   │   ├── administration/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── alumni/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── certificates/
│   │   │   │   │   ├── templates/
│   │   │   │   │   │   ├── [id]/
│   │   │   │   │   │   │   └── edit/
│   │   │   │   │   │   │       └── page.tsx
│   │   │   │   │   │   └── new/
│   │   │   │   │   │       └── page.tsx
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── dashboard/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── events/
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   ├── check-in/
│   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   ├── registrations/
│   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── new/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── finance/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── general/
│   │   │   │   │   ├── about/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── contact/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── support/
│   │   │   │   │       └── page.tsx
│   │   │   │   ├── help/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── members/
│   │   │   │   │   ├── [id]/
│   │   │   │   │   │   ├── page.client.tsx
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── past-events/
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
│   │   │   ├── api/
│   │   │   │   └── ping/
│   │   │   │       └── route.ts
│   │   │   ├── offline/
│   │   │   │   ├── page.module.css
│   │   │   │   └── page.tsx
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   ├── not-found.tsx
│   │   │   └── page.tsx
│   │   ├── assets/
│   │   ├── components/
│   │   ├── context/
│   │   ├── features/
│   │   │   ├── Certificates/
│   │   │   │   ├── modals/
│   │   │   │   │   ├── CertificatesFiltersModal.tsx
│   │   │   │   │   ├── DeactivateTemplateModal.tsx
│   │   │   │   │   ├── DeleteTemplateModal.tsx
│   │   │   │   │   ├── NewCustomCertificateModal.css
│   │   │   │   │   ├── NewCustomCertificateModal.tsx
│   │   │   │   │   ├── ReactivateTemplateModal.tsx
│   │   │   │   │   ├── ReissueCertificateModal.tsx
│   │   │   │   │   ├── RevokeCertificateModal.tsx
│   │   │   │   │   ├── TemplatePreviewModal.css
│   │   │   │   │   └── TemplatePreviewModal.tsx
│   │   │   │   ├── TemplateEditor/
│   │   │   │   │   ├── ClampedNumberInput.tsx
│   │   │   │   │   ├── TemplateEditor.css
│   │   │   │   │   ├── TemplateEditor.tsx
│   │   │   │   │   ├── TemplateEditorHost.tsx
│   │   │   │   │   ├── TemplateEditorPage.tsx
│   │   │   │   │   └── textFitsInBox.ts
│   │   │   │   ├── CertificatesPage.css
│   │   │   │   └── CertificatesPage.tsx
│   │   │   ├── Dashboard/
│   │   │   │   ├── widgets/
│   │   │   │   │   ├── MyTasksWidget.css
│   │   │   │   │   ├── MyTasksWidget.tsx
│   │   │   │   │   ├── NotificationsFeedWidget.tsx
│   │   │   │   │   ├── QuickStatsCards.css
│   │   │   │   │   ├── QuickStatsCards.tsx
│   │   │   │   │   ├── UpcomingEventsWidget.css
│   │   │   │   │   └── UpcomingEventsWidget.tsx
│   │   │   │   ├── DashboardPage.css
│   │   │   │   ├── DashboardPage.tsx
│   │   │   │   └── dashboardWidgets.css
│   │   │   ├── Events/
│   │   │   │   ├── components/
│   │   │   │   │   ├── EventCard/
│   │   │   │   │   │   ├── EventCard.tsx
│   │   │   │   │   │   ├── eventCardAdapter.ts
│   │   │   │   │   │   ├── EventPhotosSection.css
│   │   │   │   │   │   └── EventPhotosSection.tsx
│   │   │   │   │   ├── EventExpandedContent/
│   │   │   │   │   │   ├── __tests__/
│   │   │   │   │   │   │   ├── certificateEligibleFilterUtils.test.ts
│   │   │   │   │   │   │   ├── registrationColumnOrderUtils.test.ts
│   │   │   │   │   │   │   └── registrationTableFilterUtils.test.ts
│   │   │   │   │   │   ├── sections/
│   │   │   │   │   │   │   ├── CertificateEligibleFilterModal.tsx
│   │   │   │   │   │   │   ├── CollapsibleAttendanceChips.tsx
│   │   │   │   │   │   │   ├── CollapsibleChipGroup.tsx
│   │   │   │   │   │   │   ├── CustomFieldColumnMenu.tsx
│   │   │   │   │   │   │   ├── EditableCertificateTypeCell.tsx
│   │   │   │   │   │   │   ├── EditableCustomFieldCell.tsx
│   │   │   │   │   │   │   ├── EditableRegistrationContactCell.tsx
│   │   │   │   │   │   │   ├── EditableRegistrationSessionCell.tsx
│   │   │   │   │   │   │   ├── EditableRegistrationTierCell.tsx
│   │   │   │   │   │   │   ├── EventCertificatesSection.tsx
│   │   │   │   │   │   │   ├── EventCheckInSection.tsx
│   │   │   │   │   │   │   ├── EventRegistrationsSection.tsx
│   │   │   │   │   │   │   ├── EventSessionsSection.tsx
│   │   │   │   │   │   │   ├── EventStatisticsSection.tsx
│   │   │   │   │   │   │   ├── EventTasksSection.css
│   │   │   │   │   │   │   ├── EventTasksSection.tsx
│   │   │   │   │   │   │   ├── EventTicketsSection.tsx
│   │   │   │   │   │   │   ├── EventTiersSection.tsx
│   │   │   │   │   │   │   ├── RegistrationColumnFilterModal.tsx
│   │   │   │   │   │   │   ├── RegistrationTableSortControl.tsx
│   │   │   │   │   │   │   ├── SessionAttendanceOptions.tsx
│   │   │   │   │   │   │   ├── SpecialColumnMenu.tsx
│   │   │   │   │   │   │   └── WalkInDraftFields.tsx
│   │   │   │   │   │   ├── BarMemberNames.tsx
│   │   │   │   │   │   ├── certificateEligibleFilterUtils.ts
│   │   │   │   │   │   ├── checkInScanUtils.ts
│   │   │   │   │   │   ├── checkInSounds.ts
│   │   │   │   │   │   ├── customFieldUtils.ts
│   │   │   │   │   │   ├── EventExpandedContent.css
│   │   │   │   │   │   ├── EventExpandedContent.tsx
│   │   │   │   │   │   ├── eventExpandedFunnelState.ts
│   │   │   │   │   │   ├── EventQrScanner.tsx
│   │   │   │   │   │   ├── EventStatTile.tsx
│   │   │   │   │   │   ├── EventTaskBarPreview.tsx
│   │   │   │   │   │   ├── EventTasksTimetable.css
│   │   │   │   │   │   ├── EventTasksTimetable.tsx
│   │   │   │   │   │   ├── registrationColumnOrderUtils.ts
│   │   │   │   │   │   ├── registrationConflictUtils.ts
│   │   │   │   │   │   ├── registrationTableFilterUtils.ts
│   │   │   │   │   │   ├── TierPriceFields.tsx
│   │   │   │   │   │   ├── useCheckInFlow.ts
│   │   │   │   │   │   └── useHardwareScannerCapture.ts
│   │   │   │   │   ├── registrationExcel/
│   │   │   │   │   │   ├── __tests__/
│   │   │   │   │   │   │   └── builders.test.ts
│   │   │   │   │   │   ├── builders.ts
│   │   │   │   │   │   ├── charts.ts
│   │   │   │   │   │   └── styling.ts
│   │   │   │   │   ├── CopyPublicEventLinkButton.tsx
│   │   │   │   │   ├── CopyPublicVerifyLinkButton.tsx
│   │   │   │   │   ├── eventDateUtils.ts
│   │   │   │   │   ├── EventStaffModal.tsx
│   │   │   │   │   ├── eventTaskClipboard.ts
│   │   │   │   │   ├── eventTaskExcelExport.ts
│   │   │   │   │   ├── eventTaskTimetableModel.ts
│   │   │   │   │   ├── eventTaskTimeUtils.ts
│   │   │   │   │   ├── eventUtils.ts
│   │   │   │   │   ├── QuarterHourTimeSelect.css
│   │   │   │   │   ├── QuarterHourTimeSelect.tsx
│   │   │   │   │   ├── registrationExcelExport.ts
│   │   │   │   │   ├── registrationExcelImport.ts
│   │   │   │   │   └── tierPriceUtils.ts
│   │   │   │   ├── hooks/
│   │   │   │   │   └── useEventPhotos.ts
│   │   │   │   ├── modals/
│   │   │   │   │   ├── AbortEventModal.tsx
│   │   │   │   │   ├── AddCustomFieldModal.tsx
│   │   │   │   │   ├── AddEventTaskModal.tsx
│   │   │   │   │   ├── ArchiveEventModal.tsx
│   │   │   │   │   ├── CreateEventModal.tsx
│   │   │   │   │   ├── DeleteEventTaskModal.tsx
│   │   │   │   │   ├── EventActivityModal.tsx
│   │   │   │   │   ├── EventFiltersModal.css
│   │   │   │   │   ├── EventFiltersModal.tsx
│   │   │   │   │   ├── FinalizeEventModal.tsx
│   │   │   │   │   ├── HoldEventModal.tsx
│   │   │   │   │   ├── ImportRegistrationsModal.tsx
│   │   │   │   │   ├── ReactivateEventModal.tsx
│   │   │   │   │   ├── RemoveAttendanceModal.tsx
│   │   │   │   │   ├── RemoveEventTaskAssignmentModal.css
│   │   │   │   │   └── RemoveEventTaskAssignmentModal.tsx
│   │   │   │   ├── EventsPage.css
│   │   │   │   ├── EventsPage.tsx
│   │   │   │   └── PastEventsPage.tsx
│   │   │   ├── Finance/
│   │   │   │   ├── components/
│   │   │   │   │   ├── AccountBalancesSection.tsx
│   │   │   │   │   ├── FinanceChartsSection.tsx
│   │   │   │   │   ├── FinanceModal.tsx
│   │   │   │   │   ├── LiabilitiesTracker.tsx
│   │   │   │   │   ├── TransactionLogTable.tsx
│   │   │   │   │   └── UpcomingScheduledList.tsx
│   │   │   │   ├── modals/
│   │   │   │   │   ├── AccountFormModal.tsx
│   │   │   │   │   ├── LiabilityFormModal.tsx
│   │   │   │   │   ├── ScheduledItemFormModal.tsx
│   │   │   │   │   └── TransactionFormModal.tsx
│   │   │   │   ├── exportFinanceExcel.ts
│   │   │   │   ├── FinanceDashboardPage.css
│   │   │   │   └── FinanceDashboardPage.tsx
│   │   │   ├── HelpAndSupport/
│   │   │   │   ├── HelpAndSupportPage.css
│   │   │   │   ├── HelpAndSupportPage.tsx
│   │   │   │   └── PortalIncidentReportForm.tsx
│   │   │   ├── Personnel/
│   │   │   │   ├── Administration/
│   │   │   │   │   ├── modals/
│   │   │   │   │   │   ├── AddOfficerModal.tsx
│   │   │   │   │   │   ├── EditAdminMembersModal.tsx
│   │   │   │   │   │   ├── LeadershipHandoverModal.tsx
│   │   │   │   │   │   └── OfficerHandoverModal.tsx
│   │   │   │   │   ├── AdministrationPage.css
│   │   │   │   │   └── AdministrationPage.tsx
│   │   │   │   ├── Alumni/
│   │   │   │   │   ├── modals/
│   │   │   │   │   │   └── AlumniFiltersModal.tsx
│   │   │   │   │   └── AlumniPage.tsx
│   │   │   │   ├── Members/
│   │   │   │   │   ├── modals/
│   │   │   │   │   │   ├── AssignToTeamModal.tsx
│   │   │   │   │   │   └── MembersFiltersModal.tsx
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
│   │   │   │   │   │   ├── __tests__/
│   │   │   │   │   │   │   └── scheduleTimelineExport.test.ts
│   │   │   │   │   │   ├── GanttChart.css
│   │   │   │   │   │   ├── GanttChart.tsx
│   │   │   │   │   │   └── scheduleTimelineExport.ts
│   │   │   │   │   ├── PhaseRow/
│   │   │   │   │   │   ├── PhaseRow.css
│   │   │   │   │   │   └── PhaseRow.tsx
│   │   │   │   │   ├── ProjectCard/
│   │   │   │   │   │   ├── ProjectCard.tsx
│   │   │   │   │   │   └── projectCardAdapter.ts
│   │   │   │   │   ├── ScheduleTimetable/
│   │   │   │   │   │   ├── ScheduleTimetable.css
│   │   │   │   │   │   └── ScheduleTimetable.tsx
│   │   │   │   │   ├── ProjectCertificatesSection.css
│   │   │   │   │   └── ProjectCertificatesSection.tsx
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
│   │   │   │   │   ├── ProjectFiltersModal.tsx
│   │   │   │   │   ├── ReactivateProjectModal.tsx
│   │   │   │   │   ├── TaskActivityModal.tsx
│   │   │   │   │   ├── TaskCommentsModal.tsx
│   │   │   │   │   └── TaskScheduleSlotsModal.tsx
│   │   │   │   ├── PastProjectsPage.tsx
│   │   │   │   ├── ProjectsPage.css
│   │   │   │   └── ProjectsPage.tsx
│   │   │   ├── SiteContent/
│   │   │   │   ├── components/
│   │   │   │   │   ├── ConfirmDeleteModal.tsx
│   │   │   │   │   ├── PageHeaderEditor.tsx
│   │   │   │   │   ├── PublicVisibilityToggle.tsx
│   │   │   │   │   ├── SiteContentModal.tsx
│   │   │   │   │   └── SupportFormSubmissionsTable.tsx
│   │   │   │   ├── modals/
│   │   │   │   │   ├── AddAboutSectionModal.tsx
│   │   │   │   │   ├── EditAboutSectionModal.tsx
│   │   │   │   │   ├── EditContactMethodModal.tsx
│   │   │   │   │   ├── EditSocialLinkModal.tsx
│   │   │   │   │   ├── IncidentReportDetailModal.tsx
│   │   │   │   │   └── SupportContentModals.tsx
│   │   │   │   ├── AboutEditorPage.tsx
│   │   │   │   ├── ContactEditorPage.tsx
│   │   │   │   ├── SiteContent.css
│   │   │   │   └── SupportEditorPage.tsx
│   │   │   ├── User/
│   │   │   │   └── UserPage.css
│   │   │   ├── LoginPage.css
│   │   │   └── SideBarNavigationSlim.css
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
│   ├── utils/
│   │   └── supabase/
│   ├── .dockerignore
│   ├── .env.local
│   ├── .env.local.example
│   ├── Dockerfile
│   ├── eslint.config.mjs
│   ├── lighthouse-pwa-v11.json
│   ├── lighthouse-pwa.json
│   ├── next-env.d.ts
│   ├── next-pwa.d.ts
│   ├── next.config.ts
│   ├── package.json
│   ├── pnpm-workspace.docker.yaml
│   ├── README.hf.md
│   ├── tsconfig.json
│   └── tsconfig.tsbuildinfo
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── types/
│       │   │   ├── __tests__/
│       │   │   │   └── types.test.ts
│       │   │   ├── auth.ts
│       │   │   ├── concurrency.ts
│       │   │   ├── dashboard.ts
│       │   │   ├── event.ts
│       │   │   ├── finance.ts
│       │   │   ├── index.ts
│       │   │   ├── member.ts
│       │   │   ├── notification.ts
│       │   │   ├── phase.ts
│       │   │   ├── project.ts
│       │   │   ├── public.ts
│       │   │   ├── realtime.ts
│       │   │   ├── siteContent.ts
│       │   │   ├── supportContent.ts
│       │   │   ├── task.ts
│       │   │   └── team.ts
│       │   └── utils/
│       │       ├── __tests__/
│       │       │   ├── certificateLayoutWording.test.ts
│       │       │   ├── datetimeUtils.test.ts
│       │       │   ├── emailDomains.test.ts
│       │       │   └── eventDateTime.test.ts
│       │       ├── certificateLayoutWording.ts
│       │       ├── clubLocal.ts
│       │       ├── constants.ts
│       │       ├── dateInput.ts
│       │       ├── datetimeLocal.ts
│       │       ├── emailDomains.ts
│       │       ├── eventDateTime.ts
│       │       ├── eventDateTimeLocal.ts
│       │       ├── eventLocal.ts
│       │       ├── formatDual.ts
│       │       ├── formatInstant.ts
│       │       ├── formatSession.ts
│       │       └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── public-website/
│   ├── public/
│   │   ├── icons/
│   │   ├── images/
│   │   ├── favicon.ico
│   │   ├── file.svg
│   │   ├── globe.svg
│   │   ├── next.svg
│   │   ├── vercel.svg
│   │   └── window.svg
│   ├── scripts/
│   │   └── materialize-public-images.mjs
│   ├── src/
│   │   ├── app/
│   │   │   ├── about/
│   │   │   │   └── page.tsx
│   │   │   ├── api/
│   │   │   │   └── ping/
│   │   │   │       └── route.ts
│   │   │   ├── contact/
│   │   │   │   └── page.tsx
│   │   │   ├── events/
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── confirmation/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── join/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── register/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── page.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── members/
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── projects/
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── support/
│   │   │   │   └── page.tsx
│   │   │   ├── verify/
│   │   │   │   └── [code]/
│   │   │   │       └── page.tsx
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── about/
│   │   │   │   └── AboutSections.tsx
│   │   │   ├── cards/
│   │   │   │   └── event-card.css
│   │   │   ├── certificates/
│   │   │   │   ├── CertificateCanvas.css
│   │   │   │   ├── CertificateCanvas.tsx
│   │   │   │   └── VerifyCertificateView.tsx
│   │   │   ├── contact/
│   │   │   │   ├── ContactForm.tsx
│   │   │   │   └── ContactMethods.tsx
│   │   │   ├── datetime/
│   │   │   │   └── ClientDateTime.tsx
│   │   │   ├── events/
│   │   │   │   ├── circular-gallery/
│   │   │   │   │   ├── CircularGallery.css
│   │   │   │   │   ├── CircularGallery.d.ts
│   │   │   │   │   ├── CircularGallery.jsx
│   │   │   │   │   ├── EventCircularGallery.css
│   │   │   │   │   └── EventCircularGallery.tsx
│   │   │   │   ├── event-share.css
│   │   │   │   ├── EventCard.tsx
│   │   │   │   ├── EventDetailActions.tsx
│   │   │   │   ├── EventDetailHeader.tsx
│   │   │   │   ├── EventShareMenu.tsx
│   │   │   │   ├── EventsList.tsx
│   │   │   │   ├── JoinSessionCountdown.tsx
│   │   │   │   └── JoinSessionStatus.tsx
│   │   │   ├── form/
│   │   │   │   └── form.css
│   │   │   ├── home/
│   │   │   │   ├── AboutPreview.tsx
│   │   │   │   ├── CtaBand.tsx
│   │   │   │   ├── HeroSection.tsx
│   │   │   │   ├── Highlights.css
│   │   │   │   ├── Highlights.tsx
│   │   │   │   ├── PastEventsPreview.tsx
│   │   │   │   ├── RecentProjectsPreview.tsx
│   │   │   │   ├── rubiks-cube.css
│   │   │   │   ├── RubiksCube.tsx
│   │   │   │   ├── UpcomingEventsPreview.tsx
│   │   │   │   └── WhyIclub.tsx
│   │   │   ├── layout/
│   │   │   │   ├── BrandLogos.tsx
│   │   │   │   ├── footer.css
│   │   │   │   ├── Footer.tsx
│   │   │   │   ├── layout.css
│   │   │   │   ├── Navbar.tsx
│   │   │   │   └── SocialLinks.tsx
│   │   │   ├── members/
│   │   │   │   ├── LeadershipPyramid.tsx
│   │   │   │   ├── MemberProfileView.tsx
│   │   │   │   ├── members.css
│   │   │   │   ├── MembersBrowse.tsx
│   │   │   │   ├── MembersGrid.tsx
│   │   │   │   ├── PublicMemberAchievements.tsx
│   │   │   │   ├── PublicMemberCard.tsx
│   │   │   │   ├── PublicMemberRoleHistory.tsx
│   │   │   │   └── TeamLeadershipAccord.tsx
│   │   │   ├── navigation/
│   │   │   │   ├── back-link.css
│   │   │   │   └── BackLink.tsx
│   │   │   ├── projects/
│   │   │   │   ├── ProjectCard.tsx
│   │   │   │   ├── ProjectShareMenu.tsx
│   │   │   │   └── ProjectsList.tsx
│   │   │   ├── public-data/
│   │   │   │   ├── AboutPageContent.tsx
│   │   │   │   ├── ConfirmationPageContent.tsx
│   │   │   │   ├── ContactPageContent.tsx
│   │   │   │   ├── DataLoadingState.tsx
│   │   │   │   ├── EventDetailContent.tsx
│   │   │   │   ├── EventsPageContent.tsx
│   │   │   │   ├── FooterContactClient.tsx
│   │   │   │   ├── HomeEventsSection.tsx
│   │   │   │   ├── HomeProjectsSection.tsx
│   │   │   │   ├── MemberProfileContent.tsx
│   │   │   │   ├── MembersPageContent.tsx
│   │   │   │   ├── ProjectDetailContent.tsx
│   │   │   │   ├── ProjectsPageContent.tsx
│   │   │   │   ├── RegisterPageContent.tsx
│   │   │   │   └── SupportPageContent.tsx
│   │   │   ├── registration/
│   │   │   │   ├── ConfirmationFromCache.tsx
│   │   │   │   ├── EventTicketDisplay.tsx
│   │   │   │   ├── RegisterPageGuard.tsx
│   │   │   │   ├── registration.css
│   │   │   │   ├── RegistrationConfirmation.tsx
│   │   │   │   └── RegistrationForm.tsx
│   │   │   ├── support/
│   │   │   │   ├── IncidentReportForm.tsx
│   │   │   │   └── SupportNotices.tsx
│   │   │   ├── ui/
│   │   │   │   ├── CardScrollList.tsx
│   │   │   │   ├── index.tsx
│   │   │   │   ├── ui.css
│   │   │   │   ├── YesNoToggle.css
│   │   │   │   └── YesNoToggle.tsx
│   │   │   └── EmailInputWithDomainSuggestions.tsx
│   │   ├── content/
│   │   ├── lib/
│   │   └── types/
│   ├── .dockerignore
│   ├── .env.local
│   ├── .env.local.example
│   ├── .gitignore
│   ├── Dockerfile
│   ├── eslint.config.mjs
│   ├── next-env.d.ts
│   ├── next.config.ts
│   ├── package.json
│   ├── pnpm-workspace.docker.yaml
│   ├── postcss.config.mjs
│   ├── README.hf.md
│   ├── README.md
│   ├── tsconfig.json
│   ├── tsconfig.tsbuildinfo
│   └── vitest.config.ts
├── scripts/
│   ├── security/
│   │   └── check-pentest-prereqs.ps1
│   └── datetime-audit.mjs
├── .dockerignore
├── .editorconfig
├── .gitignore
├── .prettierignore
├── .prettierrc
├── body.txt
├── docker-compose.yml
├── Dockerfile
├── eslint.config.mjs
├── iClub Website Development Roadmap.pdf
├── package.json
├── playwright.config.ts
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── pwa-devtools-check.json
├── test-setup.ts
├── vitest.config.ci.ts
└── vitest.config.ts
```

Excluded directories: node_modules, .next, dist, coverage, test-results, generated, cache, logs, screenshots, migrations (content).