# iClub Management API Documentation

## Base URL
```
http://localhost:3000/api
```

---

## 1. MEMBERS API

### Get All Members
```
GET /api/members
Query Parameters:
  - isActive (optional): true/false
```

### Get Single Member
```
GET /api/members/:id
Returns member with all team memberships and role history
```

### Create Member
```
POST /api/members
Body: {
  "fullName": "John Doe",
  "email": "john@example.com",
  "phoneNumber": "+1234567890",
  "studentId": 12345,
  "profilePhotoUrl": "https://...",  // optional
  "linkedInUrl": "https://...",      // optional
  "joinDate": "2024-01-01"           // optional
}
```

### Update Member
```
PUT /api/members/:id
Body: {
  "fullName": "Updated Name",
  // any other fields to update
}
```

### Deactivate Member
```
PATCH /api/members/:id/deactivate
```

### Activate Member
```
PATCH /api/members/:id/activate
```

### Delete Member Permanently
```
DELETE /api/members/:id
⚠️ Use with caution - this is permanent!
```

---

## 2. TEAMS API

### Get All Teams
```
GET /api/teams
Query Parameters:
  - isActive (optional): true/false
```

### Get Single Team
```
GET /api/teams/:id
Returns team with all members, roles, and history
```

### Create Team
```
POST /api/teams
Body: {
  "name": "Marketing Team",
  "establishedDate": "2024-01-01"  // optional
}
```

### Update Team
```
PUT /api/teams/:id
Body: {
  "name": "Updated Team Name",
  "isActive": true,
  "establishedDate": "2024-01-01"
}
```

### Deactivate Team
```
PATCH /api/teams/:id/deactivate
```

### Activate Team
```
PATCH /api/teams/:id/activate
```

### Delete Team
```
DELETE /api/teams/:id
```

---

## 3. TEAM ROLES API

### Get All Roles
```
GET /api/team-roles
Query Parameters:
  - teamId (optional): filter by team
  - isActive (optional): true/false
```

### Get Single Role
```
GET /api/team-roles/:id
```

### Create Role
```
POST /api/team-roles
Body: {
  "teamId": 1,
  "roleName": "Team Lead",
  "maxCount": 1  // optional, null = unlimited
}
```

### Update Role
```
PUT /api/team-roles/:id
Body: {
  "roleName": "Senior Team Lead",
  "maxCount": 2,
  "isActive": true
}
```

### Deactivate Role
```
PATCH /api/team-roles/:id/deactivate
```

### Activate Role
```
PATCH /api/team-roles/:id/activate
```

### Delete Role
```
DELETE /api/team-roles/:id
⚠️ Cannot delete if role has active assignments
```

---

## 4. TEAM MEMBERS API (Core Functionality)

### Get All Team Member Assignments
```
GET /api/team-members
Query Parameters:
  - teamId (optional)
  - memberId (optional)
  - isActive (optional): true/false
```

### Get Single Assignment
```
GET /api/team-members/:id
```

### Assign Member to Team
```
POST /api/team-members/assign
Body: {
  "memberId": 1,
  "teamId": 1,
  "roleId": 1,
  "changeReason": "New member onboarding",  // optional
  "notes": "Additional notes"               // optional
}
✅ Automatically creates role history entry
```

### Change Member's Role in Team
```
PATCH /api/team-members/:id/change-role
Body: {
  "newRoleId": 2,
  "changeType": "Promotion",  // or "Demotion"
  "changeReason": "Excellent performance",
  "notes": "Promoted after 6 months"
}
✅ Closes old role history and creates new one
```

### Transfer Member to Different Team
```
PATCH /api/team-members/:id/transfer
Body: {
  "newTeamId": 2,
  "newRoleId": 3,
  "changeReason": "Department restructuring",
  "notes": "Moved to tech team"
}
✅ Closes current assignment and creates new one with history
```

### Remove Member from Team
```
PATCH /api/team-members/:id/remove
Body: {
  "changeType": "Resignation",  // or "Expelled", "Graduated"
  "changeReason": "Left organization",
  "notes": "Good terms"
}
✅ Marks assignment as inactive and closes role history
```

---

## 5. ROLE HISTORY API

