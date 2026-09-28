-- Follow-up to V418/V419: now that the 8 Document Administration screens are gated by their own
-- granular permissions, correct the old catch-all pair's description so it no longer falsely
-- claims to cover those screens -- avoids re-introducing the exact "unclear naming" problem this
-- whole change set was meant to fix.
--
-- documents.admin.view keeps 3 real, unrelated effects after this change (verified in code, not
-- retired): DocumentAuthorizationService's blanket "view all documents" check, an OR-fallback in
-- ElectronicSignatureSettingsController, and the Controlled Copy batch discrepancies review
-- screen. documents.admin.manage has no remaining code reference at all after this change set --
-- kept only so existing Access Profiles holding it are not silently altered.

UPDATE permissions
SET name = 'View All Documents (Legacy Broad Grant)',
    description = 'Grants blanket read access to every document master and revision '
    || 'system-wide. Also used as a fallback when viewing e-signature records and reviewing '
    || 'Controlled Copy batch distribution discrepancies.'
WHERE code = 'documents.admin.view';

UPDATE permissions
SET name = 'Document Administration (Legacy, Superseded)',
    description = 'No longer independently checked anywhere; superseded by the granular '
    || 'Document Administration permissions above. Kept only for historical Access Profile '
    || 'compatibility -- use the specific permissions instead.'
WHERE code = 'documents.admin.manage';
