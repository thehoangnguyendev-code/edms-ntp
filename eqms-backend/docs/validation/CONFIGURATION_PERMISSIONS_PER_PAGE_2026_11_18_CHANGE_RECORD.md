# Change record: one View and one Manage permission for each page of Configuration (V806)

Date: 2026-11-18. Based on `08_ONE_CHANGE_RECORD_TEMPLATE.md`. Owner decisions are in the Decision Log, entry `CONFIGURATION-PERMISSIONS-PER-PAGE-2026-11-18`.

## 1. What changed and why

The permission pair `settings.configuration.view` / `settings.configuration.manage` gave one key to all 8 pages of System Administration > Configuration (General, Navigation Labels, Security, Notifications, Integrations, Preview File, Image Watermark, Features), although a page such as Security (network access, session and password rules) carries a very different risk from Navigation Labels. It was also a fallback of about 80 checks of other screens and the only permission of two screens that are not pages of Configuration.

Owner decisions (2026-11-18): (1) a View and a Manage permission for each page; (2) everybody who held the old pair is given all the new ones automatically so that nobody loses anything; (3) the old pair is **removed for good**, in the same change (the owner chose this over a two-step plan after the size of the fallback use was shown); (4) a save that changes several pages needs the Manage permission of every page it changes; (5) the owner approved the whole change.

## 2. New permissions (V806)

| Permission | Meaning |
|---|---|
| `settings.config_<page>.view` (8) | Open the page and read its History tab in the Audit Trail |
| `settings.config_<page>.manage` (8, `requires_audit`) | Change the page |
| `settings.electronic_signature.view` / `.manage` | The E-Sign Config screen (it had only the old pair) |
| `settings.system_info.view` | The System Information screen (it had only the old pair) |

`<page>` = `general`, `navigation_labels`, `security`, `notifications`, `integrations`, `preview_file`, `image_watermark`, `features` (the same names as `ConfigurationAuditPage`, which is the single source of the codes in the backend, and `configurationPages.ts` in the frontend).

## 3. Rules in the code (the invariant)

- **Save (`PUT /settings/system`)**: the controller passes a predicate to `SystemConfigurationService.updateConfiguration(request, mayManagePage)`. After the save the service knows which pages really changed (the same classification that writes the audit records, `ConfigurationAuditPage.of(section, path)`); a changed page that fails the predicate throws `AccessDeniedException` before the audit record and before any after-commit notice, so the transaction rolls the whole save back. A save that changes nothing needs no page permission. Document Properties (`/system/document-properties`) calls the one-argument method and keeps its own permission.
- **Read (`GET /settings/system`)**: needs any View (or Manage) of the 8 pages; the response leaves out the sections of pages the person may not open (`getConfiguration(mayViewPage)`): Security, Notifications, Integrations → `{}`, Features → `[]`; General → whole to General / Navigation Labels / Image Watermark (without the OnlyOffice connection unless Integrations or Preview File may be opened), only the OnlyOffice connection to Integrations / Preview File; Documents is operational policy that every document user reads from `/settings/system/documents`. The frontend sends only the sections that changed, so a left-out section is never written back; a General section that was cut is merged into the stored one by `mergeGeneralConfigForStorage`.
- Other endpoints: network policy (`AdministrativeNetworkPolicyController/Service`) → Security Manage; storage usage policy and storage / SMTP / OnlyOffice test → Integrations Manage (SMTP test also Notifications Manage); OnlyOffice read → Integrations or Preview File View; storage path preview → Integrations View; Dashboard layout by role and login background video → General Manage; image watermark → Image Watermark Manage; security session timeout → Security Manage; History tab of a page → View/Manage of that page (`AuditTrailService`).
- **Navigation** shows each page to the holders of its View permission and the group when one page shows; E-Sign Config and System Information have their own keys.
- **Fallback removed** from the screens that have a permission of their own (Reports, Document Administration, Notifications Administration, Object Numbering, Controlled/Uncontrolled Copies policy, Publishing Templates, Document Properties, Report layout): the old pair is simply no longer in their lists.
- **Emergency account guard (V693 trigger)**: the enabled administrative network policy requires an emergency account that holds `settings.config_security.manage`; V806 replaces the function **before** the old permission is deleted (the migration would otherwise fail on a DEV with the policy enabled).
- **Notification recipient rules** that named the old Manage (5 events) now name the permission of the page they belong to (`system.configuration_changed` names all 8 Manage permissions).

## 4. Migration V806 steps

1 create the 19 permissions; 2 every permission set holding the old View gets the 8 Views, E-Sign View, System Info View and the own View of the screens that accepted the old View (Reports, Object Numbering, Notification policy / e-mail templates, Document types, Name formats, Controlled / Uncontrolled copies policy, Document properties, Publishing templates); 3 the same for the old Manage; 4 replace `validate_emergency_access_guard()`; 4b update the 5 notification policies; 5 delete the old pair (permission set items first).

Not changed on purpose: old audit rows keep their text (history); dated change records and plans keep naming the old codes as the history of that time.

## 5. Impact (GitNexus, CLI)

`requireConfigurationEdit` MEDIUM (6 direct callers, all in `SettingsUserController`, all changed here), `requireConfigurationView` LOW (4), `updateConfiguration` LOW (3 callers), `updateSecurityConfiguration` LOW (1). No HIGH/CRITICAL. The 35 other files lost the old pair from permission lists only.

## 6. Risk and residual risk

- A person who held the old Manage but not the old View keeps that shape (Manage only), as before: the page cannot be opened without the page View.
- Permission-set holders get the own permission of the other screens too, so some people now hold permissions that they never held by name (they had the access through the fallback). This is the "nobody loses access" decision; an administrator can take the extra permissions away through the normal e-signed permission-set change.
- The restricted path (a person with only one page) is covered by unit tests; it was **not** exercised with a real restricted account on DEV (it needs a new permission set and profile, an e-signed security change).

## 7. Evidence

See section 8 of the Decision Log entry, filled after the run on DEV.
