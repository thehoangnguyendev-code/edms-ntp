-- Phase 0.7 of SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md §1.1.2 / §2.4: Access Profile
-- `code` must be immutable; only `name` (display label) may change. Verified against the running
-- database: `AccessProfileService.updateProfile` already omits `code` from its update path, but
-- nothing at the DB layer stops a raw UPDATE/future code path from changing it. `roles.code`
-- itself is fully mutable at the entity level (`RoleDefinition.setCode()` is called on create and
-- clone -- those INSERTs are unaffected by this trigger, only UPDATEs that actually change code
-- are blocked).
--
-- Rollback (if needed):
--   DROP TRIGGER IF EXISTS trg_roles_code_immutable ON roles;
--   DROP FUNCTION IF EXISTS enforce_roles_code_immutable();

CREATE OR REPLACE FUNCTION enforce_roles_code_immutable()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.code IS DISTINCT FROM OLD.code THEN
        RAISE EXCEPTION 'roles.code is immutable and cannot be changed (attempted % -> %). Only name/display_name may be updated.',
            OLD.code, NEW.code
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_roles_code_immutable
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION enforce_roles_code_immutable();
