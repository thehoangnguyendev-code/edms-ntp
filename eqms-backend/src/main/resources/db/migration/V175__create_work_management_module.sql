-- Independent Jira-like work-management module. It only shares app_users.
CREATE TABLE work_global_user_roles (
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    role_code VARCHAR(40) NOT NULL CHECK (role_code IN ('WORK_ADMIN')),
    PRIMARY KEY (user_id, role_code)
);

CREATE TABLE work_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_key VARCHAR(12) NOT NULL UNIQUE,
    name VARCHAR(180) NOT NULL,
    description TEXT,
    project_type VARCHAR(20) NOT NULL DEFAULT 'KANBAN' CHECK (project_type IN ('KANBAN', 'SCRUM')),
    lead_user_id UUID NOT NULL REFERENCES app_users(id),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    issue_sequence BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE work_project_members (
    project_id UUID NOT NULL REFERENCES work_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    role_code VARCHAR(30) NOT NULL CHECK (role_code IN ('PROJECT_ADMIN', 'MEMBER', 'VIEWER')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, user_id)
);

CREATE TABLE work_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_key VARCHAR(32) NOT NULL UNIQUE,
    project_id UUID NOT NULL REFERENCES work_projects(id) ON DELETE CASCADE,
    issue_type VARCHAR(20) NOT NULL DEFAULT 'TASK' CHECK (issue_type IN ('EPIC', 'STORY', 'TASK', 'BUG', 'SUB_TASK')),
    summary VARCHAR(500) NOT NULL,
    description TEXT,
    status_code VARCHAR(30) NOT NULL DEFAULT 'TODO' CHECK (status_code IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE')),
    priority_code VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority_code IN ('LOWEST', 'LOW', 'MEDIUM', 'HIGH', 'HIGHEST')),
    reporter_id UUID NOT NULL REFERENCES app_users(id),
    assignee_id UUID REFERENCES app_users(id),
    parent_issue_id UUID REFERENCES work_issues(id),
    due_at TIMESTAMPTZ,
    labels JSONB NOT NULL DEFAULT '[]'::jsonb,
    rank BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE TABLE work_issue_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES work_issues(id) ON DELETE CASCADE,
    actor_user_id UUID NOT NULL REFERENCES app_users(id),
    event_type VARCHAR(40) NOT NULL,
    detail TEXT,
    from_value VARCHAR(255),
    to_value VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_work_projects_lead ON work_projects(lead_user_id);
CREATE INDEX idx_work_members_user ON work_project_members(user_id);
CREATE INDEX idx_work_issues_project_status ON work_issues(project_id, status_code, rank);
CREATE INDEX idx_work_issues_assignee ON work_issues(assignee_id, status_code, due_at);
CREATE INDEX idx_work_history_issue ON work_issue_history(issue_id, created_at);
