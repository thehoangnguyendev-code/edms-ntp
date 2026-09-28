-- Point-in-time Access Profile snapshot for Audit Trail, alongside the existing role_name /
-- position_name / department_name actor snapshot columns on audit_logs. Access Profile is a
-- many-valued assignment (user_access_profiles), so this is a text array rather than a single
-- varchar column like the others. Existing rows are left NULL (no snapshot was ever captured for
-- them) -- the application falls back to showing "Unassigned" for those, matching how the other
-- actor snapshot columns already handle historical rows written before a column existed.
ALTER TABLE audit_logs ADD COLUMN access_profile_names TEXT[];
