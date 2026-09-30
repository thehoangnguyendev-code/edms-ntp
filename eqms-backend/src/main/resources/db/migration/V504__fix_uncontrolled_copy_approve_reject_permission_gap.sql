-- V504: fix a real gap found during live E2E verification -- V499's mirror for
-- documents.uncontrolled_copy.approve_request / reject_request sourced from
-- documents.controlled_copy.approve_request / reject_request, but NO access profile in the
-- system (not even Administrator) ever held that Controlled Copy permission pair (Controlled
-- Copy has no standalone "Approve" step in its real workflow), so the mirror produced zero
-- grants -- nobody could ever approve or reject an Uncontrolled Copy request.
--
-- Correct source: documents.revision.approve is the actual "this profile is an Approver in
-- this system" signal (held by Administrator, Approver Lead, Approver Test, DCO, DCO Test,
-- Document Controller, Quality, and the UAT Approver/Document Contributor profiles). Mirror
-- Uncontrolled Copy approve/reject to whoever already holds that.

INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), aps.permission_set_id, target.id
FROM access_profile_permission_sets aps
JOIN permission_set_items existing ON existing.permission_set_id = aps.permission_set_id
JOIN permissions revision_approve ON revision_approve.id = existing.permission_id
    AND revision_approve.code = 'documents.revision.approve'
JOIN permissions target ON target.code IN (
    'documents.uncontrolled_copy.approve_request', 'documents.uncontrolled_copy.reject_request'
)
ON CONFLICT (permission_set_id, permission_id) DO NOTHING;
