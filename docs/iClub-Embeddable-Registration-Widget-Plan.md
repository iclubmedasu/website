# iClub — Embeddable Registration Widget: Implementation Plan

**Goal:** Let event registration forms (already built and configured in the
portal today) be embedded on separate, uniquely-designed per-event websites
that Dr. Ashraf's company builds for each client — without any changes to
the iClub platform per event, and without weakening the platform's existing
security posture.

This plan covers **only** the embeddable registration widget. The ID card
printing feature and session check-in/check-out duration tracking are
separate, smaller efforts — ask if you'd like a plan for those too.

---

## 1. The workflow this achieves

Once built (one-time), using it for any event requires zero platform
changes:

1. Staff configure the registration form as normal today — required/
   optional fields, public/staff-only visibility — in the portal's existing
   registration table, exactly as they do now.
2. Staff click a new **"Generate Embed"** button on the event's page in the
   portal.
3. This produces a small loader-script snippet, ready to copy.
4. The per-event website's developer pastes that snippet into their site.
5. The per-event website's developer writes their own CSS (colors, borders,
   radius, hover effects, even field order) targeting a documented set of
   style hooks, and points the snippet at that stylesheet via one parameter.
6. Done. The form renders inside their site, submits to iClub's backend
   exactly as it does today, styled to match their event's identity.

No CORS configuration, no backend changes, and no code changes to the
per-event website beyond pasting the snippet and writing CSS — for every
event, forever, after the initial build.

---

## 2. Why iframe, not DOM injection

Two ways exist to build a "paste this snippet" embed:

| | **Iframe (chosen)** | **DOM injection (rejected)** |
|---|---|---|
| Where form submission happens | iClub's own domain, inside a sandboxed frame | The host site's own domain |
| Per-event backend config needed | None, ever | A new CORS allowlist entry per event website |
| Security boundary | Browser-enforced isolation — host site cannot reach into or tamper with the form | Form lives directly in host page's DOM; less isolation |
| Styling reach from host site | Cannot use their own CSS selectors directly (browser sandbox) — must go through parameters (see §3) | Full, unrestricted CSS reach |

Given the priority of **zero platform changes per event and staying
independent of the host site's code**, iframe is the right call. Section 3
below is specifically designed to close most of the styling gap this
tradeoff creates.

---

## 3. Styling — two tiers of parameters

Because the host site's CSS cannot reach inside the iframe directly (a
deliberate browser security boundary — the same one that protects embedded
payment/bank iframes elsewhere on the web from being tampered with by the
page around them), styling is controlled by **parameters passed into the
embed**, not by the host site styling it from outside.

### Tier 1 — structured tokens (simple, no CSS knowledge required)

Passed as attributes on the loader script tag: primary color, accent color,
border radius, font family, and 2–3 built-in layout presets (e.g.
"compact" vs "spacious"). Covers the common case quickly.

### Tier 2 — optional custom stylesheet URL (the "close to full
customization" tier)

An additional parameter, e.g. `custom-css-url="https://egyptair.com/
event-theme.css"`. The embed page loads this stylesheet **inside its own
document** — this is just the iframe choosing to load an external file, the
same way any webpage loads a CSS file, so it doesn't breach the sandbox
boundary; the host site still can't reach in uninvited, but the iframe is
deliberately given permission to pull in extra styling that the host
site authors and hosts themselves.

This tier can express:
- Colors, borders, radius, transitions, hover/focus effects — all standard
  CSS.
- **Field order** — if fields are laid out with CSS flexbox/grid and given
  stable identifiers, their stylesheet can reorder fields using the CSS
  `order` property, with no markup or JS changes needed on either side.

**Requirement this creates:** the embed form must be built with **stable,
documented class names or `data-*` attributes** on every meaningful element
(each field, the submit button, error messages, etc.) — effectively a small
published style guide (e.g. `.registration-field`, `.registration-submit`,
`[data-field="email"]`) that any per-event website's CSS author can target.
This is the main new "contract" the platform needs to maintain going
forward — once published, it should stay stable so old embeds don't break
if the underlying form component is later restyled internally.

