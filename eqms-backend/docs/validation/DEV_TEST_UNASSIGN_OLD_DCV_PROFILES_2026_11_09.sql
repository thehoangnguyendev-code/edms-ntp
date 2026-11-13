-- DEV only. Before giving the 4 flow test accounts their role profiles (Author/Co-Author/Reviewer/Approver), take off the old catch-all
-- test profiles: they hold submit+review+approve together and the Segregation of Duties check (correctly) blocks the new profile.
-- To put back: DEV_TEST_RESTORE_OLD_DCV_PROFILES_2026_11_09.sql. Restart the backend afterwards (permissions are cached).
DELETE FROM user_access_profiles x USING app_users u, roles r
WHERE x.user_id = u.id AND x.access_profile_id = r.id
  AND ((u.username IN ('dcv.u1','dcv.u2','dcv.u3') AND r.code = 'DCV_CONTRIBUTOR') OR (u.username = 'dcv.approver' AND r.code = 'DCV_UC_APPROVER'));
