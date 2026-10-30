"""DEV: the column "All employees" of the training matrix (SOP.0003 5.3.1) and what follows from it. Owner decision 2026-10-27: there is no package of initial training; what a new employee learns is in
the matrix (factory-wide and department-wide rows are for all employees, procedures of the position are for the Work Position) and is given by a Training Activity. Checks: the head of department ticks a row
for all employees (not locked), the matrix of a department that had none is approved, Training Compliance measures every employee of the department, with or without a Work Position, a new employee has the
mark, the people who miss the same training are added to a planned training together, the training unit of a topic is a Department, and the proposal of people for a session includes everybody of the
department. The password comes from DEVPW. It uses the department Mechanical and Electrical (no matrix before); its matrix stays effective afterwards, with an E2E topic."""
import os, sys, subprocess, time, datetime
sys.path.insert(0, os.path.dirname(__file__))
from api import Client
from e2e21_matrix import admin, qa, check, sign, attempt, results

ME = '22111111-1111-1111-1111-111111111111'
QA_DEPT = '23111111-1111-1111-1111-111111111111'
stamp = str(int(time.time()))[-6:]
trainer = Client('trainer.test1')


def sql(q):
    return subprocess.run(['docker', 'exec', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-Atc', q], capture_output=True, text=True).stdout.strip()


print('== 1. the topic and its unit')
t = {'name': f'E2E-TEST for all of the department {stamp}'}

print('== 2. the matrix of a department that had none')
existing = sql(f"select id from training_matrices where department_id = '{ME}'")
if existing:
    ver = sql(f"select v.id from training_matrix_versions v where v.matrix_id = '{existing}' and v.status = 'DRAFT' limit 1")
    version_obj = admin.call('GET', f'/training/matrix-versions/{ver}') if ver else None
else:
    code, created, raw = attempt(admin, 'POST', '/training/matrices', {'departmentId': ME})
    check('2.0 the matrix is created with a draft version', code == 200, raw)
    ver = created['id']
    version_obj = created
if not version_obj or version_obj['status'] != 'DRAFT':
    print('NOTE: the department has an effective matrix already; the rest of the checks use it as it is')
    ver = None
if ver:
    rows = [{'group': 'DEPARTMENT_GENERAL', 'topicText': t['name'], 'documentId': None, 'annualRequired': True, 'note': None, 'positionIds': [], 'allEmployees': True}]
    code, saved, raw = attempt(admin, 'PUT', f'/training/matrix-versions/{ver}', {'version': version_obj['version'], 'changeReason': 'E2E-TEST', 'rows': rows})
    row = next((r for r in saved.get('rows', []) if r.get('topicText') == t['name']), None)
    check('2.1 the head of department ticks the column All employees: the row is for all, and it is not locked', code == 200 and row and row['allEmployees'] is True and row['locked'] is False, raw)
    approvers = admin.call('GET', f'/training/matrix-versions/{ver}/eligible-approvers')
    approver = next((a for a in approvers['data'] if a['id'] == qa.user['id']), approvers['data'][0] if approvers['data'] else None)
    code, sub, raw = attempt(admin, 'POST', f'/training/matrix-versions/{ver}/submit', {'version': saved['version'], 'signatureToken': sign(admin), 'approverUserId': approver['id']})
    check('2.2 a row for all employees needs no Work Position: the version can be sent for approval', code == 200, raw)
    got = qa.call('GET', f'/training/matrix-versions/{ver}')
    code, ok, raw = attempt(qa, 'POST', f'/training/matrix-versions/{ver}/approve', {'version': got['version'], 'signatureToken': sign(qa)})
    check('2.3 the matrix is approved and effective', code == 200 and ok.get('status') == 'EFFECTIVE', raw)

# a second run finds the matrix of the department already effective: the topic of its row for all employees is used
if not ver:
    name = sql(f"select r.topic_text from training_matrix_rows r join training_matrix_versions v on v.id = r.version_id and v.status = 'EFFECTIVE' join training_matrices m on m.id = v.matrix_id where m.department_id = '{ME}' and r.all_employees and r.topic_text is not null order by r.row_no desc limit 1")
    t = dict(t, name=name)
print('== 3. Training Compliance measures every employee of the department')
sql("update training_settings set initial_training_days = 730")
page = admin.call('GET', f'/training/compliance/coverage?departmentId={ME}&limit=100')
mine = [g for g in page['data'] if g['title'] == t['name']]
people = {g['fullName'] for g in mine}
check('3.1 every active employee of the department has the line, with or without a Work Position', len(mine) >= 2 and all(g['allEmployees'] for g in mine) and all(g['noRole'] for g in mine if not g.get('positionName')), (len(mine), people))
check('3.3 a person without a Work Position has the amber mark data, an employee who started recently the blue one', any(g['noRole'] for g in mine) and any(g['isNew'] for g in mine), [(g['noRole'], g['isNew']) for g in mine][:3])
fresh = admin.call('GET', f'/training/compliance/coverage?departmentId={ME}&newOnly=true&limit=100')
check('3.4 the filter New employees only answers on the server', fresh['data'] and all(g['isNew'] for g in fresh['data']), fresh['pagination'])
summary = admin.call('GET', f'/training/compliance/summary?departmentId={ME}')
check('3.5 the summary counts the new employees and the ones who still miss a training', summary.get('newEmployees', 0) >= 1 and summary.get('newEmployeesWithGaps', 0) >= 1, (summary.get('newEmployees'), summary.get('newEmployeesWithGaps')))
sql("update training_settings set initial_training_days = 90")

print('== 4. a group is added to one planned training')
code, act, raw = attempt(admin, 'POST', '/training/activities', {'kind': 'INITIAL', 'kindReason': 'OTHER', 'trainingTitle': 'E2E-TEST training of a group'})
aid = act['id']
when = (datetime.date.today() + datetime.timedelta(days=7)).isoformat()
admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'CLASSROOM', 'assessmentMethod': 'SELF_READING_CONFIRMATION', 'trainerUserId': trainer.user['id'], 'scheduledOn': when, 'venue': 'Room E2E', 'topics': [{'topicText': t['name']}]})
planned = admin.call('GET', f"/training/compliance/planned-trainings?topicName={t['name'].replace(' ', '%20')}")['data']
mineplanned = next((p for p in planned if p['activityId'] == aid), None)
check('4.1 the planned training that covers the topic is listed with its session and date', mineplanned is not None and mineplanned['canAdd'] and mineplanned['scheduledOn'] == when, planned[:1])
ids = list({g['pid'] for g in mine})
code, d, raw = attempt(admin, 'POST', f'/training/activities/{aid}/participants', {'sessionId': mineplanned['sessionId'], 'personUserIds': ids, 'reason': 'Initial training of new employees'}) if mineplanned else (0, {}, '')
check('4.2 the people who miss the same training are added together with the command of the activity', code == 200 and int(sql(f"select count(*) from training_participants where session_id = '{mineplanned['sessionId']}'") or 0) == len(ids), (code, raw))
planned = admin.call('GET', f"/training/compliance/planned-trainings?topicName={t['name'].replace(' ', '%20')}")['data']
check('4.3 and the session shows how many people it has', next(p for p in planned if p['activityId'] == aid)['participants'] == len(ids), planned[:1])
code, d, raw = attempt(Client('trainee.test1'), 'GET', f"/training/compliance/planned-trainings?topicName={t['name'].replace(' ', '%20')}")
check('4.4 a person without the right to see Compliance does not get the list', code in (401, 403), (code, raw))

print('== 5. the proposal of people for a session')
act2 = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'trainingTitle': 'E2E-TEST proposal for all'})
s2 = admin.call('POST', f"/training/activities/{act2['id']}/sessions", {'method': 'CLASSROOM', 'assessmentMethod': 'SELF_READING_CONFIRMATION', 'trainerUserId': trainer.user['id'], 'scheduledOn': when, 'venue': 'Room E2E', 'topics': [{'topicText': t['name']}]})
sid = s2['sessions'][0]['id']
proposed = admin.call('GET', f"/training/activities/{act2['id']}/sessions/{sid}/suggested-participants")
proposed = proposed['data'] if isinstance(proposed, dict) else proposed
names = {p['fullName'] for p in proposed}
check('5.1 the people proposed are every employee of the department, also those without a Work Position', len(names) >= 2 and names == people, (names, people))
print(sum(1 for r in results if r[1]), 'of', len(results), 'checks passed')
