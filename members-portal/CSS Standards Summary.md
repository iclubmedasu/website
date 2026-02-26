# iClub Members Portal — Comprehensive CSS Standards

> **Purpose:** Single source of truth for all styling decisions. This document serves as a **binding reference** for every future component, page, or modal — and as **detailed instructions for AI agents** implementing UI features to guarantee centralized, consistent CSS.

---

## How to Use This Document (AI Agent Instructions)

**This section is mandatory reading before implementing any UI.**

### The Centralization Model

Every visual pattern in this app follows a **multi-selector centralization model**. When the same design is used in multiple places, the shared properties are written ONCE with all selectors grouped together, and overrides are written separately.

**Canonical example** (from `modal.css`):

```css
/* SHARED design — written once, indexed to all users */
.role-details,
.subteam-details {
    padding: 1rem;
    background: var(--gray-50);
    border-radius: var(--radius-md);
    margin-bottom: 1.5rem;
    border-left: 4px solid var(--purple-700);
}
```

Both `.role-details` and `.subteam-details` look identical in the UI. Instead of duplicating the CSS block, we write the **shared properties once** and list both selectors. If a third context (e.g., `.project-details`) needs the same look, you **add it to the selector list** — you do NOT copy the CSS.

**Another example** (from `page.css`):

```css
/* Every page shares the same container constraints */
.teams-page,
.projects-page,
.members-page,
.help-support-page,
.administration-page {
    max-width: 180px;
    margin: 0 auto;
}

/* Every page title shares the same typography */
.page-title,
.members-page-title,
.projects-title,
.page-title-dropdown {
    font-family: var(--font-heading);
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--purple-800);
}

/* Every info label shares the same design */
.info-label,
.exp-badges-label,
.exp-date-label,
.exp-creator-label {
    font-family: var(--font-heading);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--gray-600);
}
```

### Rules for AI Agents

When you are asked to implement a UI feature, follow these rules **in order**:

#### Rule 1: Search Before You Create

Before writing any CSS, search the existing centralized files to check if the design pattern already exists. The centralized CSS lives in:

| File | Contains |
|---|---|
| `components/page/page.css` | Page containers, page titles, page headers, title dividers, info display (label/value pairs), empty states, responsive |
| `components/modal/modal.css` | Modal backdrop/container/header/body/footer, form elements, buttons, detail cards, checkboxes, radio cards, badge picker, timeline, loading/error states |
| `components/cards/universalcard.css` | Card base, card header, card body, card footer, variants |
| `components/buttons/buttons.css` | Login-page button variant |
| `components/toggle/toggle.css` | Toggle switch |
| `components/scrollbar/scrollbar.css` | Global scrollbar styles |
| `app.css` | CSS variables (`:root`), base reset, layout, font assignments |

If the pattern already exists, **reuse the existing class** — do not create a new one.

#### Rule 2: Extend the Multi-Selector List

If a pattern exists but your new context isn't listed in its selector group, **add your selector to the existing group**:

```css
/* BEFORE: two users */
.info-label,
.exp-badges-label {
    font-family: var(--font-heading);
    font-size: 0.75rem;
    /* ... */
}

/* AFTER: adding a third user */
.info-label,
.exp-badges-label,
.new-feature-label {    /* ← just add the new selector */
    font-family: var(--font-heading);
    font-size: 0.75rem;
    /* ... */
}
```

Then in the page/component-specific CSS file, add ONLY overrides (e.g., different gap, different color):

```css
/* Page-specific override */
.new-feature-label {
    color: var(--gray-400);  /* only if different from the shared base */
}
```

#### Rule 3: Create New Centralized Files for New UI Elements

If you are building a genuinely new UI element that doesn't match any existing pattern:

1. **Create the folder:** `src/components/{element-name}/`
2. **Create the CSS file:** `src/components/{element-name}/{element-name}.css`
3. **Write all base styles + variants** in that one file
4. **Import it** in `app.css` under the `/* Component styles */` section
5. **Use multi-selector grouping** from the start if the element has variants
6. **Never duplicate** — page/modal files should only contain overrides

#### Rule 4: Page-Specific CSS Goes in the Page File

Styles that are truly unique to one page (e.g., a specific grid layout, an animation unique to that page) go in the page's own CSS file (`src/pages/{PageName}/{PageName}Page.css`).

