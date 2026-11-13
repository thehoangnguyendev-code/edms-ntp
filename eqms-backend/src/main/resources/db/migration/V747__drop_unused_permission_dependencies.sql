-- permission_dependencies (V403) was reference data for a "Phase 2" dependency enforcement that was never built:
-- no runtime code read it (PermissionDependencyGraphService had no caller). The Access Profile screen ticks the view
-- permission from the permission codes in the browser, not from this table. Owner decision 2026-11-09: remove it.
-- Earlier migrations that INSERT/DELETE rows still run before this one on a fresh database.
DROP TABLE IF EXISTS permission_dependencies;
