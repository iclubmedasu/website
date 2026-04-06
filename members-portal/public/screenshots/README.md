# PWA Screenshots

These screenshots appear in the PWA install dialog on
Android (Google Chrome) and provide users a preview
of the app before installing.

## How to generate real screenshots

Make sure the portal is running and you have a test account:

```bash
# Set test credentials in .env
TEST_EMAIL=your@email.com
TEST_PASSWORD=yourpassword

# Run the capture script
pnpm pwa:screenshots
```

## Required files
- desktop.png — 1280x720 pixels (wide/desktop form factor)
- mobile.png — 390x844 pixels (narrow/mobile form factor)

## Note
Screenshots are not required for the PWA to be installable.
They only enhance the install dialog experience on Android.