But if you notice the SAME design appearing in 2+ places, it MUST be extracted to a centralized component file immediately.

#### Rule 5: Never Hard-Code

- **Colors:** Always use CSS variables from `:root` (Section 1)
- **Border radius:** Always use `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, or `99px` for pills
- **Shadows:** Always use `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl`
- **Fonts:** Always use `--font-heading` or `--font-body`
- **Units:** Always use `rem` (exception: `1px` borders, `50%` circles)

#### Rule 6: Comment the Source

When a page CSS file delegates to a centralized file, leave a comment:

```css
/* page container: now in shared page.css */
/* info-section, info-grid, info-item, info-label, info-value: now in shared page.css */
```

This prevents future developers (or AI agents) from re-adding the styles.

---

## Table of Contents

0. [How to Use This Document (AI Agent Instructions)](#how-to-use-this-document-ai-agent-instructions)
1. [Design Tokens (CSS Variables)](#1-design-tokens-css-variables)
2. [Typography](#2-typography)
3. [Spacing & Layout](#3-spacing--layout)
4. [Border Radius (Squircle Rule)](#4-border-radius-squircle-rule)
5. [Shadows](#5-shadows)
6. [Color System](#6-color-system)
7. [Animations & Transitions](#7-animations--transitions)
8. [Responsive Breakpoints](#8-responsive-breakpoints)
9. [Naming Conventions](#9-naming-conventions)
10. [File Organization & Architecture](#10-file-organization--architecture)
11. [Quick Reference: Implementing a New Feature](#11-quick-reference-implementing-a-new-feature)

---

## 1. Design Tokens (CSS Variables)

All design tokens live in `:root` inside `app.css`. **Never hard-code a value that already has a token.**

### 1.1 Brand Colors — Purple Scale

| Token | Value | Usage |
|---|---|---|
| `--purple-900` | `#561789` | Darkest purple — gradient starts, high-emphasis text |
| `--purple-800` | `#662f91` | Page titles, primary brand contexts |
| `--purple-700` | `#7a47a3` | Links, focus rings, accent text |
| `--purple-600` | `#9063b3` | Lighter accent, gradient mid-points |
| `--purple-500` | `#af8fc8` | Soft accent, scrollbar hover |

### 1.2 Gradients

| Token | Value | Usage |
|---|---|---|
| `--gradient-primary` | `linear-gradient(135deg, var(--purple-900), var(--purple-800))` | Primary buttons, header bar, active nav items |
| `--gradient-secondary` | `linear-gradient(135deg, var(--purple-800), var(--purple-700))` | Secondary emphasis buttons, user avatars |
| `--gradient-light` | `linear-gradient(135deg, var(--purple-600), var(--purple-500))` | Hover highlights, avatar backgrounds |
| `--gradient-full` | `linear-gradient(135deg, var(--purple-900), var(--purple-700) 50%, var(--purple-500))` | Decorative / hero usage |

### 1.3 Neutrals — Gray Scale

| Token | Value | Usage |
|---|---|---|
| `--gray-50` | `#fafafa` | Table header bg, subtle bg modifiers |
| `--gray-100` | `#f5f5f5` | Hover bg, disabled input bg, scrollbar track |
| `--gray-80` | `#e5e5e5` | Borders, dividers, table row separators |
| `--gray-300` | `#d4d4d4` | Input borders (default), scrollbar thumb, toggle off |
| `--gray-400` | `#a3a3a3` | Placeholder text, muted labels, section headers |
| `--gray-500` | `#737373` | Secondary body text, hints |
| `--gray-600` | `#525252` | Sub-labels, email text, descriptions |
| `--gray-700` | `#404040` | Table header text, form labels |
| `--gray-800` | `#262626` | Strong body text, table cell text |
| `--gray-900` | `#171717` | Headings, primary text, card titles |

### 1.4 Backgrounds

| Token | Value | Usage |
|---|---|---|
| `--bg-subtle` | `#f8f7f9` | App background, page body |
| `--bg-card` | `#ffffff` | Cards, modals, inputs |

### 1.5 Semantic Colors

| Token | Value | Usage |
|---|---|---|
| `--error-bg` | `#fef2f2` | Error/warning box backgrounds |
| `--error-text` | `#991b1b` | Error text, danger actions |
| `--error-border` | `#fecaca` | Error border |

**Additional tokens (already added to `:root` in `app.css`):**

