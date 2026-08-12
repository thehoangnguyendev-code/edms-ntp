-- Last visited screen per workspace, stored independently for each user.
CREATE TABLE user_workspace_navigation_preferences (
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    workspace_code VARCHAR(16) NOT NULL CHECK (workspace_code IN ('QUALITY', 'TASKS')),
    last_route VARCHAR(2048) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, workspace_code)
);
