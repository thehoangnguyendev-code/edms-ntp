"""Part 7d: the counter of the Training Numbers raised by the Administrator, the rule "a number belongs to one activity" in the database, the department scope of the importer (D5), and a
native document that requires training (the regression of the number counter that was changed)."""
from flows31 import *
import subprocess, urllib.request, urllib.error
from lib7 import *

state = load()
qa = sql("select id from departments where name = 'Quality Assurance'")[0][0]

step('F-43 the Administrator raises the counter of the Training Numbers')
before = admin.call('GET', '/training/settings/number-counters?limit=50')
row = [r for r in before['data'] if r['departmentId'] == qa and r['year'] == 2026]
check('F-43.1 the counters are listed with the number that comes next', row and row[0]['nextNumber'].startswith('TRN/QA/26-'), before['data'][:2])
last = int(row[0]['lastSerial'])
target = last + 25
code, data, text = attempt(admin, 'POST', '/training/settings/number-counters/raise', {'departmentId': qa, 'year': 2026, 'lastSerial': target, 'reason': 'UAT7 go-live: the paper log ends at ' + str(target)})
check('F-43.2 the counter is raised', code == 200, (code, text[:200]))
now = int(sql(f"select last_serial from training_number_sequences where department_id = '{qa}' and year = 2026")[0][0])
check('F-43.3 the stored serial is the one entered', now == target, now)
code, data, text = attempt(admin, 'POST', '/training/settings/number-counters/raise', {'departmentId': qa, 'year': 2026, 'lastSerial': target - 5, 'reason': 'lower'})
check('F-43.4 a counter cannot go down', code == 409 and 'TRAINING_NUMBER_COUNTER_CAN_ONLY_RISE' in text, (code, text[:200]))
code, data, text = attempt(admin, 'POST', '/training/settings/number-counters/raise', {'departmentId': qa, 'year': 2026, 'lastSerial': target + 1, 'reason': ' '})
check('F-43.5 a reason is required', code == 400, (code, text[:200]))
code, data, text = attempt(admin, 'POST', '/training/settings/number-counters/raise', {'departmentId': qa, 'year': 1990, 'lastSerial': 5, 'reason': 'x'})
check('F-43.6 a year that is not possible is refused', code == 400, (code, text[:200]))
audit_rows = int(sql("select count(*) from audit_logs where action = 'TRAINING_NUMBER_COUNTER_RAISED'")[0][0])
check('F-43.7 the change is in the Audit Trail', audit_rows >= 1, audit_rows)
other = U('dco.lead2')
code, data, text = attempt(other, 'POST', '/training/settings/number-counters/raise', {'departmentId': qa, 'year': 2026, 'lastSerial': target + 50, 'reason': 'not allowed'})
check('F-43.8 a person without the settings permission cannot raise it', code in (401, 403), (code, text[:160]))

step('F-44 a native document that requires training still gets the next number')
doc = {'documentName': 'UAT7 native training doc', 'documentType': type_id, 'author': admin_id, 'businessUnit': bu_id, 'department': qa, 'language': 'English', 'requiresTraining': True,
       'trainingPeriodDays': 10, 'reviewerUserIds': [], 'approverUserIds': [], 'relatedDocumentIds': [], 'correlatedDocumentIds': [], 'periodicReviewCycle': 12, 'periodicReviewNotification': 30}
code, data, text = attempt(admin, 'POST', '/documents', doc)
check('F-44.1 the draft is created', code == 200, (code, text[:300]))
if code == 200:
    issued = sql(f"select training_number from training_activities where document_id = '{data['id']}'")
    check('F-44.2 its activity got a number after the raised counter', issued and int(issued[0][0].split('-')[-1]) > target, issued)

step('F-45 the rule of the database: a number belongs to one activity')
act_number = sql("select training_number from training_activities where kind = 'LEGACY' order by created_at desc limit 1")[0][0]
script = f"""BEGIN;
update document_revisions set training_number = '{act_number}', training_activity_id = null where id = (select id from document_revisions where training_origin = 'NATIVE' and training_number is null limit 1);
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;"""
res = subprocess.run(['docker', 'exec', '-i', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database'], input=script, capture_output=True, text=True, encoding='utf-8')
check('F-45.1 a revision that carries the number of an activity without pointing to it is refused', 'belongs to a training activity' in (res.stderr + res.stdout), (res.stderr + res.stdout)[:300])
script = f"""BEGIN;
insert into training_activities(id, training_number, base_number, organizer_department_id, year, serial, kind, status)
 select gen_random_uuid(), r.training_number, r.training_number, a.organizer_department_id, 2026, 0, 'LEGACY', 'COMPLETED'
   from document_revisions r, training_activities a where r.training_number = '{act_number}' limit 1;
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;"""
res = subprocess.run(['docker', 'exec', '-i', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database'], input=script, capture_output=True, text=True, encoding='utf-8')
check('F-45.2 the same number cannot be given to a second activity (unique)', 'duplicate key' in (res.stderr + res.stdout) or 'violates' in (res.stderr + res.stdout), (res.stderr + res.stdout)[:300])

step('F-46 the importer imports into the own department only (D5)')
importer = U('dco.lead2')
own = importer.user.get('department')
refused_code, _, refused_text = do_import(free_number(), 'UAT7 scope other department', [section(number=None, scan=False, paper=False)], [], department=qa, requires_training=False, client=importer)
check('F-46.1 a person without the scope of all departments is refused for another department', refused_code in (400, 403) and 'own department' in refused_text, (refused_code, refused_text[:220]))
check('F-46.2 nothing was created for it', int(sql("select count(*) from documents where document_name = 'UAT7 scope other department'")[0][0]) == 0, '')
own_id = sql(f"select id from departments where name = '{own}'")[0][0]
own_code, _, own_text = do_import(free_number(), 'UAT7 scope own department', [section(number=None, scan=False, paper=False)], [], department=own_id, requires_training=False, client=importer)
check('F-46.3 for the own department the scope does not refuse (any other answer is a different rule)', 'own department' not in own_text, (own_code, own_text[:220]))
admin_code, _, admin_text = do_import(free_number(), 'UAT7 scope admin other department', [section(number=None, scan=False, paper=False)], [], department=own_id, requires_training=False)
check('F-46.4 a person with the scope of all departments imports into any department', 'own department' not in admin_text, (admin_code, admin_text[:220]))
finish('p7d')