```css
:root {
  /* Success */
  --success-bg: #dcfce7;
  --success-text: #166534;
  --success-border: #10c55e;
  --success-accent: #16a34a;

  /* Warning */
  --warning-bg: #fef3c7;
  --warning-text: #92400e;
  --warning-border: #fde68a;

  /* Info */
  --info-bg: #eff6ff;
  --info-text: #1d4ed8;
  --info-border: #bfdbfe;

  /* Borders */
  --border-default: var(--gray-80);
  --border-subtle: var(--gray-100);
  --border-brand: rgba(86, 11, 137, 0.08);

  /* Danger gradient (used by btn-danger) */
  --gradient-danger: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
  --gradient-success: linear-gradient(135deg, #16a34a 0%, #10c55e 100%);
}
```

### 1.6 Shadows

| Token | Value | Usage |
|---|---|---|
| `--shadow-sm` | `0 1px 2px 0 rgba(86,11,137,0.05)` | Cards at rest, small buttons |
| `--shadow-md` | `0 4px 6px -1px rgba(86,11,137,0.1)` | Sidebar expanded, cards on hover |
| `--shadow-lg` | `0 10px 15px -3px rgba(86,11,137,0.1)` | Buttons on hover, elevated cards |
| `--shadow-xl` | `0 8px 25px -5px rgba(86,11,137,0.15)` | Modals, dropdown menus |

### 1.7 Border Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `12px` | Action buttons, small elements, task items |
| `--radius-md` | `16px` | Inputs, modal close buttons, badges, nav items |
| `--radius-lg` | `8px` | Cards, modals, dropdown menus, avatars |
| `--radius-xl` | `24px` | Login card, large card containers, manage panels |

**Pill / badge radius:** `99px` (full round — use literal `99px` or add `--radius-pill: 99px`)

### 1.8 Typography Tokens

| Token | Value | Usage |
|---|---|---|
| `--font-heading` | `'Poppins', -apple-system, BlinkMacSystemFont, sans-serif` | Headings, labels, buttons, nav, badges |
| `--font-body` | `'Arial', Georgia, serif` | Body text, descriptions, hints, error messages |

---

## 2. Typography

### 2.1 Font Assignment Rules

| Element | Font Family | Why |
|---|---|---|
| All headings (`h1`–`h6`) | `--font-heading` | Visual hierarchy |
| Page titles | `--font-heading` | Brand presence |
| Buttons (all) | `--font-heading` | Actionable emphasis |
| Form labels | `--font-heading` | Structural emphasis |
| Navigation text | `--font-heading` | Way-finding |
| Badges / Pills | `--font-heading` | Compact label readability |
| Table headers | `--font-heading` | Column identity |
| Body text / descriptions | `--font-body` | Comfortable reading |
| Form inputs | `--font-body` | User-typed content |
| Hints / helper text | `--font-body` | Subdued context |
| Error messages | `--font-body` | Informational |

### 2.2 Standard Type Scale

| Role | Size | Weight | Color | Example class |
|---|---|---|---|---|
| Page title | `2.5rem` | `700` | `--purple-800` | `.page-title` |
| Card title | `1.5rem` | `600` | `--gray-900` | `.card-title` |
| Modal title | `1.5rem` | `700` | `--purple-900` | `.modal-title` |
| Section header | `1.125rem` | `600` | `--gray-700` | `.section-title` |
| Section sub-label (uppercase) | `0.85rem–0.9rem` | `600–700` | `--gray-400` or `--purple-700` | `.form-section-title`, `.expanded-section-title` |
| Body (default) | `0.95rem–1rem` | `400` | `--gray-600`–`--gray-800` | `.page p` |
| Small label (uppercase) | `0.75rem` | `600` | `--gray-600` | `.exp-label`, `.info-label` |
| Hint / helper | `0.75rem` | `400` | `--gray-500` | `.form-hint`, `.field-error` |
| Badge text | `0.7rem` | `600` | contextual | `.badge` |

### 2.3 Uppercase Labels Convention

For small section labels, info labels, and table headers:

```css
font-family: var(--font-heading);
font-size: 0.75rem;
font-weight: 600;
text-transform: uppercase;
letter-spacing: 0.05em;
color: var(--gray-600);
```

---

## 3. Spacing & Layout

### 3.1 Spacing Scale (rem-based)

