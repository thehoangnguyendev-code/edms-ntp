# Uncontrolled copy validity: distribution or the document's Valid Until (2026-10-07)

Decision UC-VALIDITY-2026-10-07 (../governance/DECISION_LOG.md).

- **DB**: V552 adds `uncontrolled_copy_policy_settings.validity_basis` (DISTRIBUTION default | DOCUMENT_VALID_UNTIL). No data changed.
- **Policy** (`UncontrolledCopyPolicyService`): saves and audits the basis; hours 1..8760 for DISTRIBUTION, 0..8760 for
  DOCUMENT_VALID_UNTIL, checked on the resulting pair (so changing only the basis is checked against the stored hours).
- **Service** (`UncontrolledCopyService`): `computeValidUntil` (distribution + hours, or end of the Valid Until day + hours) and
  `validityProblem` (no Valid Until / already passed) are used by the request, the request context and the distribution, so the value
  shown, the value checked and the value stored come from one function.
- **API**: the request context also returns `validityBasis`, `documentValidUntil` and `computedValidUntil`; the policy request and response
  carry `validityBasis`.
- **Screens**: Uncontrolled Copies Policy > Validity: "Validity counted from" and the hours field (label, range and help follow the basis; the
  hours reset to 72 / 0 when the basis is switched). The request modal shows "Valid until 30/10/2027 23:59 (the document's Valid Until date
  27/10/2027 + 72 hours)", or "Valid for N hours after distribution" as before.
- **Tests**: `UncontrolledCopyValidityBasisTest` (7, calculation and policy validation), `UncontrolledCopyValidityIntegrationTest` (4, real
  schema: context with the exact value, default basis, no date, passed date), frontend policy view +2, request modal 3. All `UncontrolledCopy*`
  tests pass.
- **Not done**: not tried in a browser; no per-document override; GitNexus impact and `detect_changes` not run (tool not available in this
  session; nothing committed).
