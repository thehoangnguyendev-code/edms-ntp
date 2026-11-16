-- UCC-SIMPLE-2026-11-14 (owner decision): an Uncontrolled Copy has two actions only: Distribute (one signature; it makes the watermarked file and hands the copy over)
-- and Cancel Request (a person who holds the permission to cancel; a reason is required). There is no approval step and no rejection, so the policy has no approval switch.
-- A request that waited for approval simply waits for distribution. Permissions are not changed here: approve_request, reject_request and the permission to generate stay in the
-- catalog and in the permission sets until an administrator removes them with an electronic signature (a security change).
-- Forward-only, idempotent.
ALTER TABLE uncontrolled_copy_policy_settings DROP COLUMN IF EXISTS approval_required;