| Token-ish | Value | Usage |
|---|---|---|
| `xs` | `0.25rem` (4px) | Tight gaps between badges, inline elements |
| `sm` | `0.5rem` (8px) | Small padding, compact gaps |
| `md` | `0.75rem` (12px) | Button padding-y, gap between form hint & input |
| `base` | `1rem` (16px) | Standard gap, sidebar item height margin |
| `lg` | `1.5rem` (24px) | Card padding, modal section padding, form-group margin |
| `xl` | `2rem` (32px) | Main content padding, page-header margin-bottom |
| `2xl` | `3rem` (48px) | Empty state vertical padding |

### 3.2 Key Layout Values

- **Main content padding:** `2rem`
- **Page max-width:** `180px` (centered with `margin: 0 auto`)
- **Card padding (default):** `1.5rem`
- **Card padding (large):** `2rem`
- **Card padding (small):** `1rem`
- **Modal padding (header/body/footer):** `1.5rem`
- **Form group bottom margin:** `1.5rem` (standard) / `1.25rem` (compact)
- **Section separator:** `1px solid var(--gray-80)` with `1.5–2rem` padding top/bottom

---

## 4. Border Radius (Squircle Rule)

> **App-wide rule:** All bordered/elevated elements use the squircle token scale. **Never use** arbitrary pixel values for border-radius.

| Element | Radius |
|---|---|
| Small action buttons (32px square) | `--radius-sm` (12px) |
| Inputs, selects, textareas | `--radius-md` (16px) |
| Nav items | `--radius-md` (16px) |
| Table status badges | `--radius-md` (16px) |
| Cards | `--radius-lg` (8px) |
| Modals | `--radius-lg` (8px) |
| Dropdown menus | `--radius-lg` (8px) |
| Avatars (grid) | `--radius-lg` (8px) |
| Login card | `--radius-xl` (24px) |
| Manage-roles container | `--radius-xl` (24px) |
| Badges / pills | `99px` (fully round) |
| Circular avatars | `50%` |
| Toggle slider | `34px` (capsule) |

**Note:** If you encounter bare `px` values for border-radius (e.g., `6px`), replace with `--radius-sm` or the appropriate token.

---

## 5. Shadows

Use **only** the token scale. No ad-hoc `box-shadow` values.

| State | Token |
|---|---|
| At rest | `--shadow-sm` |
| Hover / expanded | `--shadow-md` |
| Button hover / clickable card hover | `--shadow-lg` |
| Modals, dropdown menus | `--shadow-xl` |
| Focus ring (inputs) | `0 0 0 3px rgba(110, 71, 163, 0.1)` — standardize as `--shadow-focus` |
| Error focus ring | `0 0 0 3px rgba(153, 27, 27, 0.1)` — standardize as `--shadow-focus-error` |

**Focus-ring tokens (already added to `:root` in `app.css`):**

```css
:root {
  --shadow-focus: 0 0 0 3px rgba(110, 71, 163, 0.1);
  --shadow-focus-error: 0 0 0 3px rgba(153, 27, 27, 0.1);
}
```

---

## 6. Color System

### 6.1 Semantic Status Colors

Use these for badges, status dots, and contextual backgrounds:

| Status | Background | Text |
|---|---|---|
| Active / Completed / Success | `#dcfce7` / `#f0fdf4` | `#166534` / `#15803d` |
| Warning / On Hold / Inactive | `#fef3c7` | `#92400e` |
| Error / Danger / Cancelled | `#fef2f2` (var `--error-bg`) | `#991b1b` / `#b91c1c` (var `--error-text`) |
| Info / In Progress | `#eff6ff` | `#1d4ed8` |
| Unassigned | `#e0e7ff` | `#3730a3` |
| Blocked | `#fdf4ff` | `#7e10ce` |
| Delayed | `#fff7ed` | `#c2410c` |
| Neutral / Not Started | `#f1f5f9` | `#475569` |

### 6.2 Action Button Colors (inline)

| Action | Color | Hover bg |
|---|---|---|
| View | `--purple-700` | `--purple-700` (white text) |
| Edit | `#2563eb` | `#2563eb` (white text) |
| Activate | `#16a34a` | `#16a34a` (white text) |
| Deactivate / Delete | `--error-text` | `--error-text` (white text) |
| Add (green border style) | `#16a34a` border | `#16a34a` fill |

---

## 7. Animations & Transitions

### 7.1 Standard Transition

