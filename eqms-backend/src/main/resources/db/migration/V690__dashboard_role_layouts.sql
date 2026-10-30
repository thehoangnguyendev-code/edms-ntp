CREATE TABLE dashboard_role_layouts (
    role_id UUID PRIMARY KEY REFERENCES roles(id),
    priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 100000),
    layout JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID NOT NULL
);
CREATE INDEX dashboard_role_layouts_priority_idx ON dashboard_role_layouts(priority, role_id);
