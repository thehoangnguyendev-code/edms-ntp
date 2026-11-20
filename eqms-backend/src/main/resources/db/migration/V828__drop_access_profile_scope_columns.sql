-- V828: the Business Unit / Department scope of an Access Profile is removed (Decision VISIBILITY-TIERS-AND-OBJECT-RULE-REMOVAL-2026-11-20).
--
-- Who sees a record is now chosen on the Access Profile as one of three levels (only the records where the person is named, the records of the
-- person's department, all records), and who may act is decided by permission, relation to the record, state and separation of duties; the scope
-- columns decided neither any more (the evaluator that read them was removed in the same change). The values of the 11 DEV profiles that held one are
-- kept as a record in docs/validation/evidence/visibility_tiers_2026_11_20/removed_access_profile_scope_values_DEV_2026_11_20.csv.
ALTER TABLE roles DROP COLUMN IF EXISTS business_unit_scope;
ALTER TABLE roles DROP COLUMN IF EXISTS department_scope;
