-- Splits the catch-all Document Administration permission pair (documents.admin.view /
-- documents.admin.manage) into 6 granular permission pairs, one per functional screen, so an
-- Access Profile can delegate (e.g.) "manage Document Types" without also granting "manage
-- Controlled Copies Policy".
--
-- documents.admin.view / documents.admin.manage are DELIBERATELY left untouched: they still
-- gate 3 unrelated things elsewhere (DocumentAuthorizationService's blanket "view all documents"
-- check, an OR-fallback in ElectronicSignatureSettingsController, and the Controlled Copy batch
-- discrepancies review screen). See V419 for how existing holders are preserved, and V420 for
-- the follow-up description correction on the old pair.

INSERT INTO permissions (id, code, name, category, module_key, group_key, description, display_order, requires_audit)
VALUES
    (gen_random_uuid(), 'documents.admin.properties.view', 'View Document Properties',
     'Document Administration', 'documents', 'document_administration',
     'View the Document Properties screen (default revision number format, default document number format, file size limit, watermark and download policy).',
     41, FALSE),
    (gen_random_uuid(), 'documents.admin.properties.manage', 'Manage Document Properties',
     'Document Administration', 'documents', 'document_administration',
     'Edit the Document Properties screen (default revision number format, default document number format, file size limit, watermark and download policy).',
     42, TRUE),

    (gen_random_uuid(), 'documents.admin.name_formats.view', 'View Document Name Formats',
     'Document Administration', 'documents', 'document_administration',
     'View the Document Name Formats and Document Components catalogs.',
     43, FALSE),
    (gen_random_uuid(), 'documents.admin.name_formats.manage', 'Manage Document Name Formats',
     'Document Administration', 'documents', 'document_administration',
     'Create and edit Document Name Formats and Document Components.',
     44, TRUE),

    (gen_random_uuid(), 'documents.admin.document_types.view', 'View Document Types',
     'Document Administration', 'documents', 'document_administration',
     'View Document Types and Document Sub-Types.',
     45, FALSE),
    (gen_random_uuid(), 'documents.admin.document_types.manage', 'Manage Document Types',
     'Document Administration', 'documents', 'document_administration',
     'Create and edit Document Types and Document Sub-Types.',
     46, TRUE),

    (gen_random_uuid(), 'documents.admin.knowledge_categories.view', 'View Knowledge Categories Hierarchies',
     'Document Administration', 'documents', 'document_administration',
     'View the Knowledge Categories Hierarchies screen.',
     47, FALSE),
    (gen_random_uuid(), 'documents.admin.knowledge_categories.manage', 'Manage Knowledge Categories Hierarchies',
     'Document Administration', 'documents', 'document_administration',
     'Create and edit Knowledge Categories Hierarchies.',
     48, TRUE),

    (gen_random_uuid(), 'documents.admin.publishing_templates.view', 'View Publishing Templates',
     'Document Administration', 'documents', 'document_administration',
     'View Publishing Templates.',
     49, FALSE),
    (gen_random_uuid(), 'documents.admin.publishing_templates.manage', 'Manage Publishing Templates',
     'Document Administration', 'documents', 'document_administration',
     'Create and edit Publishing Templates.',
     50, TRUE),

    (gen_random_uuid(), 'documents.admin.controlled_copies_policy.view', 'View Controlled Copies Policy',
     'Document Administration', 'documents', 'document_administration',
     'View the Controlled Copies Policy screen (expiry limits, placeholder fields, distribution rules).',
     51, FALSE),
    (gen_random_uuid(), 'documents.admin.controlled_copies_policy.manage', 'Manage Controlled Copies Policy',
     'Document Administration', 'documents', 'document_administration',
     'Create and edit the Controlled Copies Policy (expiry limits, placeholder fields, distribution rules).',
     52, TRUE)
ON CONFLICT (code) DO NOTHING;