```css
transition: all 0.2s;
/* OR for performance-sensitive contexts: */
transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
```

### 7.2 Hover Lift Effect

Used on buttons and clickable cards:

```css
&:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-lg);
}

&:active {
    transform: translateY(0);
}
```

### 7.3 Scale Effect (action buttons)

```css
&:hover {
    transform: scale(1.1);
    box-shadow: var(--shadow-md);
}
```

### 7.4 Reveal on Hover (action overlays)

```css
/* Default hidden */
opacity: 0;
transform: translateX(5px);
pointer-events: none;
transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1),
            transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);

/* On parent hover */
opacity: 1;
transform: translateX(0);
pointer-events: auto;
```

### 7.5 Modal Entrance

- **Backdrop:** `fadeIn 0.2s ease-out`
- **Container:** `slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)`

### 7.6 Dropdown Entrance

```css
transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
/* From: opacity: 0; translateY(-10px) */
/* To:   opacity: 1; translateY(0) */
```

### 7.7 Sidebar Easing

```css
--sidebar-ease: cubic-bezier(0.33, 1, 0.68, 1);
--sidebar-duration: 0.38s;
```

## 8. Responsive Breakpoints

| Name | Max-width | Usage |
|---|---|---|
| Mobile | `640px` | Modal full-width buttons, stacked footers |
| Tablet | `768px` | Login side-by-side → stacked, form-row → 1 col, page header stacks |
| Small Desktop | `900px` | Project grid 2-col → 1-col |

### Standard Media Query Pattern

```css
@media (max-width: 768px) {
    .page-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 1.5rem;
    }

    .page-title-dropdown {
        font-size: 2rem;
    }

    .form-row {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 640px) {
    .modal-container {
        width: 95%;
        max-height: 95vh;
    }

    .modal-footer {
        flex-direction: column-reverse;
    }

    .modal-footer .btn {
        width: 100%;
    }
}
```

---

## 9. Naming Conventions

### 9.1 Class Naming Rules

1. **Lowercase kebab-case** for all class names: `.member-avatar-sm`, `.card-header-with-action`
2. **Page-scoped prefix** for page-specific styles: `.teams-page`, `.projects-page`, `.members-page`
3. **Component prefix** for reusable components: `.card-*`, `.btn-*`, `.badge-*`, `.modal-*`
4. **State modifiers** as chained classes: `.active`, `.open`, `.error`, `.disabled`, `.expanded`
5. **Variant modifiers** with descriptive suffixes: `.btn-primary`, `.btn-danger`, `.card-lg`, `.card-sm`
6. **Action-type modifiers** with chained classes: `.view-btn`, `.edit-btn`, `.deactivate-btn`

### 9.2 Do NOT

- Use `camelCase` or `PascalCase` — only `kebab-case`
- Use raw hex colors inline — use CSS variables
- Use arbitrary `px` for `border-radius` — use tokens
- Prefix with `js-` — we use React refs, not DOM selectors
- Create deeply nested selectors (max 3 levels)

---

## 10. File Organization & Architecture

### 10.1 Import Structure (`app.css`)

```
app.css
├── @import font (Google Fonts)
├── @import component CSS files
│   ├── buttons/buttons.css         ← Button variants
│   ├── cards/universalcard.css     ← Card base + variants
│   ├── errormsg/errormsg.css       ← Error message styling
│   ├── form/form.css               ← Form layout + labels
│   ├── header/header.css           ← Top navigation bar
│   ├── input/input.css             ← Global input styling
│   ├── scrollbar/scrollbar.css     ← Global scrollbar styling
│   ├── page/page.css               ← Page containers, titles, headers, info display, empty states
│   ├── modal/modal.css             ← All shared modal + modal-form styles (1400+ lines)
│   ├── toggle/toggle.css           ← Toggle switch component
│   └── sidebar/sidebar.css         ← Sidebar navigation
├── :root (all CSS variables)
├── Base reset (* { margin, padding, box-sizing })
├── Body & heading font assignments
├── App layout (.app-container, .app-body, .main-content)
├── Page layout (.page)
└── Utility classes
```

### 10.2 The Two Centralized Powerhouse Files

