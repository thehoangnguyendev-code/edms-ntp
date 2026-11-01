"""Phase 0a (DEV only): the test accounts of the UAT run of 2026-10-31 (people31.py). Idempotent. The accounts copy the password hash of admin (the shared DEV test password); the run harness
(run31.sh) sets a random password for the run and puts the hash back. Profiles: the existing DEV test profiles TRAINING_TRAINEE_DEV_TEST and TRAINING_TRAINER_DEV_TEST (a head of department holds the trainer set).
Plain python, no password needed."""
import subprocess, sys
sys.stdout.reconfigure(encoding='utf-8')
from people31 import PEOPLE

rows = []
for i, (u, (name, dept, title, story, profile)) in enumerate(PEOPLE.items(), start=1):
    rows.append("('%s','%s','%s','%s','%s','UAT31-%03d')" % (u, name.replace("'", "''"), dept, title, profile, i))
sql = """
BEGIN;
INSERT INTO app_users (id, username, email, full_name, password_hash, role_name, department, position, status, employee_code, business_unit, start_date, created_at, updated_at,
                       password_changed_at, mfa_email_fallback_enabled, mfa_remember_device_enabled)
SELECT gen_random_uuid(), v.username, v.username || '@example.local', v.full_name, (SELECT password_hash FROM app_users WHERE username = 'admin'), 'ACCESS_PROFILE_MANAGED',
       v.dept, v.title, 'Active', v.code, 'Quality Unit', DATE '2025-03-03', now(), now(), now(), FALSE, FALSE
FROM (VALUES %s) AS v(username, full_name, dept, title, profile, code)
WHERE NOT EXISTS (SELECT 1 FROM app_users u WHERE u.username = v.username);
INSERT INTO user_access_profiles (user_id, access_profile_id, assigned_at)
SELECT u.id, r.id, now() FROM app_users u
  JOIN (VALUES %s) AS v(username, full_name, dept, title, profile, code) ON v.username = u.username
  JOIN roles r ON r.code = CASE v.profile WHEN 'TRAINER' THEN 'TRAINING_TRAINER_DEV_TEST' ELSE 'TRAINING_TRAINEE_DEV_TEST' END
 WHERE NOT EXISTS (SELECT 1 FROM user_access_profiles x WHERE x.user_id = u.id AND x.access_profile_id = r.id);
COMMIT;
SELECT department, count(*) FROM app_users WHERE username LIKE 'uat31.%%' GROUP BY 1 ORDER BY 1;
""" % (',\n'.join(rows), ',\n'.join(rows))
r = subprocess.run(['docker', 'exec', '-i', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-v', 'ON_ERROR_STOP=1'], input=sql.encode('utf-8'), capture_output=True)
print(r.stdout.decode('utf-8', 'ignore'))
print(r.stderr.decode('utf-8', 'ignore')[-600:])
sys.exit(r.returncode)