### Get All Role History
```
GET /api/role-history
Query Parameters:
  - memberId (optional)
  - teamId (optional)
  - changeType (optional): "New", "Promotion", "Demotion", "Transfer", "Resignation", "Expelled", "Graduated"
  - isActive (optional): true/false
```

### Get Single History Entry
```
GET /api/role-history/:id
```

### Get Complete History for a Member
```
GET /api/role-history/member/:memberId
```

### Get Member's Timeline (Formatted)
```
GET /api/role-history/member/:memberId/timeline
Returns formatted timeline with duration calculations
```

### Get Complete History for a Team
```
GET /api/role-history/team/:teamId
```

### Get Statistics About Role Changes
```
GET /api/role-history/stats/changes
Returns count of each change type
```

### Update History Entry
```
PUT /api/role-history/:id
Body: {
  "changeReason": "Updated reason",
  "notes": "Additional context",
  "changeType": "Promotion"
}
```

### Delete History Entry
```
DELETE /api/role-history/:id
⚠️ Use with extreme caution!
```

---

## 6. DOCUMENTS API

All document endpoints require authentication (`Authorization` header / session).

### Auth notes (two-tier visibility)
- **ORG_LEADERSHIP**: developer, Officer, President, Vice President — sees **all** documents and folders; may manage/grant any (admin override)
- **TEAM_LEADERSHIP**: Head/Vice of a non-Administration team — natural view+manage only for docs/folders whose `scopeTeamId` is one of their led teams
- Ownership is positional: `scopeTeamId == null` → org-owned; `scopeTeamId == X` → Head/Vice of team X (plus org leadership)
- Members with **no document rank** cannot open Documents (list endpoints return 403; nav is hidden)
- **Grants are TEAM-only**: a TEAM grant means **Head + Vice of that team** (not all members). Legacy MEMBER grant rows are ignored in permission checks and cannot be created. Grant recipients are **view-only** (never manage)
- Folder ACL (category grant) covers **all documents in that folder** (current + future) for Head/Vice of the granted team
- Document ACL covers that document only (same TEAM Head/Vice rule)
- **Categories** GET: requires document rank (else 403); locked stubs + `canManageAccess` for visible folders
- **Categories** POST: document rank required; `scopeTeamId` resolved like document upload
- **Categories** PUT/DELETE: `canMemberGrantCategory` (natural ownership / org override only)
- **Documents** list GET: requires document rank (else 403); locked stubs + `canManageAccess` for visible docs
- **Documents** create: document rank required; `categoryId` optional (null = root / uncategorized)
- **Documents** PUT/PATCH/DELETE: admin-equivalent **or** the uploader (`uploadedById`)
- **Documents** GET by id / download: `requireDocumentAccess` (org → team scope → folder ACL → doc ACL)
- **Grants / access-request approve|deny**: `canMemberGrantDocument` / `canMemberGrantCategory` (**natural access only**)
- **Category grants / access-log**: `canMemberGrantCategory`
- **Create access request** (doc or folder): caller must have `TEAM_LEADERSHIP` rank and must **not** already pass view check
- **Document access log**: admin-equivalent (`isDeveloper` or Administration membership) **or** uploader

### List Document Categories
```
GET /api/document-categories
Requires document rank (else 403)
Returns categories ordered by `order` ascending

For each category:
  - If the member can view it → full payload (id, name, order, scopeTeamId, timestamps, …)
    plus canManageAccess: boolean (canMemberGrantCategory — natural ownership only)
  - If not → locked stub only: { id, name, locked: true }
```

### Create Document Category
```
POST /api/document-categories
Body: {
  "name": "Policies",
  "order": 0,          // optional, defaults to 0
  "scopeTeamId": 3     // optional; required semantics depend on rank
}
Requires org or team leadership document rank

Scope rules (same as document upload via resolveScopeTeamId):
  - TEAM_LEADERSHIP: scopeTeamId defaults to first leadership team; if provided must be in that list (else 403)
  - ORG_LEADERSHIP: scopeTeamId optional (null = org-owned)
```

### Update Document Category
```
PUT /api/document-categories/:id
Body: {
  "name": "Updated Name",  // optional
  "order": 1               // optional
}
Requires canMemberGrantCategory (folder owner or org leadership)
403: { "error": "Folder update requires ownership" }
```

