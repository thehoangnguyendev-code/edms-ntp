# Controlled copy expiry follows the document; Expiry Duration is the e-mail link (2026-10-07)

Decision CC-EXPIRY-2026-10-07 (../governance/DECISION_LOG.md).

- **Copy expiry**: `ControlledCopyService` sets `expiryDate` from the Valid Until date of the effective revision (else the document), as the
  start of that day in the system zone (the authorization layer already reads a local-midnight expiry as valid through that day). No
  Valid Until: no expiry date. A requested date later than it is refused. Copies still flagged "anchored to distribution" (created before
  this change) take the document's date when distributed. Replacement copies still inherit the original's expiry. The scheduler, the
  reminders and the stamp or watermark "Expiry date" read the same field and are unchanged.
- **Link validity**: `openPreview` refuses a guest (no eQMS session) once `distributedAt + duration` of the most specific active rule has
  passed ("The link in the distribution e-mail has expired ... Ask the Document Control Officer for a new link."). A signed-in user is not held
  to it. The password step, the grant and the viewing session (External Viewer Session) are unchanged.
- **Screens**: Controlled Copies Policy section "Download Link Expiry" (explanation, "Link valid for", rule modal and warning texts); the
  request screen shows "valid until <Valid Until>" and "the e-mail link works for N after it is sent".
- **Tests**: `ControlledCopyEndToEndIntegrationTest` +4 (copy expires on the document's date; none without a date and still issued; a later
  requested date refused; link refused for a guest after the duration, allowed within it, and not binding on a signed-in user); the other
  tests of that class now give the seed document a future Valid Until, as a copy of an expired document can no longer be distributed.
  All `ControlledCopy*` tests pass.
- **Not done**: a "send a new link" action (an external recipient whose link expired cannot recover it); no change to the expiry of copies
  already issued; the table and API keep their names (controlled_copy_expiry_limits, expiryLimits) although they now mean link validity;
  GitNexus impact and `detect_changes` not run (tool not available in this session; nothing committed); not tried in a browser.
