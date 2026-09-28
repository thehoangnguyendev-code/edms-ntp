# Change Record — Policy Resolver Trace

Status: **IMPLEMENTED** · Scope: read-only workflow-policy resolution diagnostics

## Invariant

- The resolver reads the same active policy records used for policy lookup; it never creates,
  updates, activates, deactivates, or executes a workflow action.
- `POST`/`PUT` policy changes retain their existing authorization, audit and e-signature controls.
  Runtime authorization remains server-side and is re-evaluated when a real action is executed.
- The resolver reports stable machine reason codes for document-type override selection, global
  fallback, and no active policy. It does not disclose actor-specific authorization decisions.

## Evidence

- `WorkflowActionPolicyService.getEffectivePolicy` returns an additive trace while preserving the
  prior source/policy/fallback contract.
- `WorkflowActionPolicyMultiWorkflowTest` covers direct-global selection and document-type
  fallback behavior.
- No database migration is required: the feature reads existing `workflow_action_policies` data.

## UI delivery

- The resolver is a dedicated, permission-guarded route at
  `/security/lifecycle-policies/policy-resolver`; it replaces the constrained modal entry point.
- URL parameters retain only the selected lookup context after a successful resolution. The
  result itself is always re-resolved by the server; the browser does not cache, filter, or infer
  a policy decision.
