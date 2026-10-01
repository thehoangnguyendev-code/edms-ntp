# Countries retirement — CR-COUNTRIES-2026-10-01

## Authorization and intended change

User explicitly requested removal of Countries from FE, BE, API and DB.
This is feature retirement, not a GMP-compliance determination.
The project's referenced change-record template, system evidence documents and
governance Decision Log were unavailable in this checkout; this focused record
captures source and test evidence without inventing business rules.

## Invariants

- Remove only Countries routes, menu, API, external client/cache and dedicated permissions.
- Do not broaden other actor permissions or object scope.
- Preserve Schools' free-text country-of-origin data, all audit history and Flyway history.
- Document lifecycle, parent-child effects, artefact checksums, e-signatures and generation jobs are unchanged.

## Source-confirmed scope and impact

- FE Countries view/types/API removed; exports, route, navigation and breadcrumb removed.
- Server controller (list/page/filter-options/refresh), service, REST Countries client and DTO removed.
- Server navigation and generic dictionary-management capability no longer accept country grants.
- REST Countries property and Docker key injection removed.
- V439 already drops the former countries table. Additive V515 retires the two permission codes,
  their dependency edges and permission-set assignments; it does not modify old migrations or audits.
- GitNexus: settingsRoutes LOW (1 direct caller, AppRoutes flow); getNavigation LOW
  (2 direct callers); getCapabilities LOW (1 direct caller). Countries boundary LOW;
  fetchAllCountries MEDIUM (5 direct callers, limited to Countries). Remaining helpers LOW.

## Verification (2026-10-01)

- FE `tsc --noEmit --pretty false`: passed.
- FE full Vitest suite: 24 files, 155 tests passed (including 2 retirement checks).
- BE clean compilation and `CountriesRetirementTest,EducationManagementServiceAuthorizationTest,
  DictionaryManagementServiceAuthorizationTest`: 40 tests passed. Clean compilation also
  ensures deleted backend classes cannot survive as stale target/classes output.
- Countries negative tests: obsolete grants cannot expose navigation/search or dictionary
  capability; deleted controller/client/service/DTO cannot be loaded. Schools navigation remains.
- PostgreSQL 17 fixture executes the actual V515 migration against TEMP tables inside one
  transaction; assertions passed and ROLLBACK completed. Two country permissions/assignments and
  their dependency were removed; unrelated school permission/data and sample audit were preserved.
  Reproduce from repository root in PowerShell:
  `Get-Content eqms-backend/src/test/resources/countries-retirement-fixture.sql,
  eqms-backend/src/main/resources/db/migration/V515__retire_countries_feature.sql,
  eqms-backend/src/test/resources/countries-retirement-assertions.sql |
  docker exec -i eqms-postgres psql -U eqms -d eqms-database -v ON_ERROR_STOP=1`.
- Live DB read-only check: public.countries already absent; both country permissions still exist.
  Actual permission FKs match the migration (permission_set_items, permission_dependencies).
- Runtime source reference scan found no Countries view/API/permission/client references.
- `git diff --check`: passed. GitNexus detect-changes reported CRITICAL across the whole already
  dirty workspace (48 files, 95 symbols, 35 processes), including unrelated signature, document
  and preview work. This aggregate is not a Countries-only risk result. No commit was made.

## Deployment limits and recovery

Migration V515 is not yet applied to the running database; Docker containers are not rebuilt.
Run the normal deployment/Flyway workflow rather than modifying flyway_schema_history manually.
Deleted source files remain recoverable through Git. Applied permission deletion requires
database backup or an explicit restoration migration to restore prior assignments.
