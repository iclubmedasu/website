# Embeddable registration form — style hooks

This document is the **stable styling contract** for host sites that load the
iClub registration embed (iframe + optional custom CSS URL). Prefer these
hooks over internal Tailwind utility classes; they will be kept stable so
existing embeds keep working when the form is restyled internally.

## Root

| Hook | Targets |
|------|---------|
| `.embed-root` | Outer wrapper of the embed document body content |
| `[data-iclub-embed="registration"]` | Same root (attribute selector) |
| `[data-layout="compact"\|"spacious"\|"default"]` | Layout preset applied on the root |
| `.registration-form` / `[data-registration="form"]` | The `<form>` panel |
| `.registration-panel` | Card chrome around the form (border, padding, background) |
| `.registration-header` / `[data-field="header"]` | Title + subtitle block |
| `.registration-title` | “Register for …” heading |
| `.registration-subtitle` | Supporting instruction text |
| `.registration-loading` / `[data-registration="loading"]` | Loading state copy |
| `.registration-success` / `.embed-success` / `[data-registration="success"]` | In-iframe success panel after submit |
| `[data-field="confirmationCode"]` | Confirmation code on success |
| `.registration-error-banner` / `[data-registration="form-error"]` | Form-level API errors / closed / not-found states |

## Fields (uniform siblings)

Every meaningful field is a **sibling** of class `.registration-field` so CSS
`order` can reorder them freely (use `display: flex; flex-direction: column`
on `.registration-form`).

| Hook | Targets |
|------|---------|
| `.registration-field` | Wrapper for one field (label + control + error) |
| `[data-field="tierId"]` | Registration tier select |
| `[data-field="session"]` | Sessions checkbox group |
| `[data-field="fullName"]` | Full name text input |
| `[data-field="email"]` | Email input |
| `[data-field="phoneNumber"]` | Phone input |
| `[data-field="custom-<id>"]` | Per-event custom field, where `<id>` is the field’s numeric id |
| `[data-field-type="…"]` | Type hint: `text`, `email`, `tel`, `select`, `checkbox`, `checkbox-group`, `dropdown`, `number` |
| `.registration-field-label` | Field label / legend |
| `.registration-field-input` | Input or select control |
| `.registration-field-error` | Inline validation message |
| `.registration-field-hint` | Secondary helper text under a field |
| `.registration-session-options` | Sessions list container |
| `.registration-session-option` | One session checkbox row |
| `[data-session-id]` | Individual session option by id |

## Actions

| Hook | Targets |
|------|---------|
| `.registration-submit` / `[data-registration="submit"]` | Submit button |
| `.btn-primary` | Shared primary button look (also on submit) |

## Example (Tier 2 custom CSS)

```css
.registration-form {
  display: flex;
  flex-direction: column;
}

/* Put email first, then name */
[data-field="email"] { order: 1; }
[data-field="fullName"] { order: 2; }
[data-field="phoneNumber"] { order: 3; }
[data-field="tierId"] { order: 4; }
.registration-submit { order: 99; }

[data-field="email"] .registration-field-input {
  border-color: #0b5fff;
}

.registration-submit {
  background: #0b5fff;
  border-radius: 999px;
}
```

## Tier 1 query / data attributes

These are applied as CSS variables on `.embed-root` before any custom CSS.

| Query param | Loader `data-*` | Effect |
|-------------|-----------------|--------|
| `primaryColor` | `data-primary-color` | Maps onto purple/primary tokens |
| `accentColor` | `data-accent-color` | Accent token |
| `borderRadius` | `data-border-radius` | Radius scale (e.g. `8px`) |
| `fontFamily` | `data-font-family` | Heading/body font stack |
| `layout` | `data-layout` | `default` \| `compact` \| `spacious` |
| `customCssUrl` | `data-custom-css-url` | `https://` stylesheet URL (validated) |
