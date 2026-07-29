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

## PHASE C — Multi-Client Codebase Structure (Theming, Feature Flags, Branching)

**Goal:** Avoid the "copy-paste and slowly diverge" trap when Dr. Ashraf's
company gets its own branded/customized deployment. The approach: isolate
client-specific differences (branding, enabled features, role/team
structure) into a small number of designated places, so new club features
can still flow into his version without a painful manual merge every time.

Do C1–C3 before creating any separate deployment for Dr. Ashraf. C4 onward
only after you've decided the customization level in C3.

### C1 — Audit how hardcoded the branding currently is

```
Investigate, explain, and ask — do not change anything yet.

Search members-portal and public-website for hardcoded branding: the
club's name, logo file references, and color values (hex codes) used
directly inside individual component or CSS files, rather than pulled from
one central place.

Step 1: Tell me plainly how scattered this currently is — for example, "the
logo filename appears in about 12 different files" or "colors are mostly
already centralized in one globals.css file." Give me a rough sense and a
few example locations, not an exhaustive list.

Step 2: Explain in plain terms what this means for creating a second
branded version for a client: would I need to hunt through many files to
re-brand today, or is most of it already centralized in a few places?

Step 3: Ask me: "Based on what I found, do you want me to consolidate all
branding (logo, colors, fonts, organization name text) into one central
config file that every part of the app reads from, before we go further?
This would be a one-time cleanup with no visible change to how the site
currently looks — should I proceed?"

Do not modify any code in this pass. Just report and ask.
```

### C2 — Audit how hardcoded permissions/roles currently are

```
Investigate, explain, and ask — do not change anything yet.

Look at backend/lib/authorityFlags.ts, teamRoles.ts, and anywhere role or
team names (like "President" or "Fundraising Head") are checked directly
by name in code, versus checked through a generic flag (like isLeadership
or isOfficer).

Step 1: Tell me plainly: are role checks mostly based on generic flags
(which would work fine for a client with a totally different org
structure), or do they check specific hardcoded role/team names (which
would need actual code changes for a client whose departments don't match
the club's)?

Step 2: Explain in plain terms: if a new client has a completely different
structure than the club (e.g. no "Fundraising Head," instead "Operations
Manager"), would today's code handle that through just different database
rows, or would someone need to edit code each time?

Step 3: Ask me: "Do you want me to look at converting any hardcoded
role-name checks into generic flag-based checks? This affects how much
per-client org customization is possible without touching code at all —
should I proceed, or is this not worth it for the customization level you
have in mind?"

Do not modify any code in this pass. Just report and ask.
```

### C3 — Propose customization levels and ask which to support

```
This is a planning and proposal task only — explain the options clearly
and ask me to choose. Do not build anything yet.

Based on what you found in C1 and C2, and on how the app is structured
today (one Next.js codebase per app, one database per deployment), propose
three levels of customization I could offer a client, from least to most
effort:

1. "Basic re-brand" — swap logo, colors, and organization name only. Same
   layout, same features, same permission structure everywhere.
2. "Feature toggle" — basic re-brand, plus the ability to turn specific
   existing features on or off per client (e.g. a client with no
   fundraising arm simply doesn't see the Finance module).
3. "Structural customization" — basic re-brand and feature toggle, plus
   allowing genuinely different role/team hierarchies per client, which
   depends on the changes discussed in C2.

For each level, give me a rough plain-English sense of effort (small /
medium / large) and flag any real limitation you can already see (for
example, "level 3 for an org very differently shaped than a club might
expose features that assume a club-like hierarchy").

Then ask me directly: "Which level of customization do you want for Dr.
Ashraf's company specifically, and which level do you want the underlying
system generally capable of, even if his first deployment only needs level
1?" Wait for my answer before doing anything further.
```

### C4 — Build the centralized branding config (after C1 + C3 confirmed)

