# iClub — Cursor Prompts: Analytics, Security, Multi-Client Structure, and Deploy Safety

**How to use these prompts:** Every prompt below follows the same shape:
Cursor investigates the relevant code first, explains what it found **in plain
language, no jargon**, then asks you a specific question with clear options.
It should not write or change any code until you reply with your decision in
the chat. This is deliberate — since you're not reviewing the code yourself,
you want to be the one deciding "yes, do that fix" rather than trusting an AI
to silently judge what's safe to change.

If Cursor ever skips straight to making changes without asking first, stop it
and re-paste the prompt — that means it didn't follow the instruction.

Four tracks. Phase B (security) is the most urgent. Phase C (multi-client
structure) matters most **before** you create a separate deployment for Dr.
Ashraf. Phase D (rollback/beta/error logging) is worth doing before you're
pushing frequent changes to a paying client's live deployment. Do B1 through
B4 first if you only have time for a few things this week.


---

## PHASE A — Usage Analytics / Data Collection

### A1 — Where to store usage data

```
Investigate, explain, and ask — do not create anything yet.

Look at backend/prisma/schema.prisma and backend/services for any existing
activity-log-style table or service (e.g. activityLogService.ts) that
already records "who did what."

Step 1: Explain plainly what already exists, if anything, and whether it
could be reused for tracking product usage (event counts, certificate
counts, etc.) or whether it's built for a different purpose (e.g. an
audit trail for compliance, which usually stores different information
than what we want here).

Step 2: Propose, in plain language, either "reuse the existing X" or "add a
new small table called UsageEvent that stores: which member did something
(if any), what type of action (e.g. event created, certificate issued),
which record it relates to, and when — nothing else, no personal details
like names or emails, just IDs and counts."

Step 3: Ask me: "Does this plan sound right to you, or do you want to see
the exact list of fields before I create the migration?" Do not run any
migration until I confirm.
```

### A2 — Logging service

```
Once I've confirmed the plan from A1, create backend/services/
usageEventService.ts with one function that records a usage event, matching
the fields we agreed on.

Explain plainly, after writing it: this function is designed to never
crash the actual feature it's attached to — if logging fails for any
reason, the real action (like issuing a certificate) still succeeds, and
the logging failure is just noted quietly in the background.

Confirm this makes sense to me before moving to instrumenting real features
in A3.
```

### A3 — Where to actually record usage

```
Explain, then ask, then implement only after I confirm.

Step 1: List, in plain language, the specific actions you're proposing to
track: event creation, certificate issuance, check-in scans, new
registrations, data exports, and logins. For each, tell me which file and
which existing line of code you'd attach the tracking call to.

Step 2: Ask me: "Does this list match what you actually care about
tracking, or do you want to add/remove anything?"

Step 3: Once I confirm, add the tracking calls at each point, making sure
none of them can block or break the actual feature (fire-and-forget, as
established in A2).
```

### A4 — Immediate option: ready-to-use Supabase SQL queries (no app changes)

```
This produces plain SQL for me to paste into Supabase's own SQL Editor —
it does not touch the app's code at all, no migration, no new endpoint.

Look at backend/prisma/schema.prisma to confirm the actual table/column
names for events, certificates, event check-ins/attendance, event
registrations, and members.

Write me five separate, ready-to-run SQL SELECT queries (read-only, no
INSERT/UPDATE/DELETE) for:
1. Number of events created in the last 30 days
2. Number of certificates issued in the last 30 days
3. Number of check-ins/attendance scans in the last 30 days
4. Number of registrations created in the last 30 days
5. Number of distinct members who logged in (or performed any action, if
   login isn't separately tracked) in the last 30 days

For each query, add a one-line comment above it explaining in plain
English what it counts. Give me the queries as plain text I can copy —
do not create a file, run anything, or modify the database.
```

