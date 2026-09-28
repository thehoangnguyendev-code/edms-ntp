# Security Authorization GMP Release Gate

Use this checklist before promoting Security & Authorization changes to a GMP environment.

## Required deployment command

Use the GMP Docker override, never the development compose file alone:

```powershell
docker compose --env-file .env.gmp -f docker-compose.yml -f docker-compose.gmp.yml up -d
```

The override requires non-default PostgreSQL, MinIO, and JWT credentials, enables strict secrets,
and turns Flyway validation on.

## Migration integrity hold point

The current local database records historical Flyway versions `V198`, `V199`, and `V200`, but the
matching source scripts are not present in this workspace because the retired AI feature was removed.
This means the base development compose file temporarily keeps Flyway validation disabled.

Before any GMP deployment:

1. Retrieve the exact, checksum-preserving V198-V200 scripts from the controlled release archive.
2. Store them back in `eqms-backend/src/main/resources/db/migration/` without editing their content.
3. Run `docker compose ... config` using the GMP override and confirm Flyway validation is `true`.
4. Run Flyway validation against a restored production-like database and retain the output with the release evidence.
5. Remove the temporary validation exception from `docker-compose.yml` only after the validation result is approved.

Do not alter `flyway_schema_history`, create replacement scripts with the same version, or use checksum repair
to bypass this hold point. Each option would compromise traceability.

## Authorization regression evidence

Run the targeted authorization suite before release:

```powershell
Set-Location eqms-backend
.\mvnw.cmd -q "-Dtest=WorkflowActionPolicyServiceTest,WorkflowActionPolicyControllerSecurityTest,EffectivePermissionServiceTest,ObjectAccessEvaluationServiceTest,Sprint10AuthorizationHardcodeRegressionTest" test
```

Document the approved test run, electronic-signature evidence for policy changes, and the access-profile
backfill report as part of the release package.
