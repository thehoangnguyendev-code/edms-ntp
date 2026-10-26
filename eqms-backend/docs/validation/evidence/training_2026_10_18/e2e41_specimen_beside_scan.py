"""DEV: the specimen signature in force of a person can be looked up beside a scan (FRM.0007, SOP.0003 5.3.9): found with the number of images; an empty answer for a person who has none; refused for a person
without the permission who is not that person; looking it up writes nothing to the Audit Trail (only the opening of an image does). The password comes from DEVPW."""
import os, sys, subprocess
sys.path.insert(0, os.path.dirname(__file__))
from api import Client
from e2e21_matrix import admin, check, results, attempt


def sql(q):
    return subprocess.run(['docker', 'exec', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-Atc', q], capture_output=True, text=True).stdout.strip()


pid = sql("select person_user_id from training_specimen_signatures where status='APPROVED' limit 1")
none = sql("select id from app_users u where status='Active' and not exists (select 1 from training_specimen_signatures s where s.person_user_id=u.id and s.status='APPROVED') limit 1")
code, data, raw = attempt(admin, 'GET', f'/training/specimen-signatures/person/{pid}/current')
check('1 the specimen signature in force of a person is found, with the number of images', code == 200 and data.get('id') and data.get('hasSecond') is not None and data.get('versionNo'), raw)
code, data, raw = attempt(admin, 'GET', f'/training/specimen-signatures/person/{none}/current')
check('2 a person without an approved specimen gives an empty answer', code == 200 and data == {}, raw)
code, data2, raw = attempt(Client('trainee.test1'), 'GET', f'/training/specimen-signatures/person/{pid}/current')
check('3 a person without the permission, who is not that person, is refused', code in (401, 403), (code, raw))
before = int(sql("select count(*) from audit_logs where action='TRAINING_SPECIMEN_VIEWED'") or 0)
attempt(admin, 'GET', f'/training/specimen-signatures/person/{pid}/current')
after = int(sql("select count(*) from audit_logs where action='TRAINING_SPECIMEN_VIEWED'") or 0)
check('4 only the opening of an image is in the Audit Trail, not the look at the current one', after == before, (before, after))
# the work position of Training in the profile (read only; the Position of the user record is not changed)
holder = sql("select person_user_id from training_person_positions where valid_to is null limit 1")
without = sql("select id from app_users u where status='Active' and not exists (select 1 from training_person_positions tp where tp.person_user_id=u.id and tp.valid_to is null) limit 1")
position_before = sql(f"select position from app_users where id='{holder}'")
code, data, raw = attempt(admin, 'GET', f'/training/job-assignments/work-position/{holder}')
check('5 the work position of Training of a person is given (name, where it came from)', code == 200 and data.get('positionName') and data.get('source'), raw)
code, data, raw = attempt(admin, 'GET', f'/training/job-assignments/work-position/{without}')
check('6 a person without one gives an empty answer', code == 200 and data == {}, raw)
code, data, raw = attempt(Client('trainee.test1'), 'GET', f'/training/job-assignments/work-position/{holder}')
check('7 someone without the permission, who is not that person, is refused', code in (401, 403), (code, raw))
check('8 the Position of the user record is not touched', sql(f"select position from app_users where id='{holder}'") == position_before, position_before)
print(sum(1 for r in results if r[1]), 'of', len(results), 'checks passed')
