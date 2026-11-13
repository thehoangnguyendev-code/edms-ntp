-- V746: plain descriptions of the permissions behind Document Control visibility (DC-VISIBILITY-TIERS-2026-11-07).
-- Text only; no permission is granted or removed. permissions.description is VARCHAR(255): keep each text short.
UPDATE permissions SET description = 'See every Document and Revision, drafts included. Part of the view-everything bundle (with the two copy permissions). Read-only: acting needs a name in the flow.'
WHERE code = 'documents.document.view_all';

UPDATE permissions SET description = 'See every Controlled Copy and distribution batch. Part of the view-everything bundle. Without it a person sees only the copies they received.'
WHERE code = 'documents.controlled_copy.view_all';

UPDATE permissions SET description = 'See every Uncontrolled Copy. Part of the view-everything bundle. Without it a person sees only the copies they received (an approver also sees requests waiting for a decision).'
WHERE code = 'documents.uncontrolled_copy.view_all';

UPDATE permissions SET description = 'See all Records (scans of returned paper copies) and open their files. A Record has no flow: whoever holds this permission sees every one. Downloading also needs the download permission.'
WHERE code = 'documents.form.view_executed_records';
