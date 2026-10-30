-- Serialize configuration and authorization writes before evaluating the final
-- transaction state. This protects even updates outside the Java services.
CREATE FUNCTION lock_emergency_access_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(4994858482022699590);
    RETURN NULL;
END;
$$;

CREATE FUNCTION validate_emergency_access_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    current_policy administrative_network_policy%ROWTYPE;
BEGIN
    SELECT * INTO current_policy FROM administrative_network_policy WHERE id = true;
    IF NOT FOUND OR NOT current_policy.enabled THEN
        RETURN NULL;
    END IF;
    IF current_policy.emergency_user_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM app_users u
        JOIN user_access_profiles uap ON uap.user_id = u.id
        JOIN roles r ON r.id = uap.access_profile_id AND r.is_active = true
        JOIN access_profile_permission_sets aps ON aps.access_profile_id = r.id
        JOIN permission_sets ps ON ps.id = aps.permission_set_id AND ps.active = true
        JOIN permission_set_items psi ON psi.permission_set_id = ps.id
        JOIN permissions p ON p.id = psi.permission_id
        WHERE u.id = current_policy.emergency_user_id
          AND u.status = 'Active'
          AND lower(trim(p.code)) = 'settings.configuration.manage'
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'The enabled network policy requires an active emergency account with configuration management permission';
    END IF;
    RETURN NULL;
END;
$$;

DO $$
DECLARE
    target_table text;
BEGIN
    FOREACH target_table IN ARRAY ARRAY[
        'administrative_network_policy', 'app_users', 'user_access_profiles', 'roles',
        'access_profile_permission_sets', 'permission_sets', 'permission_set_items', 'permissions'
    ] LOOP
        EXECUTE format('CREATE TRIGGER emergency_guard_lock BEFORE INSERT OR UPDATE OR DELETE ON %I FOR EACH STATEMENT EXECUTE FUNCTION lock_emergency_access_guard()', target_table);
        EXECUTE format('CREATE CONSTRAINT TRIGGER emergency_guard_validate AFTER INSERT OR UPDATE OR DELETE ON %I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_emergency_access_guard()', target_table);
    END LOOP;
END;
$$;
