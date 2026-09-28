-- Clarify the display name/description of the Document Administration permission family in the
-- Permission Catalog. Admins reported the existing text was ambiguous about what "Document
-- Administration" actually covers when choosing what to grant on an Access Profile / Permission
-- Set.
--
-- Deliberately NOT changing `code` -- these codes are matched as literal strings across dozens of
-- backend controllers/services and frontend components (ProtectedRoute, hasPermissionAlias,
-- navigation.ts), and are already granted to 11 (view) / 8 (manage) / 7 (manage_workflow_roles)
-- Permission Sets by permission_id (UUID), not by code. Only the catalog's descriptive text
-- changes here -- zero functional/authorization impact.

UPDATE permissions
SET name = 'View Document Administration Settings',
    description = 'View the Document Administration screens (Properties, Name Formats, '
        || 'Components, Types, Sub-Types, Knowledge Categories, Publishing Templates, Controlled '
        || 'Copies Policy) and the Document Revision workflow rules (segregation-of-duties) '
        || 'settings.'
WHERE code = 'documents.admin.view';

UPDATE permissions
SET name = 'Manage Document Administration Settings',
    description = 'Create and edit Document Properties, Name Formats, Components, Types, '
        || 'Sub-Types, Knowledge Categories, Publishing Templates, and Controlled Copies Policy. '
        || 'Excludes Document Revision segregation-of-duties rules (separate permission).'
WHERE code = 'documents.admin.manage';

UPDATE permissions
SET name = 'Manage Document Revision Segregation-of-Duties Rules',
    description = 'Edit the Document Revision workflow''s segregation-of-duties rules (e.g. '
        || 'reviewer cannot approve, require two reviewers, author cannot review own revision). '
        || 'Unrelated to the Workflow Roles catalog under Security & Authorization.'
WHERE code = 'documents.admin.manage_workflow_roles';
