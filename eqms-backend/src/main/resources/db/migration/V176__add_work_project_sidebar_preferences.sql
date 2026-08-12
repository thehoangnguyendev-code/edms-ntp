-- Per-user order for project shortcuts in the Tasks sidebar.
CREATE TABLE work_user_project_preferences (
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES work_projects(id) ON DELETE CASCADE,
    sidebar_sort_order INTEGER NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, project_id)
);

CREATE INDEX idx_work_project_preferences_user_order
    ON work_user_project_preferences(user_id, sidebar_sort_order);