```
Only proceed once I've confirmed the plan from C1 and told you which
customization level from C3 to build toward.

Create one clearly-named, central config location (check whether
packages/shared is the right place, or whether a per-app config file fits
the current structure better) holding: logo path, primary/secondary
colors, organization display name, and any other branding value found
scattered in C1.

Update the scattered locations from C1 to read from this central config
instead of hardcoding values directly. If the actual scope turns out
larger than C1 estimated, stop and confirm with me before touching more
files than expected — I'd rather approve a bigger cleanup explicitly than
have it happen silently.

After this change, the current site (club branding) should look
pixel-identical to before — this is a structural cleanup, not a visual
change. Confirm this is genuinely true before considering it done.
```

### C5 — Feature flags (only if you chose level 2 or 3 in C3)

```
Only proceed if I chose customization level 2 or 3 in C3.

Propose, in plain language, a simple mechanism for turning specific
existing features on or off per deployment (e.g. Finance, Certificates,
Site Content editors). Favor the simplest approach that fits how the app
already reads its environment variables (check backend/.env.example and
each frontend .env.local.example for the existing pattern) rather than
introducing a new configuration system from scratch.

Ask me: "Here's the specific approach I'd use [describe it] — does this
match how you'd want to manage this across many future clients, or would
you prefer something like a database table listing enabled features per
client instead of environment variables?"

Wait for my answer before implementing anything.
```

### C6 — Git branching workflow for per-client deployments

```
This is a workflow explanation, not a code change to the app — walk me
through it in plain English. Only create example files or documentation if
I ask you to in your reply.

Explain, step by step, in a way a non-coder can follow:
1. How to create a new long-lived git branch for a client (e.g.
   client/dr-ashraf) off of main.
2. How that branch's copy of the theme/config file (from C4) would differ
   from main's, while everything else stays identical.
3. How to bring a new feature built on main into that client branch later
   (the merge/rebase step) — what it typically looks like when it goes
   smoothly, and what it looks like when there's a conflict I'd need help
   resolving.
4. How each branch maps to its own separate deployment (its own Hugging
   Face Space or host, its own database), so client branches never share
   infrastructure with each other or with the club's deployment.

Ask me: "Do you want this written up as a short reference document you can
follow yourself for future clients, or would you rather I walk you through
creating the first client branch live, step by step, right now?"
```

---

## PHASE D — Beta Rollout Safety, Deploy Rollback, and Error Logging

**Goal:** Let you ship risky/new features without every user seeing them
immediately (beta flags), automatically catch and reverse a broken deploy
before it stays live (rollback), and actually be able to investigate what
went wrong afterward (error logging) — three related but separate pieces.

Do D1–D2 first (audit + choose scope) before building anything else in this
phase.

### D1 — Audit what happens today if a deploy breaks

```
Investigate, explain, and ask — do not change anything yet.

Look at .github/workflows/deploy.yml and docs/deployment.md.

Step 1: Explain plainly, step by step, what currently happens from the
moment code is pushed to main until it's live on Hugging Face: does
anything check that the site is actually working after deploying, or does
it just upload the files and assume it worked?

Step 2: Tell me plainly: if a bad deploy goes out right now, what would
actually happen? Would the broken version just stay live until I notice
and manually fix it, or is there already some check/rollback in place?

Step 3: Look up (or tell me you're not fully certain and to double check
against Hugging Face's current documentation) how Hugging Face Spaces
handle version history — specifically, whether reverting to a previous
working version is something that can be automated as part of the
existing GitHub Actions workflow, or whether it would need to be done
manually through the Space's own interface.

Do not change anything yet — just report clearly so I understand the
current gap before we decide what to build.
```

### D2 — Propose scope tiers and ask which to build

