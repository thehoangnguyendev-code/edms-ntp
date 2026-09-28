-- Historical grant rows remain intact, but an account can only have one currently-enforced
-- access window. This backs the service-level validation and prevents concurrent requests from
-- creating conflicting scheduler ownership markers.
CREATE UNIQUE INDEX ux_time_limited_user_grants_one_active_per_user
    ON time_limited_user_grants (user_id)
    WHERE status = 'ACTIVE';