| File | Purpose | Lines | What belongs here |
|---|---|---|---|
| `components/page/page.css` | Shared page-level styles | ~280 | Page containers, page titles, page headers, title dividers, info display (label/value pairs), empty states, responsive rules for these |
| `components/modal/modal.css` | Shared modal-level styles | ~1460 | Modal backdrop/container/header/body/footer, form elements, buttons (primary/secondary/danger), detail cards, checkboxes, radio cards, badge picker, search inputs, timeline, loading/error states, all modal variants and responsive rules |

**Decision tree for where to put styles:**

```
Is it a modal element?
  ├── YES → Is it shared across 2+ modals? → modal.css (add selector to multi-selector group)
  │         Is it unique to one modal? → that modal's own CSS file (overrides only)
  └── NO  → Is it a page-level element?
              ├── YES → Is it shared across 2+ pages? → page.css (add selector to multi-selector group)
              │         Is it unique to one page? → that page's own CSS file
              └── NO  → Is it a reusable UI component?
                          ├── YES → Create/use a component folder in components/
                          └── NO  → Put in the most specific relevant CSS file
```

### 10.3 Rules for Modal CSS

**`modal.css`** contains all shared modal styles. It is the single source of truth for modal UI.

**Individual modal CSS files** (e.g., `AddTeamModal.css`) should contain **ONLY**:
- **Size overrides** (e.g., `max-width: 500px`)
- **Unique layout** specific to that one modal
- **Comments** pointing to `modal.css` for any removed duplicates

### 10.4 Rules for Page CSS

**`page.css`** contains all shared page styles. Page-specific CSS files should contain **ONLY**:
- **Unique layout** for that page (grids, flex arrangements)
- **Unique components** (e.g., project card expanded state)
- **Comments** pointing to `page.css` for any removed duplicates

### 10.5 Folder Structure

```
src/
├── app.css                                 ← Variables, base reset, imports
├── components/
│   ├── buttons/buttons.css
│   ├── cards/universalcard.css
│   ├── errormsg/errormsg.css
│   ├── form/form.css
│   ├── header/header.css
│   ├── input/input.css
│   ├── modal/modal.css                     ← Centralized modal styles
│   ├── page/page.css                       ← Centralized page styles
│   ├── scrollbar/scrollbar.css
│   ├── sidebar/sidebar.css
│   ├── toggle/toggle.css
│   ├── dropdown/                           ← Dropdown components + CSS
│   ├── checkbox/                           ← Checkbox components + CSS
│   └── ... (other component folders)
├── pages/
│   ├── Teams/TeamsPage.css                 ← Teams-specific overrides only
│   ├── Projects/ProjectsPage.css           ← Projects-specific overrides only
│   ├── Members/MembersPage.css             ← Members-specific overrides only
│   ├── Alumni/AlumniPage.css               ← Alumni-specific overrides only
│   ├── HelpAndSupport/HelpAndSupportPage.css
│   ├── Administration/AdministrationPage.css
│   └── User/UserPage.css
└── ...
```

---

## 11. Quick Reference: Implementing a New Feature

> **This section is the essential checklist for AI agents and developers implementing new UI.**

### 11.1 Before Writing Any CSS

1. **Read Section 0** (AI Agent Instructions) — understand the multi-selector centralization model
2. **Search `page.css`** — does your page container, title, info display, or empty state already exist?
3. **Search `modal.css`** — does your modal base, form, button, or detail card already exist?
4. **Search `app.css` `:root`** — find the correct token for every color, radius, shadow, and font
5. **Search component CSS files** — check if your pattern is already centralized elsewhere

### 11.2 When Adding a New Page

1. Create `src/pages/{PageName}/{PageName}Page.jsx` and `{PageName}Page.css`
2. In `page.css`, add the page root class to the container multi-selector:
   ```css
   .teams-page,
   .projects-page,
   .members-page,
   .help-support-page,
   .administration-page,
   .new-page {            /* ← add here */
       max-width: 180px;
       margin: 0 auto;
   }
   ```
3. If the page has a title, add it to the title multi-selector in `page.css`
4. If the page has an empty state, reuse `.empty-state` from `page.css`
5. In `{PageName}Page.css`, write ONLY page-specific styles

### 11.3 When Adding a New Modal

1. Create the modal component in `src/components/modal/` or the relevant feature folder
2. Create `{ModalName}.css` containing ONLY unique overrides
3. The modal MUST use the shared classes from `modal.css`:
   - `.modal-backdrop` + `.modal-container` for structure
   - `.modal-header` + `.modal-body` + `.modal-footer` for layout
   - `.form-group` + `.form-label` + `.form-input` for forms
   - `.btn-primary` / `.btn-secondary` / `.btn-danger` for buttons