```
This is a planning and proposal task only — do not build anything yet.

Based on D1's findings, propose three tiers, from least to most effort:

1. "Basic safety net" — after each deploy, automatically check that
   /health returns 200; if it doesn't within a short wait, automatically
   revert to the previous working version and notify me (however
   notification is simplest to wire up, e.g. a GitHub Actions failure
   email).
2. "Basic safety net + beta flags" — everything in tier 1, plus a simple
   way to mark specific new features as "beta" so they're only visible to
   me (or a short list of member accounts I choose) until I turn them on
   for everyone.
3. "Full pipeline" — everything above, plus a proper error-tracking
   service (like Sentry) capturing real stack traces after something
   breaks in production, and a separate staging deployment that changes
   go to first, before touching the real production Space.

For each tier, give me a plain-English sense of effort (small / medium /
large) and be honest about diminishing returns — e.g. whether tier 3 is
overkill right now for a small number of deployments versus something
worth building once you have several paying clients.

Ask me directly: "Which tier do you want to build toward right now?" Wait
for my answer before doing anything further.
```

### D3 — Build the health-check + rollback safety net (tier 1)

```
Only proceed once I've confirmed at least tier 1 from D2.

Modify .github/workflows/deploy.yml so that after deploying, it checks the
relevant /health endpoint (and equivalent basic checks for the frontends
if reasonable) and waits briefly for a healthy response.

If the check fails, explain to me first, in plain language, exactly what
you're proposing as the automatic recovery step (e.g. "revert the Space to
the last commit that passed this same check") before implementing it —
this is the part most likely to need Hugging Face's current documented
behavior confirmed, so double check rather than guessing.

Also add a way for me to actually notice a failed deploy happened (e.g. a
GitHub Actions job failure shows up in my email if that's already
connected, or a simple notification step) — ask me which notification
method I actually want before wiring it in.

Confirm with me before merging this into the actual deploy workflow used
for real deploys — I'd like to test this on a deliberately broken small
change first to see it actually catch something.
```

### D4 — Beta feature flags (tier 2+)

```
Only proceed if I chose tier 2 or 3 in D2.

Propose, in plain language, the simplest mechanism for marking a specific
new feature as "beta" so only you (or a short list of member accounts) see
it, while everyone else sees the current behavior. Check whether this can
reuse anything from the feature-flag work in Phase C (if that was already
built) before creating a separate new mechanism.

Ask me: "Do you want beta access controlled by a specific list of member
emails/IDs, or by a simple role like 'is this the developer/admin
account'? And once a beta feature is confirmed working, do you want a
manual step to turn it on for everyone, or should removing the flag from
the code be enough?"

Wait for my answer before implementing.
```

### D5 — Error tracking (tier 3)

```
Only proceed if I chose tier 3 in D2.

Explain plainly what a service like Sentry (or a similar error-tracking
tool) actually does: it captures the real error and stack trace whenever
something breaks while the app is live, and lets you look it up later,
instead of relying on Hugging Face's own logs which are harder to search
after the fact.

Explain the privacy tradeoff clearly: whatever data is present when an
error happens (e.g. request details) could be sent to this third-party
service unless it's deliberately configured not to include things like
registrant names, emails, or phone numbers. Propose a configuration that
excludes that kind of data from error reports.

Ask me: "Do you want to set this up with a specific service (I'd suggest
Sentry's free tier as a starting point, but confirm current pricing/limits
before committing), and are you comfortable with the privacy tradeoff as I
described it, configured to exclude PII from reports?"

Wait for my answer before implementing.
```

### D6 — Staging deployment (tier 3, most effort)

```
Only proceed if I chose tier 3 in D2, and only after D3–D5 are in place.

Propose, in plain language, what a staging deployment would look like
given the current setup (e.g. a second Hugging Face Space, or another
low-cost host, running the same code with a separate throwaway database)
and how the GitHub Actions workflow would deploy there first, giving you a
chance to check it before promoting the same change to the real production
Space.

Ask me: "Given you're currently managing this mostly on your own, do you
want a staging deployment that requires you to manually approve promotion
to production each time, or would you rather changes only go to staging
automatically and you decide when to push them to production yourself
through a separate manual step?"

Wait for my answer before building anything.
```

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