**Basic hygiene, not a major security control:** validate that
`custom-css-url` is a well-formed `https://` URL before loading it, simply
because loading arbitrary unchecked external resources is sloppy practice
generally — this isn't a high-sensitivity page, so this is a light check,
not a heavy vetting process.

---

## 4. What actually gets built (one-time)

1. **A new, separate route** rendering the existing registration form
   component with no page chrome (no navbar/footer/layout) — reusing the
   same component and logic the public website's registration page already
   uses. The existing registration page, its design, and the portal's
   registration-table configuration system are untouched.
2. **A scoped exception in the security headers (Helmet)** allowing
   *only this specific new route* to be loaded inside an iframe on other
   domains. Every other page (portal, admin, dashboard, the normal public
   registration page) keeps its current protection against being framed
   elsewhere — this exception must not be applied site-wide.
3. **A documented set of stable class names / data attributes** on the
   embeddable form's elements, per §3.
4. **Tier 1 style parameters** read from the script tag and applied as CSS
   custom properties/variables inside the embed page.
5. **Tier 2 custom stylesheet loading**, validated and injected inside the
   embed page's own document.
6. **A shared loader script**, hosted once on iClub's own domain. Every
   event's snippet references this same file, so future improvements (e.g.
   better auto-resizing) apply to all existing embeds automatically,
   without anyone needing to re-paste anything.
7. **Auto-resizing:** iframes don't natively resize to fit their content.
   The embed page sends its actual height to the loader script via
   `postMessage` (a safe, standard way for an iframe to talk to its parent
   page), and the loader script adjusts the container height accordingly —
   this avoids an ugly internal scrollbar on the host site.
8. **A "Generate Embed" button** in the portal's event management UI that
   produces the ready-to-copy snippet, including whatever Tier 1 values are
   picked for that event.

---

## 5. Cursor prompts (explain, then ask, then implement)

Same pattern as prior planning documents: Cursor investigates the current
code, explains what it found and why something matters in plain language,
then asks a specific question before writing any code. Do E1–E2 before
anything else, since they confirm feasibility against your actual codebase
before building.

### E1 — Confirm the registration form can be reused standalone

```
Investigate, explain, and ask — do not build anything yet.

Look at public-website/src/components/registration/RegistrationForm.tsx
and public-website/src/components/public-data/RegisterPageContent.tsx (or
wherever the registration page composes the form with the site's layout).

Step 1: Explain plainly whether the form component itself is already
cleanly separated from the page layout (navbar/footer/page chrome), or
whether it currently assumes/depends on being inside that layout in some
way (e.g. relies on layout-provided styles or context).

Step 2: Explain whether the form currently has any stable, reusable class
names or data attributes on its fields and submit button already, or
whether these would need to be added for the styling approach described
in this plan to work.

Step 3: Ask me: "Based on what I found, is reusing this component
directly for a new standalone embed route straightforward, or would it
need some restructuring first? If restructuring is needed, can you
confirm you're comfortable with that scope before I proceed?"

Do not modify any code in this pass. Just report and ask.
```

### E2 — Confirm current Helmet/frame configuration

```
Investigate, explain, and ask — do not change anything yet.

Look at backend/server.ts and the public-website's own headers
configuration (check next.config.ts and any middleware) for how framing
(being displayed inside an iframe on another site) is currently handled.

Step 1: Explain plainly what's currently allowed — can any page currently
be embedded elsewhere, or is everything blocked, or is it mixed?

Step 2: Explain the plan: only the new embed route should be allowed to be
framed by other sites; everything else (portal, admin, the normal
registration page) should keep its current protection.

Step 3: Ask me: "Here's exactly how I'd scope this exception [describe the
specific approach for the specific route] — can you confirm this won't
accidentally loosen protection for any other page before I implement it?"

Do not modify any code in this pass. Just report and ask.
```

### E3 — Build the standalone embed route