### Delete Document Category
```
DELETE /api/document-categories/:id
Requires canMemberGrantCategory (folder owner or org leadership)
403: { "error": "Folder delete requires ownership" }
409 if the category still has documents: { "error": "Category still has documents..." }
```

### Create Category Access Request
```
POST /api/document-categories/:id/access-requests
Requires TEAM_LEADERSHIP document rank (else 403)
Caller must NOT already pass canMemberViewCategory (else 400)
409 if a PENDING request already exists for the same member+category

Body (optional): {
  "note": "Need this for onboarding"   // not stored; included in notification body only
}

Creates PENDING DocumentCategoryAccessRequest
Best-effort notification DOCUMENT_ACCESS_REQUESTED to grant reviewers:
  - active Administration org leadership (Officer / President / VP)
  - if category.scopeTeamId set: active Head/Vice on that team
  - excludes requester
201 → created DocumentCategoryAccessRequest
```

### List Category Access Requests
```
GET /api/document-categories/access-requests?status=PENDING
Requires document rank (else 403)
Query:
  - status (optional, default PENDING)

Loads requests with that status + category
Returns only requests where the viewer passes canMemberGrantCategory for the category
```

### Approve Category Access Request
```
PATCH /api/document-categories/access-requests/:id/approve
Requires canMemberGrantCategory on the request's category
Rejects if request is not PENDING
400 if the requester currently leads no teams as Head/Vice

Body: {
  "durationPreset": "DAY" | "WEEK" | "MONTH" | "INDEFINITE"
}

Creates DocumentCategoryAccessGrant(s) with grantedToType TEAM for **each** team the requester
currently leads as Head/Vice (upserts active grant / updates expiresAt; grantedById = reviewer)
Sets request status APPROVED + reviewedById / reviewedAt
Response: { grants: DocumentCategoryAccessGrant[], request: DocumentCategoryAccessRequest }
```

### Deny Category Access Request
```
PATCH /api/document-categories/access-requests/:id/deny
Requires canMemberGrantCategory on the request's category
Rejects if request is not PENDING

Body (optional): {
  "reviewNote": "Not appropriate for this role"
}

Sets status DENIED + optional reviewNote + reviewedById / reviewedAt
```

### List Category Grants
```
GET /api/document-categories/:id/grants
Requires canMemberGrantCategory
Returns grants (newest first) including member/team names and grantedBy/revokedBy
```

### Create Category Grant
```
POST /api/document-categories/:id/grants
Requires canMemberGrantCategory
Body: {
  "grantedToType": "TEAM",
  "teamId": 3,               // required
  "durationPreset": "DAY" | "WEEK" | "MONTH" | "INDEFINITE"
}
MEMBER grants are rejected with 400
201 → created DocumentCategoryAccessGrant (applies to Head + Vice of that team)
```

### Revoke Category Grant
```
PATCH /api/document-categories/:id/grants/:grantId/revoke
Requires canMemberGrantCategory
```

### Category Access Log
```
GET /api/document-categories/:id/access-log?cursor=&limit=
Requires canMemberGrantCategory
Response: { "accessLogs": [...], "nextCursor": <id|null> }
```

### Log Category View (folder open)
```
POST /api/document-categories/:id/view-log
Any authenticated member
Creates DocumentCategoryAccessLog with action VIEW
```

### List Documents
```
GET /api/documents
Requires document rank (else 403)
Query Parameters:
  - categoryId (optional): numeric id, or "null"/empty for root docs
  - root=true|1 (optional): filter to categoryId IS NULL (root / uncategorized)
  - scopeTeamId (optional)

For each document:
  - If the member can view it → full payload (id, title, categoryId|null, fileUrl, fileType,
    fileSizeBytes, scopeTeamId, creatorRank, uploadedById, timestamps, etc.)
    plus canManageAccess: boolean (canMemberGrantDocument — natural access only)
  - If not → locked stub only: { id, title, categoryId, locked: true }
    (no fileUrl)
```

### Get Document
```
GET /api/documents/:id
Requires document access
Returns full document with:
  - category: { id, name } | null
  - uploadedBy: { id, fullName }
  - canManageAccess: boolean (canMemberGrantDocument — natural access only)
Fire-and-forget access log with action VIEW
```