**Recommended for now.** Run these directly in Supabase's SQL Editor
(read-only queries, so there's no risk of accidentally changing data) any
time you want a snapshot. No code changes needed. Consider asking whoever
manages your Supabase project settings whether a read-only database role
exists you could use here instead of your main connection, for extra
safety — full access isn't needed just to read counts.

### A4-later — In-app admin-only summary page (build once the trial is live)

```
Explain, then ask, then implement only after I confirm.

This is NOT a login bypass or hidden backdoor — it must use the exact same
role-check pattern already used to hide Administration and Finance from
regular members (check backend/lib/authorityFlags.ts for the isAdmin/
isOfficer helper already in use). Confirm this explicitly before building
anything.

Step 1: Propose, in plain language, what a simple summary screen would
show (e.g. "events created this month: 12, certificates issued: 45") and
where in the portal it would live — a new tab under an existing
admin-only area, or a new page hidden from the sidebar for anyone without
admin/officer rights.

Step 2: Ask me: "Where would you like this to live, and can you confirm
this should use the exact same role restriction as Administration/Finance,
with no separate or special access mechanism?"

Step 3: Once I confirm, build the backend endpoint (properly restricted
using the existing role-check helper) and a simple frontend view. Reuse an
existing charting approach if one is already a dependency; if not, ask me
before adding a new charting library.
```

**Build this later**, once Dr. Ashraf's trial is actually running and you
want a convenient always-on view rather than checking Supabase manually.
There's no rush — every new authenticated page is a small amount of new
surface area worth adding deliberately, not before it's needed.

### A5 — Trial disclosure wording (content only, no code)

```
This is a writing task, not a code change.

Draft a short paragraph (3-5 sentences), in plain English, for me to paste
into a trial agreement with a client. It should say that anonymized usage
analytics (feature usage counts, login activity) will be collected during
the trial to improve the product and help decide on fair pricing — and
explicitly state this does NOT include reading message content, personal
behavioral profiling, or tracking across other apps. State the data won't
be shared with third parties.

Just give me the text — do not create any files or write any code for this
step.
```

---

## PHASE B — Security Fixes (do these first)

### B1 — Password hashing

```
I need you to investigate, explain, and ask — not fix anything yet.

Open backend/routes/auth.ts and any related file that creates or checks
passwords (login, initial password setup, change-password, developer
backdoor if present).

Step 1: Tell me, in plain English, exactly what function is used to turn a
password into something stored in the database. Name the actual algorithm
(e.g. "bcrypt", "argon2", "plain SHA-256", "SHA-256 with a salt", etc.) and
where in the code you found it.

Step 2: Explain to me plainly why this matters: passwords should be hashed
with an algorithm specifically designed to be slow (bcrypt, argon2, or
scrypt), because that resists someone trying millions of password guesses
per second if the database ever leaks. A generic fast hash like SHA-256,
even with a salt added, does not have this protection and is considered
weak for password storage specifically (it's fine for other things, like
checksums, just not passwords).

Step 3: Tell me clearly which situation we're in:
  (a) Already using bcrypt/argon2/scrypt — nothing to do, tell me which one
      and I'll note it as confirmed-safe.
  (b) Using plain SHA-based hashing or something else weak — tell me this
      clearly, and also tell me: if we switch algorithms, every existing
      user's stored password hash cannot be converted, so all existing
      accounts will need a forced password reset the next time they log in.
      Ask me directly: "Do you want me to switch to bcrypt now (requires a
      forced reset for all existing users), or leave it as-is for now since
      you don't have real users yet?"

Do not modify any code in this pass. Just report and ask.
```

### B2 — JWT stored in browser storage

```
Investigate, explain, and ask — do not fix anything yet.

Open members-portal/src/services/api.ts and check how the login token is
stored and read (look for localStorage.setItem / getItem related to
auth_token, and also check whether an httpOnly cookie is also being set by
the backend on login).

Step 1: Explain to me plainly what's currently happening: is the login
token stored in the browser's localStorage, in an httpOnly cookie, or both?

Step 2: Explain the actual risk in plain terms: localStorage can be read by
any JavaScript running on the page. If there's ever a different bug
elsewhere in the app that lets an attacker inject a script (called XSS),
that script could read a token from localStorage and impersonate a logged-in
user. An httpOnly cookie cannot be read by JavaScript at all, even if such a
bug exists elsewhere — it's a stronger protection for the same token.

Step 3: Also check members-portal/src/context/RealtimeContext.tsx for how
the live-notifications connection authenticates, and tell me whether it
sends the token as part of the URL (query string) as a fallback — explain
that URLs get logged in browser history and server logs, so a token in a
URL is a similar, smaller version of the same risk.

Step 4: Ask me directly: "Do you want me to remove the localStorage copy
and rely only on the httpOnly cookie for authentication? This is a
one-time code change, should not require users to do anything differently,
but I'd like to test it thoroughly before you consider it done — should I
proceed?"

Do not modify any code in this pass. Just report and ask.
```

### B3 — Who can download attendee/finance data (export endpoints)

```
Investigate, explain, and ask — do not fix anything yet.

Find the code that handles downloading registration lists to Excel
(registrationExcelExport.ts and whatever route calls it), finance data
exports (financeExport.ts), and incident report exports
(incidentReportExport.ts).

Step 1: For each of the three, tell me plainly: right now, who is actually
allowed to trigger this download? Is it restricted to the event organizer /
leadership / officers, or could any logged-in member (even a brand new
regular member with no special role) currently download it?

Step 2: Explain why this matters in plain terms: these exports contain real
people's phone numbers and emails (registrations) or the club's/company's
money records (finance). If the check is too loose, any member account
could pull a full list of someone else's event attendees or financial data,
not just their own.

Step 3: For each of the three exports, tell me clearly whether it currently
looks "properly restricted", "too open", or "you're not sure and want my
input on what the correct rule should be."

Step 4: Ask me directly: "For each export that's too open, do you want me
to restrict it to [propose the specific role, e.g. event owner + leadership
for registrations, officers + Fundraising leadership for finance — using
the same role system already used elsewhere in the app]? Confirm which
roles should be allowed for each one before I change anything."

Do not modify any code in this pass. Just report and ask.
```

### B4 — Custom registration fields and stored script risk (XSS)

```
Investigate, explain, and ask — do not fix anything yet.

Open members-portal/src/features/Events/components/EventExpandedContent,
specifically EditableCustomFieldCell.tsx and CustomFieldColumnMenu.tsx, plus
anywhere else custom registration field values get displayed (registration
tables, exports, certificate previews).

Step 1: Explain plainly what a "custom field" is in this app's context —
it's a question the event organizer adds to the registration form, and
whatever the attendee types in gets stored and later shown to staff.

Step 2: Check whether any of these display locations render that
attendee-typed text as raw HTML (look for dangerouslySetInnerHTML or
similar) versus rendering it as plain text. Explain plainly: if it's raw
HTML, an attendee could type something like a hidden script into a form
field, and that script could run in a staff member's browser later when
they view the registration list — this is called stored XSS, and it's a
common way to steal a staff member's login session.

Step 3: Tell me clearly which situation we're in: "everything is rendered
safely as plain text already, nothing to fix" or "I found a spot that
renders raw HTML from attendee input, here's exactly where."

Step 4: If there is a problem spot, ask me: "Do you want me to change this
to render as plain text (safe, but any accidental HTML the organizer typed
on purpose would also stop working), or add a sanitization step that
strips dangerous parts but keeps basic formatting? Which do you prefer?"

Do not modify any code in this pass. Just report and ask.
```

### B5 — Certificate background image path

```
Investigate, explain, and ask — do not fix anything yet.

Open backend/routes/certificateTemplates.ts and find the part that updates
a certificate template's background image (the PATCH endpoint for
background).

Step 1: Explain plainly what's happening: when someone uploads a
certificate background, the app stores it at a specific file location
(path). Check whether the endpoint that updates this currently accepts
*any* path the client sends, or whether it checks the path matches an
expected pattern first.

Step 2: Explain the risk in plain terms: if a privileged user (or a bug, or
someone who compromised a privileged account) can set this path to
anything at all, they could potentially point a certificate at a file it
shouldn't have access to, or overwrite something unintended.

Step 3: Tell me clearly whether this is currently restricted or open.

Step 4: If open, ask me: "Do you want me to add a check that only accepts
paths matching the expected certificates/templates/{id}/background...
pattern, rejecting anything else? This matches how uploads already work
elsewhere in the app, so it shouldn't break normal usage — should I
proceed?"

Do not modify any code in this pass. Just report and ask.
```

### B6 — Error messages leaking details

```
Investigate, explain, and ask — do not fix anything yet.

Find the backend's central error-handling code (likely in server.ts or a
dedicated error-handling file).

Step 1: Explain plainly what happens right now when something breaks on
the backend — does the error response sent back to the browser include
technical details (like the exact error message or a stack trace), or just
a generic message?

Step 2: Explain the risk: technical error details can accidentally reveal
information about how the database or code is structured, which is more
useful to someone probing for weaknesses than it is to a normal user
(who just needs to know "something went wrong, try again").

Step 3: Tell me clearly whether this already only happens in development,
or whether it also happens when the app is running live for real users.

Step 4: Ask me: "Do you want me to make it so live/production responses
always show a generic message, while still logging the full technical
details somewhere only you can see (for debugging)? Development mode would
keep showing full details as it does now. Should I proceed?"

Do not modify any code in this pass. Just report and ask.
```

### B7 — GitHub file storage token scope (manual check, not code)

```
This is a manual check for you to do in GitHub's website settings, not a
code change — Cursor, just walk me through it step by step and I'll do the
clicking myself.

Explain plainly what to check:
1. Is the repository used for file storage (profile photos, certificates,
   project files) set to Private in its GitHub settings?
2. Is the access token used to write to it a "fine-grained personal access
   token" scoped to only that one repository, or a broader "classic"
   token that could access all of my GitHub repos and account?

Walk me through exactly where to look in GitHub's UI to answer both
questions for both the file-storage repo and the user-data repo. Do not
change any code — this is a settings check, and if I find something too
broad, I'll ask you for a follow-up prompt to help me regenerate a more
narrowly scoped token.
```

### B8 — Silent misconfiguration risk (NODE_ENV)

```
Investigate, explain, and ask — do not fix anything yet.

Open backend/server.ts and backend/lib/securityEnv.ts.

Step 1: Explain plainly: a lot of this app's protections (debug routes
being off, a developer login backdoor being off, etc.) only work correctly
if a setting called NODE_ENV is correctly set to "production" when the app
is actually live for real users. Tell me what currently happens if that
setting is accidentally left blank or misspelled when deploying — does the
app fail safely (protections stay on) or fail open (protections could turn
off without anyone noticing)?

Step 2: Ask me: "Do you want me to add a startup check that clearly warns
(or even refuses to start) if this setting looks missing or wrong when the
app is being deployed for real use? This adds a safety net without
changing anything about normal operation. Should I proceed, and if so,
would you rather it just warn loudly in the logs, or refuse to start
entirely until it's fixed?"

Do not modify any code in this pass. Just report and ask.
```

---

## Suggested order

Run B1 through B4 first and actually read Cursor's explanations before
answering — these cover the areas most likely to expose real people's data
(passwords, session tokens, exported PII, injected scripts). B5–B8 are lower
severity and can follow at your own pace. Start Phase A only once you're
comfortable with where Phase B landed, so you're not adding new tracking on
top of a system you haven't finished checking.

For Phase A specifically: run A1 through A3 to get the UsageEvent tracking
in place, then use **A4** (the Supabase SQL Editor queries) as your actual
day-to-day way of checking numbers for now — it needs no new app code and
no new authenticated page. Only build **A4-later** (the in-app admin page)
once Dr. Ashraf's trial is actually running and checking Supabase manually
starts to feel like a hassle.

For Phase C: run **C1, C2, and C3 before you create Dr. Ashraf's separate
deployment** — C3 specifically is where you tell Cursor how much
customization to actually support, based on what it found. Once you've
answered C3, C4 (and C5 if relevant) do the structural cleanup, and C6 sets
up the actual branch you'll deploy his version from. Doing this before his
branch exists means his version starts clean instead of needing to be
untangled later.

For Phase D: run **D1 and D2 as soon as Dr. Ashraf's trial is about to
start** — you'll be pushing changes to a live paying-adjacent client soon
after, and the tier-1 health-check-and-rollback safety net (D3) is cheap
insurance against a bad push staying live unnoticed. D4 (beta flags) is
worth having before you ship your first genuinely risky new feature to his
deployment; D5 and D6 (error tracking, staging) can wait until you have
more than one or two clients, per D2's own honesty check on diminishing
returns.
