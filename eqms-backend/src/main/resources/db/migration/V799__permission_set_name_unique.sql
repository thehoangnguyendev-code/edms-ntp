-- AUDIT-OBJECT-REGISTRY-2026-11-17 (owner tick C1): a configuration object is known in the Audit Trail by its name, so its name must be unique.
-- Every other configuration kind already has a unique name in the database (departments, positions, business units, document types, templates, knowledge hierarchies, roles...);
-- a permission set had only a unique code and a check in the service. The check ignored capital letters in the database no more: the same name written differently is the same name.
-- Forward-only, idempotent. DEV had no two permission sets with the same name when this was written.
CREATE UNIQUE INDEX IF NOT EXISTS ux_permission_sets_name_lower ON permission_sets (lower(btrim(name)));