### Download Document
```
GET /api/documents/:id/download
Requires document access
Streams file from GitHub storage (Content-Type / Content-Disposition)
Fire-and-forget access log with action DOWNLOAD
```

### Create Document
```
POST /api/documents
Content-Type: multipart/form-data (field "file") OR application/json with fileBase64

Body (multipart or JSON): {
  "title": "Handbook 2026",
  "categoryId": 1,           // optional; omit/null = root upload
  "scopeTeamId": 3,          // optional; required semantics depend on rank
  "file": <binary>,          // multipart
  "fileBase64": "...",       // JSON alternative when no multipart file
  "fileName": "handbook.pdf", // optional with fileBase64
  "mimeType": "application/pdf" // optional with fileBase64
}

Scope rules:
  - TEAM_LEADERSHIP: scopeTeamId defaults to first leadership team; if provided must be in that list (else 403)
  - ORG_LEADERSHIP: scopeTeamId optional (null = org-wide)

Stores GitHub path in fileUrl (documents/{id}/{uuid}-{safeName})
Requires ORG_LEADERSHIP or TEAM_LEADERSHIP document rank
creatorRank stored as ORG_LEADERSHIP | TEAM_LEADERSHIP
```

### Batch Create Documents
```
POST /api/documents/batch
Content-Type: multipart/form-data
Fields:
  - files: one or more files (field name "files", max 20)
  - categoryId: optional
  - scopeTeamId: optional (same rules as single upload)
  - titles: optional JSON array of titles aligned with files (fallback: filename stem)

201 → array of created documents
```

### Update Document
```
PUT /api/documents/:id
PATCH /api/documents/:id
Body: {
  "title": "Updated Title",  // optional
  "categoryId": 2            // optional; null or "" moves to root
}
Admin-equivalent or uploader only
File replace is not supported on this endpoint
Use categoryId change for drag-and-drop into folders
```

### Delete Document
```
DELETE /api/documents/:id
Admin-equivalent or uploader only
Best-effort GitHub delete (resolves SHA via getCurrentFileSha), then deletes DB row
(cascades grants/logs)
```

### durationPreset
Used by approve access-request and create grant:
- `DAY` → expires in 1 day
- `WEEK` → expires in 7 days
- `MONTH` → expires in 30 days
- `INDEFINITE` → `expiresAt: null`
Invalid preset → 400

### List Grants
```
GET /api/documents/:id/grants
Requires canMemberGrantDocument
Returns all grants for the document (active + past), newest first, including:
  - grantedToType: TEAM (new grants); legacy MEMBER rows may still appear but are ignored for access
  - team: { id, name } when TEAM
  - grantedBy / revokedBy
```

### Create Direct Grant
```
POST /api/documents/:id/grants
Requires canMemberGrantDocument

Body: {
  "grantedToType": "TEAM",
  "teamId": 3,               // required
  "durationPreset": "DAY" | "WEEK" | "MONTH" | "INDEFINITE"
}

MEMBER grants are rejected with 400
201 → created DocumentAccessGrant (Head + Vice of that team)
```

### Revoke Grant
```
PATCH /api/documents/:id/grants/:grantId/revoke
Requires canMemberGrantDocument
400 if already revoked or already expired (expiresAt <= now)
Sets revokedAt / revokedById
```

### Create Access Request
```
POST /api/documents/:id/access-requests
Requires TEAM_LEADERSHIP document rank (else 403)
Caller must NOT already pass canMemberViewDocument (else 400)
409 if a PENDING request already exists for the same member+document

Body (optional): {
  "note": "Need this for onboarding"   // not stored; included in notification body only
}

Creates PENDING DocumentAccessRequest
Best-effort notification DOCUMENT_ACCESS_REQUESTED to grant reviewers:
  - active Administration org leadership (Officer / President / VP)
  - if document.scopeTeamId set: active Head/Vice on that team
  - excludes requester
201 → created DocumentAccessRequest
```

### List Access Requests
```
GET /api/documents/access-requests?status=PENDING
Requires document rank (else 403)
Query:
  - status (optional, default PENDING)

Loads requests with that status + document
Returns only requests where the viewer passes canMemberGrantDocument for the document
```