```
Only proceed once E1 and E2 are confirmed.

Create a new route (propose the exact path to me first, e.g.
public-website/src/app/embed/events/[id]/register/page.tsx) that renders
the existing registration form component with no navbar, footer, or other
page chrome — just the form itself.

Reuse the existing form logic and API calls exactly as they work on the
normal registration page; do not duplicate or fork the submission logic.

Confirm with me once built: does the embed page, when visited directly in
a browser, show only the form and nothing else? Show me a screenshot or
describe what renders before moving on.
```

### E4 — Add stable style hooks

```
Only proceed once E3 is done.

Add clear, documented class names or data-* attributes to each meaningful
element in the embeddable form: each field's wrapper, each input, labels,
error messages, and the submit button. Propose the exact naming scheme to
me first (e.g. .registration-field, [data-field="email"],
.registration-submit) before applying it broadly.

Once applied, write me a short plain-English style guide listing every
hook and what it targets — this is what will eventually be shared with
whoever writes CSS for a per-event website.
```

### E5 — Tier 1 style parameters

```
Only proceed once E4 is done.

Add support for reading style parameters from the embed route's URL query
string or the loader script's tag attributes (confirm which approach fits
better given how E3 was built) for: primary color, accent color, border
radius, and font family. Apply these as CSS custom properties on the
embed page so the existing styling reads from them instead of hardcoded
values.

Also implement 2-3 named layout presets (e.g. "compact", "spacious") as a
single parameter choosing between pre-built layout variations.

Confirm with me by demonstrating at least two different parameter
combinations rendering visibly differently before considering this done.
```

### E6 — Tier 2 custom stylesheet loading

```
Only proceed once E5 is done.

Add support for an optional custom-css-url parameter. When present, the
embed page should load it as an external stylesheet inside its own
document (a standard <link rel="stylesheet"> pointed at the given URL),
applied after the Tier 1 token-based styles so it can override them.

Validate the URL is well-formed and uses https:// before loading it;
if invalid, ignore it and fall back to Tier 1 styling only, without
breaking the form.

Ask me: "Do you want any additional restriction on which domains are
allowed for custom-css-url, or is validating it's a well-formed https://
URL sufficient for now?" before finalizing.
```

### E7 — Loader script with auto-resize

```
Only proceed once E6 is done.

Create one shared loader script file, hosted at a stable path on the
public website (propose the exact path to me). Given a container element
and a set of data attributes (event id, style parameters, optional
custom-css-url), it should create an iframe pointing at the embed route
with those parameters attached, insert it into the page, and listen for a
postMessage from the embed page reporting its content height, resizing
the iframe accordingly so no internal scrollbar appears.

On the embed page side, add the corresponding code that measures its own
content height and sends it via postMessage whenever it changes (e.g. on
load and when validation errors appear/disappear).

Show me the exact snippet a per-event website would paste, using a real
example event id, before considering this done.
```

### E8 — "Generate Embed" button in the portal

```
Only proceed once E7 is done.

Add a "Generate Embed" button to the event management page in the
members portal (propose exactly where it fits best, e.g. alongside the
existing CopyPublicEventLinkButton pattern already used for public event
links). Clicking it should produce the ready-to-copy loader script
snippet for that specific event, including a simple color/style picker
for the Tier 1 parameters (reusing an existing color-picker UI component
if one is already used elsewhere, rather than introducing a new one).

Confirm with me that the generated snippet, pasted into a blank test HTML
file, renders the correct event's form correctly before considering this
feature complete.
```

---

## 6. Suggested order

Run **E1 and E2 first** — they confirm the plan is actually feasible
against your real codebase (whether the form is cleanly reusable, and
exactly how to scope the framing exception safely) before any building
starts. E3 through E8 then proceed in order, each depending on the
previous step. Test the full flow end-to-end (paste a snippet into a
throwaway test page, confirm the form renders, styles correctly with both
tiers, resizes properly, and submits successfully) before considering this
ready to hand to Dr. Ashraf's team for their first real event website.
