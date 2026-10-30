# Page background configuration — change record

## Change and scope

The user requested independent configurable backgrounds for the main content area and authentication screens. Administrators can retain the existing background or select a solid color, linear, radial, or conic gradient, with two to five colors and an angle for linear and conic gradients. Existing configuration persistence, authorization and audit handling are retained; this change adds no database migration.

## Invariants and risk

- Only the existing configuration update path changes saved settings. The public branding response exposes validated background properties only. Authentication, permissions, lifecycle, files, electronic signatures and asynchronous processing are unchanged.
- Default or invalid existing values fall back to the previous appearance. Background CSS is constructed from validated color and angle values; arbitrary CSS is not accepted.
- Impact analysis identified the shared public branding path and maintenance view as CRITICAL because of broad downstream use. The requested change is limited to presentation and the existing configuration and branding flow.
- Background colors are administrator-selected; choosing a dark color can reduce contrast in main content. The settings UI recommends light backgrounds.

## Evidence

- Frontend: six targeted Vitest suites, 19 tests passed, covering background generation and application, configuration controls, existing General settings, authentication and main layout. TypeScript `tsc --noEmit` passed.
- Backend: `PageBackgroundConfigurationTest`, `SystemConfigurationServiceBrandingTest` and `AlternatingRecordConfigurationTest` passed, including invalid value rejection and public-field filtering.
- Signed-in end-to-end and mobile browser verification against the running application remain to be performed after deploying both frontend and backend. This record does not assert regulatory compliance.

## Extension: gradient stops and authentication image

The user requested adjustable gradient stop positions/order, radial center, and a login background image with fit and overlay settings. Existing color arrays without stop positions retain their previous rendering. Images are limited to PNG/JPEG/WebP data URLs up to 1 MiB; they are included in the public branding response because the login page is accessible before authentication. Administrators should therefore use images intended for public display. Existing configuration authorization and audit remain in force. No migration or authentication change is introduced.

Targeted frontend tests cover legacy rendering, validated gradient/image CSS, editor upload and invalid file handling; backend tests cover supported configuration and rejection of invalid image URLs, positions and centers. The running application still requires frontend/backend deployment and end-to-end desktop/mobile verification, including real image upload and save.
