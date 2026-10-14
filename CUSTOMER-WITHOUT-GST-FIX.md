# Customer without GSTIN fix

## Change
- The party form now clearly labels the GST registration choice as `GST registered (B2B)` or `No GSTIN — Unregistered (B2C)`.
- GSTIN is explicitly optional for customers without GST, with helper text in the form.
- Saving a party with an empty GSTIN no longer blocks the user: if it was left at the default `registered` setting, it is safely normalized to `unregistered` (B2C).
- If a GSTIN is entered for a registered party, it must still pass GSTIN validation.

## Safety
- This is a source-code-only change. No production Neon database was accessed or modified.
- Deploy the updated source before testing in the live app. Test by adding a customer with name and blank GSTIN, then confirm it appears as B2C / Unregistered after refresh.
