-- Force Publish (publishing a Revision despite non-Effective Related Documents) is a GMP
-- exception/deviation, not a routine publish action -- it must require its own dedicated
-- permission that is granted to nobody by default, distinct from documents.revision.publish and
-- documents.workspace.manage. Organizations opt specific Access Profiles (e.g. QA Head, DCO
-- Manager) into it explicitly.
INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES (
    gen_random_uuid(),
    'documents.revision.force_publish',
    'Force Publish Revision (Override Related Documents Check)',
    'Revision Workflow',
    'documents',
    'revision_workflow',
    'Allows publishing a Revision even when one or more Related Documents are not currently Effective. GMP exception/deviation -- not granted by default.',
    708,
    true
)
ON CONFLICT (code) DO NOTHING;
