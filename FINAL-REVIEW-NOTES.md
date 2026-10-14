# Hysiac GST Billing — source update notes

## Changes included

- Moved `BooksSync` from the page shell to the persistent root so route changes do not unmount the debounced Neon sync.
- Serialized pending writes, retained dirty state if changes occur during a save, prevented an older initial database load from replacing newer local edits, and added visible console diagnostics for failed loads/saves.
- Added bounded retry backoff after rejected/failed saves and triggers a prompt save attempt when the page is hidden or being left. Browser shutdown can still interrupt network activity, so verify persistence before relying on it.
- Removed the visible `admin / admin` default-credential message and stopped pre-filling the username field.
- Removed the mobile number and email address from the login footer.
- Replaced the footer text with a professional description and tax-review disclaimer.

## Important security note

Removing the default-credential message does not change the actual credentials of an existing account. Change any default or weak admin password from inside the app before using it for real business records. Do not share the database connection string or authentication secrets.

## Validation status

- Source files and route/sync placement were reviewed statically.
- A full TypeScript build could not be completed in this environment because dependency installation timed out and required type packages/modules were unavailable.
- The repository's broad script tests are not clean in this packaged snapshot: several tests reference omitted `.grok` files, and some environment-wrapper tests fail because the app environment file is absent. These failures are not evidence that the modified app code passes or fails compilation.
- No live Vercel deployment or Neon database was accessed or modified. Production persistence must be tested after deployment with a safe test invoice, payment and purchase.
