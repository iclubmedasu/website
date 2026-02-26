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