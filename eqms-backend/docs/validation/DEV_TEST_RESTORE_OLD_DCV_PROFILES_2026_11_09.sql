-- DEV only. Puts back what DEV_TEST_UNASSIGN_OLD_DCV_PROFILES_2026_11_09.sql took off. Restart the backend afterwards.
INSERT INTO user_access_profiles (user_id, access_profile_id, assigned_at)
SELECT u.id, r.id, now() FROM app_users u JOIN roles r ON
  ((u.username IN ('dcv.u1','dcv.u2','dcv.u3') AND r.code = 'DCV_CONTRIBUTOR') OR (u.username = 'dcv.approver' AND r.code = 'DCV_UC_APPROVER'))
WHERE NOT EXISTS (SELECT 1 FROM user_access_profiles x WHERE x.user_id = u.id AND x.access_profile_id = r.id);