4. If the modal needs a unique width: `.my-modal .modal-container { max-width: 500px; }`
5. Do NOT redefine any base modal classes — import from `modal.css` (already in `app.css`)

### 11.4 When Adding a New UI Component

1. **Create the folder:** `src/components/{component-name}/`
2. **Create the CSS file:** `src/components/{component-name}/{component-name}.css`
3. **Write all base styles + variants** using the multi-selector model from the start
4. **Import it** in `app.css`:
   ```css
   @import './components/{component-name}/{component-name}.css';
   ```
5. **Use design tokens** (`:root` variables) for all colors, radii, shadows
6. **Add responsive rules** at the bottom of the file

### 11.5 When Extending an Existing Design

If a design pattern already exists and you need it in a new context:

1. **Find the existing rule** in the centralized file (page.css, modal.css, etc.)
2. **Add your new selector** to the multi-selector group:
   ```css
   /* BEFORE */
   .info-label,
   .exp-badges-label {
       font-family: var(--font-heading);
       /* ... */
   }

   /* AFTER */
   .info-label,
   .exp-badges-label,
   .my-new-label {        /* ← add here */
       font-family: var(--font-heading);
       /* ... */
   }
   ```
3. **Write overrides only** in the page/modal-specific CSS file

### 11.6 Style Checklist for Every CSS Rule

- [ ] Colors use CSS variables from `:root` (never hex, never `rgb()`)
- [ ] Border radius uses `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, or `99px`
- [ ] Shadows use `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl`
- [ ] Fonts use `--font-heading` or `--font-body`
- [ ] Units are `rem` (exception: `1px` borders, `50%` circles)
- [ ] Font sizes match the type scale (Section 2)
- [ ] Spacing matches the spacing scale (Section 3)
- [ ] No duplicate definitions — shared styles are in centralized files
- [ ] Responsive rules follow the standard breakpoints: `640px`, `768px`, `900px` (Section 8)
- [ ] Transitions use standard easing: `all 0.2s ease` or `all 0.3s ease` (Section 7)
- [ ] Selectors are flat — max 3 levels of nesting
- [ ] Class names follow BEM-inspired naming: `component-element` (Section 9)

### 11.7 Completed Centralizations 

The following centralizations have been completed and should never be undone:

| What | Where | Details |
|---|---|---|
| Modal base styles | `modal.css` | Backdrop, container, header, body, footer, keyframes, form elements, buttons — extracted from 10 individual modal CSS files |
| Page containers | `page.css` | Multi-selector rule for all page root classes |
| Page titles | `page.css` | Multi-selector rule for all page title variants |
| Page headers | `page.css` | Page header flex layout + header actions |
| Title dividers | `page.css` | Horizontal rule between title and content |
| Info display system | `page.css` | Labels, values, rows, sections, grids — extracted from modal.css and ProjectsPage.css |
| Empty states | `page.css` | Icon, title, text, button — extracted from modal.css and page CSS files |
| Toggle switch | `toggle.css` | Extracted from TeamsPage.css |
| Scrollbar | `scrollbar.css` | Global scrollbar styling |
| Hard-coded colors | All files | Replaced hex/rgb with CSS variable tokens |
| px → rem conversion | All files | Converted px units to rem |
| Responsive breakpoints | All pages | Added standard breakpoint rules |

### 11.8 Non-Standard Token Mapping

If you encounter any of these non-standard tokens in old code, replace them:

| Non-standard | Replace with |
|---|---|
| `--primary-color` | `--purple-700` |
| `--text-primary` | `--gray-900` |
| `--text-secondary` | `--gray-600` |
| `--bg-light` | `--gray-50` |
| `--border-color` | `--gray-80` |
| `--border-subtle` | `--gray-100` |
| `--accent-primary` | `--purple-700` |
| `#333` | `var(--gray-800)` |
| `#666` | `var(--gray-500)` |
| `#888` / `#999` | `var(--gray-400)` |
| `#d0d0d0` | `var(--gray-300)` |
| `#d32f2f` | `var(--error-text)` |
| `#ffebee` | `var(--error-bg)` |
| `#3f51b5` | `var(--purple-700)` |
| `#e0e0e0` | `var(--gray-80)` |