### Approve Access Request
```
PATCH /api/documents/access-requests/:id/approve
Requires canMemberGrantDocument on the request's document
Rejects if request is not PENDING
400 if the requester currently leads no teams as Head/Vice

Body: {
  "durationPreset": "DAY" | "WEEK" | "MONTH" | "INDEFINITE"
}

Creates DocumentAccessGrant(s) with grantedToType TEAM for **each** team the requester
currently leads as Head/Vice (upserts active grant / updates expiresAt; grantedById = reviewer)
Sets request status APPROVED + reviewedById / reviewedAt
Response: { grants: DocumentAccessGrant[], request: DocumentAccessRequest }
```

### Deny Access Request
```
PATCH /api/documents/access-requests/:id/deny
Requires canMemberGrantDocument on the request's document
Rejects if request is not PENDING

Body (optional): {
  "reviewNote": "Not appropriate for this role"
}

Sets status DENIED + optional reviewNote + reviewedById / reviewedAt
```

### Document Access Log
```
GET /api/documents/:id/access-log?cursor=&limit=
Admin-equivalent (isDeveloper or Administration membership) OR document uploader only
Query:
  - cursor (optional): log id; returns rows with id < cursor
  - limit (optional, default 20, clamped 1–100)

Ordered by id desc
Includes member fullName
Response: { "accessLogs": [...], "nextCursor": <id|null> }
```

---

## 6b. ANNOUNCEMENTS API

Authenticated members. Management actions require developer / officer / administration / leadership / special (`canManageAnnouncements`).

### Availability for assignment UIs (advisory)

```
GET /api/announcements/availability?eventId=
GET /api/announcements/availability?projectId=
```

Exactly one of `eventId` / `projectId`.

**Auth (not announcement-manager-only):**
- `eventId`: same as event assignable-members (`canUserManageEventTasks`)
- `projectId`: same as project visibility (`canUserViewProject`)

Returns the **latest active** announcement for that target (`createdAt` desc), plus all responses:

```json
{
  "announcement": { "id", "title", "targetType", "eventId", "projectId" },
  "responses": [{
    "memberId": 1,
    "status": "AVAILABLE",
    "notes": null,
    "member": { "id", "fullName", "profilePhotoUrl" },
    "periods": [{ "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" }]
  }]
}
```

When none: `{ "announcement": null, "responses": [] }`. Client assignment UIs use this for soft/advisory hints only — never blocks save.

---

## Common Response Formats

### Success Response
```json
{
  "id": 1,
  "fullName": "John Doe",
  ...
}
```

### Error Response
```json
{
  "error": "Error message here"
}
```

---

## Workflow Examples

### Example 1: Onboard New Member
```
1. POST /api/members
   → Create member profile

2. POST /api/team-members/assign
   → Assign to team with role
   → Automatically creates role history
```

### Example 2: Promote Member
```
1. PATCH /api/team-members/:id/change-role
   → Changes role
   → Closes old role history
   → Creates new role history
```

### Example 3: Transfer Member
```
1. PATCH /api/team-members/:id/transfer
   → Closes current team assignment
   → Creates new team assignment
   → Updates role history
```

### Example 4: Member Leaves
```
1. PATCH /api/team-members/:id/remove
   → Marks assignment inactive
   → Closes role history

2. PATCH /api/members/:id/deactivate (optional)
   → Deactivate member entirely
```

---

## Change Types Reference

- **New**: Initial assignment to team
- **Promotion**: Role upgrade within team
- **Demotion**: Role downgrade within team
- **Transfer**: Move to different team
- **Resignation**: Member voluntarily left
- **Expelled**: Member forcibly removed
- **Graduated**: Member completed program/tenure

---

## Testing with cURL

### Create a Member
```bash
curl -X POST http://localhost:3000/api/members \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Jane Smith",
    "email": "jane@example.com",
    "phoneNumber": "+1987654321",
    "studentId": 67890
  }'
```

### Assign to Team
```bash
curl -X POST http://localhost:3000/api/team-members/assign \
  -H "Content-Type: application/json" \
  -d '{
    "memberId": 1,
    "teamId": 1,
    "roleId": 1,
    "changeReason": "New member"
  }'
```