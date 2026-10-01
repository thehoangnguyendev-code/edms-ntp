-- V517: Form / eForm Phase 2a -- per-role signer assignment. A Form's fillable template can define
-- multiple OnlyOffice Form Roles (e.g. "Nguoi_lap"/"Truong_phong"/"Quality_Manager") via the
-- Design session's "Manage Roles" feature; a Fill session must be started FOR one specific role,
-- and only the person assigned to that role here may start it -- OnlyOffice itself locks fields
-- belonging to other roles once a role is chosen inside a Fill session, but nothing at the
-- Document Server API level stops any viewer from picking any role, so this table is the actual
-- enforcement point (see EformEditSessionService#startFillSession).

CREATE TABLE form_role_assignments (
    id UUID PRIMARY KEY,
    form_document_id UUID NOT NULL REFERENCES documents(id),
    role_name VARCHAR(100) NOT NULL,
    assigned_user_id UUID NOT NULL REFERENCES app_users(id),
    lock_version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (form_document_id, role_name)
);

CREATE INDEX idx_form_role_assignments_document ON form_role_assignments(form_document_id);

-- Which role (if any) a FILL session was started for -- NULL means the Form has no roles
-- configured yet and the session may fill any unassigned field (back-compat with Phase 2a's
-- original single-user-fills-everything behavior).
ALTER TABLE eform_edit_sessions ADD COLUMN assigned_role VARCHAR(100);
