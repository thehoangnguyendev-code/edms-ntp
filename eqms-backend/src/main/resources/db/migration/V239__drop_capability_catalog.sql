-- Quick Access Assignment feature removed per explicit product decision
-- (2026-07-18) — the Capability Catalog layer it depended on is dropped.
-- Roles & Permissions / Access Profiles / Permission Sets are unaffected;
-- this table only ever held a thin, additive mapping on top of them.
DROP TABLE IF EXISTS capability_catalog;
