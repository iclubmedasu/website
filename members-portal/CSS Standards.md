# iClub Members Portal — Comprehensive CSS Standards

> **Purpose:** Single source of truth for all styling decisions. Use this document to **backfill** existing inconsistencies and as the **binding reference** for every future component, page, or modal.

---

## Table of Contents

1. [Design Tokens (CSS Variables)](#1-design-tokens-css-variables)
2. [Typography](#2-typography)
3. [Spacing & Layout](#3-spacing--layout)
4. [Border Radius (Squircle Rule)](#4-border-radius-squircle-rule)
5. [Shadows](#5-shadows)
6. [Color System](#6-color-system)
7. [Buttons](#7-buttons)
8. [Form Elements](#8-form-elements)
9. [Cards](#9-cards)
10. [Tables](#10-tables)
11. [Badges & Pills](#11-badges--pills)
12. [Modals](#12-modals)
13. [Dropdowns](#13-dropdowns)
14. [Toggle Switches](#14-toggle-switches)
15. [Page Layout](#15-page-layout)
16. [Empty States](#16-empty-states)
17. [Error, Warning & Success States](#17-error-warning--success-states)
18. [Animations & Transitions](#18-animations--transitions)
19. [Scrollbars](#19-scrollbars)
20. [Responsive Breakpoints](#20-responsive-breakpoints)
21. [Naming Conventions](#21-naming-conventions)
22. [File Organization](#22-file-organization)
23. [Inconsistencies to Fix (Backfill Checklist)](#23-inconsistencies-to-fix-backfill-checklist)

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
| `--gray-200` | `#e5e5e5` | Borders, dividers, table row separators |
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

**Missing tokens to add (backfill):**

```css
:root {
  /* Success */
  --success-bg: #dcfce7;
  --success-text: #166534;
  --success-border: #22c55e;
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
  --border-default: var(--gray-200);
  --border-subtle: var(--gray-100);
  --border-brand: rgba(86, 23, 137, 0.08);

  /* Danger gradient (used by btn-danger) */
  --gradient-danger: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
  --gradient-success: linear-gradient(135deg, #16a34a 0%, #22c55e 100%);
}
```

### 1.6 Shadows

| Token | Value | Usage |
|---|---|---|
| `--shadow-sm` | `0 1px 2px 0 rgba(86,23,137,0.05)` | Cards at rest, small buttons |
| `--shadow-md` | `0 4px 6px -1px rgba(86,23,137,0.1)` | Sidebar expanded, cards on hover |
| `--shadow-lg` | `0 10px 15px -3px rgba(86,23,137,0.1)` | Buttons on hover, elevated cards |
| `--shadow-xl` | `0 20px 25px -5px rgba(86,23,137,0.15)` | Modals, dropdown menus |

### 1.7 Border Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `12px` | Action buttons, small elements, task items |
| `--radius-md` | `16px` | Inputs, modal close buttons, badges, nav items |
| `--radius-lg` | `20px` | Cards, modals, dropdown menus, avatars |
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
- **Page max-width:** `1200px` (centered with `margin: 0 auto`)
- **Card padding (default):** `1.5rem`
- **Card padding (large):** `2rem`
- **Card padding (small):** `1rem`
- **Modal padding (header/body/footer):** `1.5rem`
- **Form group bottom margin:** `1.5rem` (standard) / `1.25rem` (compact)
- **Section separator:** `1px solid var(--gray-200)` with `1.5–2rem` padding top/bottom

---

## 4. Border Radius (Squircle Rule)

> **App-wide rule:** All bordered/elevated elements use the squircle token scale. **Never use** arbitrary pixel values for border-radius.

| Element | Radius |
|---|---|
| Small action buttons (32px square) | `--radius-sm` (12px) |
| Inputs, selects, textareas | `--radius-md` (16px) |
| Nav items | `--radius-md` (16px) |
| Table status badges | `--radius-md` (16px) |
| Cards | `--radius-lg` (20px) |
| Modals | `--radius-lg` (20px) |
| Dropdown menus | `--radius-lg` (20px) |
| Avatars (grid) | `--radius-lg` (20px) |
| Login card | `--radius-xl` (24px) |
| Manage-roles container | `--radius-xl` (24px) |
| Badges / pills | `99px` (fully round) |
| Circular avatars | `50%` |
| Toggle slider | `34px` (capsule) |

**Backfill note:** Some files (UserPage.css, PhoneInput.css) use bare `6px` — must be replaced with `--radius-sm` or a new `--radius-xs: 8px` token.

---

## 5. Shadows

Use **only** the token scale. No ad-hoc `box-shadow` values.

| State | Token |
|---|---|
| At rest | `--shadow-sm` |
| Hover / expanded | `--shadow-md` |
| Button hover / clickable card hover | `--shadow-lg` |
| Modals, dropdown menus | `--shadow-xl` |
| Focus ring (inputs) | `0 0 0 3px rgba(122, 71, 163, 0.1)` — standardize as `--shadow-focus` |
| Error focus ring | `0 0 0 3px rgba(153, 27, 27, 0.1)` — standardize as `--shadow-focus-error` |

**Backfill: Add focus-ring tokens:**

```css
:root {
  --shadow-focus: 0 0 0 3px rgba(122, 71, 163, 0.1);
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
| Blocked | `#fdf4ff` | `#7e22ce` |
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

## 7. Buttons

### 7.1 Base Button (`.btn`)

```css
.btn {
    padding: 0.75rem 1.5rem;
    font-family: var(--font-heading);
    font-size: 0.95rem;
    font-weight: 500;
    border-radius: var(--radius-md);
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
```

### 7.2 Button Variants

| Class | Background | Text | Border | Hover |
|---|---|---|---|---|
| `.btn-primary` | `--gradient-primary` | `white` | none | `translateY(-2px)` + `--shadow-lg` |
| `.btn-secondary` | `transparent` | `--gray-700` | `2px solid var(--gray-300)` | `--gray-100` bg, `--gray-400` border |
| `.btn-danger` | `linear-gradient(135deg, #dc2626, #991b1b)` | `white` | none | `translateY(-2px)` + red shadow |
| `.btn-primary-inverted` | `white` | `--purple-700` | `2px solid --purple-700` | `light purple bg` |

### 7.3 Full-Width Login Button (`.btn-primary` in buttons.css)

```css
/* Login page uses width: 100%, padding: 1rem, font-size: 1.05rem */
```

### 7.4 Icon Action Buttons

Small square buttons for table row / card header actions:

```css
.action-btn {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    background: white;
    box-shadow: var(--shadow-sm);
}

.action-btn svg {
    width: 16px;
    height: 16px;
}

/* Hover: fill bg with action color, white icon, scale(1.1) */
```

### 7.5 Add Button (green border style)

```css
.card-add-btn {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    border: 2px solid #16a34a;
    color: #16a34a;
    background: white;
}

.card-add-btn:hover {
    background: #16a34a;
    color: white;
    transform: scale(1.1);
    box-shadow: var(--shadow-md);
}
```

---

## 8. Form Elements

### 8.1 Form Group

```css
.form-group {
    margin-bottom: 1.5rem;
}
```

### 8.2 Form Label

```css
.form-label {
    display: block;
    font-family: var(--font-heading);
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--gray-700);
    margin-bottom: 0.5rem;
}
```

### 8.3 Form Input (Standard)

```css
.form-input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-family: var(--font-body);
    font-size: 0.95rem;
    color: var(--gray-900);
    background-color: var(--bg-card);
    border: 2px solid var(--gray-300);
    border-radius: var(--radius-md);
    transition: all 0.2s;
}

.form-input:focus {
    outline: none;
    border-color: var(--purple-700);
    box-shadow: var(--shadow-focus);
}

.form-input.error {
    border-color: var(--error-text);
}

.form-input.error:focus {
    box-shadow: var(--shadow-focus-error);
}

.form-input:disabled {
    background-color: var(--gray-100);
    cursor: not-allowed;
    opacity: 0.6;
}
```

### 8.4 Textarea

```css
.form-textarea {
    resize: vertical;
    min-height: 80px;
    font-family: var(--font-body);
}
/* Inherits all .form-input styles */
```

### 8.5 Select (native)

Same padding, border, and radius as `.form-input`.

### 8.6 Field Error

```css
.field-error {
    display: block;
    font-family: var(--font-body);
    font-size: 0.75rem;
    color: var(--error-text);
    margin-top: 0.375rem;
}
```

### 8.7 Form Hint

```css
.form-hint {
    font-family: var(--font-body);
    font-size: 0.75rem;
    color: var(--gray-500);
    margin-top: 0.5rem;
}
```

### 8.8 Form Row (side-by-side fields)

```css
.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1rem;
}

@media (max-width: 768px) {
    .form-row {
        grid-template-columns: 1fr;
    }
}
```

### 8.9 Form Section (within modals)

```css
.form-section {
    margin-bottom: 2rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid var(--gray-200);
}

.form-section:last-of-type {
    border-bottom: none;
    margin-bottom: 1.5rem;
    padding-bottom: 0;
}

.form-section-title {
    font-family: var(--font-heading);
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--gray-400);
    margin: 0 0 1rem 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
```

### 8.10 Checkbox

```css
.checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    user-select: none;
}

.checkbox-input {
    width: 20px;
    height: 20px;
    cursor: pointer;
    accent-color: var(--purple-700);
}

.checkbox-text {
    font-family: var(--font-heading);
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--gray-700);
}
```

---

## 9. Cards

### 9.1 Base Card

```css
.card {
    background-color: var(--bg-card);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    border: 1px solid rgba(86, 23, 137, 0.08);
    padding: 1.5rem;
    transition: all 0.2s;
}

.card:hover {
    box-shadow: var(--shadow-md);
}
```

### 9.2 Card Header

```css
.card-header {
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--gray-200);
}
```

### 9.3 Card Header with Action Button

```css
.card-header-with-action {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
```

### 9.4 Card Variants

| Modifier | Padding |
|---|---|
| `.card` (default) | `1.5rem` |
| `.card-lg` | `2rem` |
| `.card-sm` | `1rem` |
| `.card-clickable` | Add `cursor: pointer; &:hover { translateY(-2px); --shadow-lg }` |

---

## 10. Tables

### 10.1 Standard Table

```css
.members-table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-body);
}
```

### 10.2 Table Header

```css
.members-table thead {
    background-color: var(--gray-50);
    border-bottom: 2px solid var(--gray-200);
}

.members-table th {
    font-family: var(--font-heading);
    text-align: left;
    padding: 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--gray-700);
    text-transform: uppercase;
    letter-spacing: 0.025em;
}
```

### 10.3 Table Body

```css
.members-table td {
    padding: 1rem;
    font-size: 0.95rem;
    color: var(--gray-800);
    border-bottom: 1px solid var(--gray-200);
}

.members-table tbody tr {
    transition: background-color 0.15s;
}

.members-table tbody tr:hover {
    background-color: var(--gray-50);
}

/* Zebra striping */
.members-table tbody tr.odd-row {
    background-color: var(--bg-card);
}

.members-table tbody tr.even-row {
    background-color: rgba(86, 23, 137, 0.02);
}
```

### 10.4 Table Member Cell (avatar + name)

```css
.table-member-cell {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}
```

---

## 11. Badges & Pills

### 11.1 Base Badge

```css
.badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.2rem 0.55rem;
    border-radius: 99px;
    font-family: var(--font-heading);
    font-size: 0.7rem;
    font-weight: 600;
    white-space: nowrap;
    line-height: 1;
}
```

### 11.2 Status Badge Palette

| Class | Background | Color |
|---|---|---|
| `.badge-status-NOT_STARTED` | `#f1f5f9` | `#475569` |
| `.badge-status-IN_PROGRESS` | `#eff6ff` | `#1d4ed8` |
| `.badge-status-COMPLETED` | `#f0fdf4` | `#15803d` |
| `.badge-status-ON_HOLD` | `#fef3c7` | `#92400e` |
| `.badge-status-CANCELLED` | `#fef2f2` | `#b91c1c` |
| `.badge-status-DELAYED` | `#fff7ed` | `#c2410c` |
| `.badge-status-BLOCKED` | `#fdf4ff` | `#7e22ce` |

### 11.3 Priority Badge Palette

| Class | Background | Color |
|---|---|---|
| `.badge-priority-LOW` | `#f0fdf4` | `#15803d` |
| `.badge-priority-MEDIUM` | `#eff6ff` | `#1d4ed8` |
| `.badge-priority-HIGH` | `#fff7ed` | `#c2410c` |
| `.badge-priority-URGENT` | `#fef2f2` | `#b91c1c` |

### 11.4 Team Pill

```css
.badge-team {
    background: #f3ecfb;
    color: var(--purple-800);
    font-family: var(--font-heading);
    font-size: 0.68rem;
    font-weight: 500;
    padding: 0.15rem 0.45rem;
    border-radius: 99px;
    white-space: nowrap;
}
```

### 11.5 Table Status Badge (larger)

```css
.status-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    font-weight: 500;
    font-family: var(--font-heading);
}
```

| Modifier | Background | Color |
|---|---|---|
| `.status-badge.active` | `#dcfce7` | `#166534` |
| `.status-badge.inactive` | `#fef3c7` | `#92400e` |
| `.status-badge.unassigned` | `#e0e7ff` | `#3730a3` |

---

## 12. Modals

### 12.1 Backdrop

```css
.modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    animation: fadeIn 0.2s ease-out;
}
```

### 12.2 Container

```css
.modal-container {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: var(--bg-card);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    max-width: 500px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    z-index: 1001;
    animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Size variants */
.modal-container.modal-large {
    max-width: 700px;
    max-height: 85vh;
}
```

### 12.3 Modal Animations

```css
@keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
}

@keyframes slideUp {
    from { opacity: 0; transform: translate(-50%, -45%); }
    to   { opacity: 1; transform: translate(-50%, -50%); }
}
```

### 12.4 Modal Header

```css
.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem;
    border-bottom: 1px solid var(--gray-200);
}

.modal-title {
    font-family: var(--font-heading);
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--purple-900);
    margin: 0;
}

.modal-close-btn {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    border: none;
    background: transparent;
    color: var(--gray-600);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
}

.modal-close-btn:hover {
    background: var(--gray-100);
    color: var(--gray-900);
}
```

### 12.5 Modal Body

```css
.modal-body {
    padding: 1.5rem;
}
```

### 12.6 Modal Footer

```css
.modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid var(--gray-200);
}
```

### 12.7 Modal Variants (Border Accent)

| Variant | Class | Border |
|---|---|---|
| Danger / Deactivate | `.modal-danger` | `2px solid var(--error-border)` |
| Success / Activate | `.modal-success` | `2px solid #16a34a` |

### 12.8 Modal Icon (Header)

```css
/* Danger icon */
.modal-icon-danger {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--error-bg);
    color: var(--error-text);
    display: flex;
    align-items: center;
    justify-content: center;
}

/* Success icon */
.modal-icon-success {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(22, 163, 74, 0.15);
    color: #16a34a;
    display: flex;
    align-items: center;
    justify-content: center;
}
```

### 12.9 Responsive Modal

```css
@media (max-width: 640px) {
    .modal-container {
        width: 95%;
        max-height: 95vh;
    }

    .modal-header,
    .modal-body,
    .modal-footer {
        padding: 1.25rem;
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

## 13. Dropdowns

### 13.1 Page Title Dropdown

```css
.dropdown-menu {
    position: absolute;
    top: calc(100% + 1rem);
    left: 0;
    background: var(--bg-card);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    border: 1px solid rgba(86, 23, 137, 0.1);
    min-width: 320px;
    z-index: 1000;
    opacity: 0;
    transform: translateY(-10px);
    pointer-events: none;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    overflow: hidden;
}

.dropdown-menu.open {
    opacity: 1;
    transform: translateY(0);
    pointer-events: all;
}
```

### 13.2 Dropdown Items

```css
.dropdown-item {
    font-family: var(--font-heading);
    padding: 1rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
    background: transparent;
    width: 100%;
    text-align: left;
    font-size: 1rem;
    font-weight: 500;
    color: var(--gray-700);
}

.dropdown-item:hover {
    background: var(--gradient-light);
    color: white;
}

.dropdown-item.active {
    background: var(--gradient-primary);
    color: white;
}
```

### 13.3 Manage Combobox (smaller dropdown in panels)

Same pattern but with smaller padding (`0.75rem 1rem`) and `0.95rem` font-size.

---

## 14. Toggle Switches

```css
.toggle-switch {
    position: relative;
    display: inline-block;
    width: 60px;
    height: 32px;
}

.toggle-slider {
    /* ... absolute fill ... */
    background-color: var(--gray-300);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 34px;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.toggle-slider:before {
    /* 24×24 white circle, 4px inset */
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 50%;
}

/* Checked: green gradient */
input:checked + .toggle-slider {
    background: linear-gradient(135deg, #16a34a, #22c55e);
    box-shadow: 0 0 12px rgba(22, 163, 74, 0.3);
}

input:checked + .toggle-slider:before {
    transform: translateX(28px);
}
```

**Status label:** `.team-status-label.active` = `#16a34a`, `.inactive` = `var(--error-text)`.

---

## 15. Page Layout

### 15.1 Standard Page Container

Every page component's root class should follow:

```css
.{page-name}-page {
    max-width: 1200px;
    margin: 0 auto;
}
```

**Do NOT add extra padding** — `main-content` supplies `2rem` padding.

**Exception:** ProjectsPage currently adds `padding: 2rem` at the page level — this should be removed (backfill).

### 15.2 Page Header

```css
.page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
}
```

### 15.3 Page Title

```css
.page-title {
    font-family: var(--font-heading);
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--purple-800);
    margin-bottom: 2rem;
}
```

> **Backfill:** `.page-title` is duplicated in `pagetitle.css` and `TeamsPage.css`. Keep only in `pagetitle.css` (or `app.css`).

---

## 16. Empty States

```css
.empty-state {
    text-align: center;
    padding: 3rem 2rem;
}

.empty-state-icon {
    width: 64px;
    height: 64px;
    margin: 0 auto 1rem;
    color: var(--gray-400);
}

.empty-state-title {
    font-family: var(--font-heading);
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--gray-700);
    margin-bottom: 0.5rem;
}

.empty-state-text {
    font-family: var(--font-body);
    font-size: 0.95rem;
    color: var(--gray-500);
    margin-bottom: 2rem;
}

.empty-state-btn {
    /* Same as .btn-primary but with inline-flex + icon gap */
    font-family: var(--font-heading);
    padding: 0.75rem 1.5rem;
    background: var(--gradient-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
}
```

---

## 17. Error, Warning & Success States

### 17.1 Error Message Box

```css
.error-message {
    padding: 0.875rem 1rem;
    background-color: var(--error-bg);
    border: 1px solid var(--error-border);
    border-radius: var(--radius-md);
    color: var(--error-text);
    font-family: var(--font-body);
    font-size: 0.875rem;
    margin-bottom: 1rem;
}
```

### 17.2 Success Message Box

```css
.success-message {
    padding: 0.875rem 1rem;
    background-color: var(--success-bg);
    border: 1px solid var(--success-border);
    border-radius: var(--radius-md);
    color: var(--success-text);
    font-family: var(--font-body);
    font-size: 0.875rem;
    margin-bottom: 1rem;
    animation: slideDown 0.3s ease-out;
}
```

### 17.3 Warning Box (inside confirm modals)

```css
.warning-box {
    padding: 1.25rem;
    background: var(--error-bg);
    border: 1px solid var(--error-border);
    border-radius: var(--radius-md);
    margin-bottom: 1.5rem;
}

.warning-text {
    font-family: var(--font-body);
    font-size: 0.95rem;
    color: var(--gray-700);
    line-height: 1.6;
    margin-bottom: 0.75rem;
}

.warning-text strong {
    color: var(--error-text);
    font-weight: 600;
}
```

### 17.4 Info Box (activate modals)

```css
.activate-info-box {
    padding: 1.25rem;
    background: rgba(22, 163, 74, 0.08);
    border: 1px solid rgba(22, 163, 74, 0.3);
    border-radius: var(--radius-md);
    margin-bottom: 1.5rem;
}
```

### 17.5 Name Highlight (confirm modals)

```css
.name-highlight {
    font-family: var(--font-heading);
    font-size: 1.125rem;
    font-weight: 700;
    padding: 0.75rem;
    background: white;
    border-radius: var(--radius-sm);
    margin: 0.75rem 0;
    text-align: center;
}

/* Danger: color: var(--error-text) */
/* Success: color: #16a34a */
```

---

## 18. Animations & Transitions

### 18.1 Standard Transition

```css
transition: all 0.2s;
/* OR for performance-sensitive contexts: */
transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
```

### 18.2 Hover Lift Effect

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

### 18.3 Scale Effect (action buttons)

```css
&:hover {
    transform: scale(1.1);
    box-shadow: var(--shadow-md);
}
```

### 18.4 Reveal on Hover (action overlays)

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

### 18.5 Modal Entrance

- **Backdrop:** `fadeIn 0.2s ease-out`
- **Container:** `slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)`

### 18.6 Dropdown Entrance

```css
transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
/* From: opacity: 0; translateY(-10px) */
/* To:   opacity: 1; translateY(0) */
```

### 18.7 Sidebar Easing

```css
--sidebar-ease: cubic-bezier(0.33, 1, 0.68, 1);
--sidebar-duration: 0.38s;
```

---

## 19. Scrollbars

```css
::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

::-webkit-scrollbar-track {
    background: var(--gray-100);
}

::-webkit-scrollbar-thumb {
    background: var(--gray-300);
    border-radius: var(--radius-sm);
}

::-webkit-scrollbar-thumb:hover {
    background: var(--purple-500);
}
```

For nested scroll areas (expanded cards, task panels), use a slimmer variant:

```css
&::-webkit-scrollbar { width: 5px–6px; }
&::-webkit-scrollbar-track { background: transparent or var(--gray-100); border-radius: 10px; }
&::-webkit-scrollbar-thumb { background: var(--gray-300) or var(--purple-400); border-radius: 10px; }
```

---

## 20. Responsive Breakpoints

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

## 21. Naming Conventions

### 21.1 Class Naming Rules

1. **Lowercase kebab-case** for all class names: `.member-avatar-sm`, `.card-header-with-action`
2. **Page-scoped prefix** for page-specific styles: `.teams-page`, `.projects-page`, `.members-page`
3. **Component prefix** for reusable components: `.card-*`, `.btn-*`, `.badge-*`, `.modal-*`
4. **State modifiers** as chained classes: `.active`, `.open`, `.error`, `.disabled`, `.expanded`
5. **Variant modifiers** with descriptive suffixes: `.btn-primary`, `.btn-danger`, `.card-lg`, `.card-sm`
6. **Action-type modifiers** with chained classes: `.view-btn`, `.edit-btn`, `.deactivate-btn`

### 21.2 Do NOT

- Use `camelCase` or `PascalCase` — only `kebab-case`
- Use raw hex colors inline — use CSS variables
- Use arbitrary `px` for `border-radius` — use tokens
- Prefix with `js-` — we use React refs, not DOM selectors
- Create deeply nested selectors (max 3 levels)

---

## 22. File Organization

### 22.1 Import Structure (`app.css`)

```
app.css
├── @import font (Google Fonts)
├── @import component CSS files
│   ├── buttons/buttons.css
│   ├── cards/universalcard.css
│   ├── errormsg/errormsg.css
│   ├── form/form.css
│   ├── header/header.css
│   ├── input/input.css
│   ├── scrollbar/scrollbar.css
│   └── modal/modal.css          ← NEW (extract shared modal styles here)
├── :root (all CSS variables)
├── Base reset (* { margin, padding, box-sizing })
├── Body & heading font assignments
├── App layout (.app-container, .app-body, .main-content)
├── Page layout (.page)
└── Utility classes
```

### 22.2 Rules for Modal CSS

**Base modal styles** (`.modal-backdrop`, `.modal-container`, `.modal-header`, `.modal-body`, `.modal-footer`, `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.form-group`, `.form-label`, `.form-input`, `.field-error`, `.error-message`, `.form-hint`) must be **centralized** in a single shared file (recommended: `components/modal/modal.css` imported via `app.css`).

**Individual modal CSS files** should contain ONLY:
- **Size overrides** (e.g., `.modal-large`)
- **Modal-specific unique styles** (e.g., `.warning-box`, `.timeline-section`)
- **Scoped overrides** using the modal's wrapper class (e.g., `.add-officer-modal .modal-container { max-width: 500px; }`)

### 22.3 Rules for Page CSS

Page CSS files should contain:
- **Page-specific layout** (grids, flex arrangements)
- **Page-specific components** (e.g., project card expanded state)
- **No duplication** of global component styles

### 22.4 Empty CSS Files

The following files are empty and should be either populated with styles or deleted:
- `table/table.css`
- `pagination/pagination.css`
- `tabs/tabs.css`
- `textarea/textarea.css`
- `fileuploader/fileuploader.css`
- `loadingindicator/loadingindicator.css`
- `Dashboard.css`

---

## 23. Inconsistencies to Fix (Backfill Checklist)

### 23.1 Critical: Massive Modal Style Duplication

**Problem:** The same ~150 lines of modal base styles (`.modal-backdrop`, `.modal-container`, keyframes, `.modal-header`, `.modal-body`, `.modal-footer`, `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.form-group`, `.form-label`, `.form-input`, `.field-error`, `.error-message`) are **copy-pasted** in at least 8 files:
- `AddMembersModal.css`
- `AddTeamModal.css`
- `AddRoleModal.css`
- `AddSubteamModal.css`
- `EditMembersModal.css`
- `EditRoleModal.css`
- `CreateProjectModal.css`
- `DeactivateProjectModal.css`
- `EditAdminMembersModal.css`

**Fix:** Extract shared modal + form styles into `components/modal/modal.css`, import it in `app.css`, and strip duplicates from all modal files.

### 23.2 Inconsistent `@keyframes` Names

| File | Fade keyframe | Slide keyframe |
|---|---|---|
| Most modals | `fadeIn` | `slideUp` |
| `EditAdminMembersModal.css` | `editAdminFadeIn` | `editAdminSlideUp` |
| `DeactivateProjectModal.css` | `cdpFadeIn` | `cdpSlideUp` |

**Fix:** Use a single `fadeIn` / `slideUp` defined in the shared modal file.

### 23.3 Inconsistent `.form-input` Definitions

| File | Padding | Border | Font-size |
|---|---|---|---|
| `input.css` (global) | `0.9rem 1.2rem` | `2px solid var(--gray-200)` | `1.05rem` |
| Modal files | `0.75rem 1rem` | `2px solid var(--gray-300)` | `0.95rem` |
| `CreateProjectModal.css` | `0.625rem 0.875rem` | `1.5px solid var(--gray-300)` | `0.9rem` |
| `AddMembersModal.css` (bottom section) | `10px 12px` | `1px solid #d0d0d0` | `13px` |
| `UserPage.css` | `0.5rem 0.75rem` | `1px solid var(--border-subtle, #e2e8f0)` | `0.9rem` |

**Fix:** Standardize to one definition. Recommended:

```css
.form-input {
    padding: 0.75rem 1rem;
    border: 2px solid var(--gray-300);
    border-radius: var(--radius-md);
    font-size: 0.95rem;
}
```

### 23.4 Inconsistent `.form-label` Definitions

| File | Font-size | Color |
|---|---|---|
| `form.css` (global) | `1rem` | `--gray-900` |
| Modal files | `0.875rem` | `--gray-700` |
| `AddMembersModal.css` (bottom) | `13px` | `#333` |

**Fix:** Standardize to modal definition (`0.875rem`, `--gray-700`). Update `form.css`.

### 23.5 Hard-coded Colors

Files using raw hex instead of CSS variables:

| File | Issue |
|---|---|
| `AddMembersModal.css` (bottom section) | `#333`, `#666`, `#888`, `#d0d0d0`, `#d32f2f`, `#3f51b5`, `#ffebee`, `#999`, `#f5f5f5`, `#e0e0e0` |
| `ViewMemberModal.css` | `var(--primary-color)`, `var(--text-primary)`, `var(--text-secondary)`, `var(--bg-light)`, `var(--border-color)` — **undefined tokens** |
| `PhoneInput.css` | `var(--text-primary, #1a1a1a)`, `var(--border-subtle, #e2e8f0)`, `var(--accent-primary, #561789)` — **non-standard tokens** with fallbacks |
| `UserPage.css` | `var(--text-primary, #1a1a1a)`, `var(--accent-primary, #2563eb)`, `var(--border-subtle, #e2e8f0)` — **non-standard tokens** |
| `btn-primary-inverted` in `buttons.css` | `#8b5cf6`, `#f5f3ff` hard-coded |

**Fix:** Map all non-standard tokens to the official token set:

| Non-standard | Map to |
|---|---|
| `--primary-color` | `--purple-700` |
| `--text-primary` | `--gray-900` |
| `--text-secondary` | `--gray-600` |
| `--bg-light` | `--gray-50` |
| `--border-color` | `--gray-200` |
| `--border-subtle` | `--gray-100` |
| `--accent-primary` | `--purple-700` |
| `#333` | `var(--gray-800)` |
| `#666` | `var(--gray-500)` |
| `#888` | `var(--gray-400)` |
| `#999` | `var(--gray-400)` |
| `#d0d0d0` | `var(--gray-300)` |
| `#d32f2f` | `var(--error-text)` |
| `#ffebee` | `var(--error-bg)` |
| `#3f51b5` | `var(--purple-700)` |
| `#e0e0e0` | `var(--gray-200)` |

### 23.6 Inconsistent `border-radius` Values

| File | Value used | Should be |
|---|---|---|
| `PhoneInput.css` | `6px` | `var(--radius-sm)` |
| `UserPage.css` | `6px` | `var(--radius-sm)` |
| `AddMembersModal.css` | `var(--radius-sm)` instead of `var(--radius-md)` for inputs | `var(--radius-md)` |

### 23.7 Duplicate `.page-title` Definitions

Defined in both:
- `pagetitle/pagetitle.css`
- `TeamsPage.css`

**Fix:** Keep in `pagetitle.css` only. Remove from `TeamsPage.css`.

### 23.8 Duplicate Toggle Switch Styles

Defined in both:
- `components/toggle/toggle.css`
- `TeamsPage.css`

**Fix:** Keep in `toggle/toggle.css` only, import in `app.css`. Remove from `TeamsPage.css`.

### 23.9 Inconsistent `px` vs `rem` Units

`AddMembersModal.css` (bottom section) and `ViewMemberModal.css` use raw `px` values (`24px`, `16px`, `12px`, `13px`, `14px`, `11px`, `10px`, `8px`, `4px`, etc.).

**Fix:** Convert all to `rem` using the `1rem = 16px` base:
- `24px` → `1.5rem`
- `16px` → `1rem`
- `14px` → `0.875rem`
- `13px` → `0.8125rem`
- `12px` → `0.75rem`
- `11px` → `0.6875rem`
- `10px` → `0.625rem`
- `8px` → `0.5rem`
- `4px` → `0.25rem`

### 23.10 `ProjectsPage.css` Parallel Modal System

`ProjectsPage.css` defines its own modal system (`.modal-overlay`, `.modal-box`, `.modal-form-group`, `.modal-label`, `.modal-input`, `.modal-actions`, `.modal-btn-cancel`, `.modal-btn-submit`) that diverges from the shared modal system.

**Fix:** Migrate to the shared `.modal-*` classes. Remove the parallel system.

### 23.11 `form-group` Inconsistency

In `AddMembersModal.css` (bottom section), `.form-group` gets `display: flex; flex-direction: column` added, conflicting with the global `.form-group { margin-bottom: 1.5rem }`.

**Fix:** Consolidate into one definition.

### 23.12 Missing Responsive Breakpoints

The following pages have **no responsive styles**:
- `AlumniPage.css`
- `AdministrationPage.css`
- `HelpAndSupportPage.css`
- `UserPage.css`
- `MembersPage.css`

**Fix:** Add the standard breakpoint patterns from Section 20.


## Quick Reference: When Building a New Feature

1. **Start with the tokens** — never hard-code colors, radii, shadows, or fonts.
2. **Reuse existing component classes** (`.card`, `.btn`, `.badge`, `.form-*`, `.modal-*`) before creating new ones.
3. **Place shared styles** in `components/` and import via `app.css`.
4. **Page-specific styles** go in the page's own `.css` file, prefixed with the page name.
5. **Modal-specific styles** go in the modal's own `.css` file, containing **only unique styles** — never re-declare base modal classes.
6. **Use `rem` exclusively** — never raw `px` (exception: `1px` borders, `50%` circles).
7. **Follow the type scale** — don't invent new sizes. Use the closest standard size.
8. **Test at all three breakpoints** (640px, 768px, 900px).
9. **Animations:** use the standard easing curves and durations from Section 18.
10. **Keep CSS flat** — max 3 levels of selector nesting.

