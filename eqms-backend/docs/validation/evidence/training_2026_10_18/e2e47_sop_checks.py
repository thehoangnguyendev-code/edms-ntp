"""DEV: the points of SOP.0003 that were checked and changed on 2026-10-27. 5.3.7 the results go to QA within working days (the number and the way of counting are settings of Training Properties);
5.3.6 for a new or revised document the attendance list goes to QA on the day the training is held; 5.3.2 the requirement for the SOPs after the periodic review is due on the last day of the month
of the review; 5.3.1 the matrix of the senior management positions is built by QA; 5.3.8 and the matrix completion for all employees, with or without a Work Position. The password comes from DEVPW.
The settings are put back at the end; the test data (job role, requirements) is never deleted."""
import os, sys, subprocess, time, datetime
sys.path.insert(0, os.path.dirname(__file__))
from api import Client
from e2e21_matrix import admin, check, attempt, results

RA = '23111111-1111-1111-1111-111111111113'
ME = '22111111-1111-1111-1111-111111111111'
ALL = '00000000-0000-0000-0000-000000000001'
stamp = str(int(time.time()))[-6:]


def sql(q):
    return subprocess.run(['docker', 'exec', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-Atc', q], capture_output=True, text=True).stdout.strip()


def add_days(start, days, kind):
    day = start
    while days > 0:
        day += datetime.timedelta(days=1)
        wd = day.weekday()
        if kind == 'CALENDAR' or wd < 5 or (kind == 'WORKING_MON_SAT' and wd == 5):
            days -= 1
    return day


def set_type(kind):
    cur = admin.call('GET', '/training/settings')
    code, d, raw = attempt(admin, 'PUT', '/training/settings', {'version': cur['version'], 'resultsDueDayType': kind, 'reason': 'E2E-TEST day type'})
    return code, d, raw


print('== 1. the days to send the results to QA (5.3.7)')
cur = admin.call('GET', '/training/settings')
check('1.1 the setting says how the days are counted, working days Monday to Friday by default', cur['resultsDueDayType'] in ('WORKING_MON_FRI', 'WORKING_MON_SAT', 'CALENDAR') and cur['resultsDueDays'] >= 1, cur)
original = cur['resultsDueDayType']
code, d, raw = attempt(admin, 'PUT', '/training/settings', {'version': cur['version'], 'resultsDueDayType': 'WEEKLY', 'reason': 'E2E-TEST bad'})
check('1.2 a way that does not exist is refused (400)', code == 400, (code, raw))
held = sql("select a.id || '|' || max(s.held_on) from training_activities a join training_sessions s on s.activity_id = a.id and s.status = 'PLANNED' and s.held_on is not null where a.status in ('PENDING_QA_CONFIRMATION','COMPLETED','IN_PROGRESS') group by a.id order by max(s.held_on) desc limit 1")
aid, held_on = held.split('|')
held_date = datetime.date.fromisoformat(held_on)
for kind in ('CALENDAR', 'WORKING_MON_SAT', 'WORKING_MON_FRI'):
    code, d, raw = set_type(kind) if cur['resultsDueDayType'] != kind else (200, cur, '')
    act = admin.call('GET', f'/training/activities/{aid}')
    expected = add_days(held_date, act['resultsToQa']['days'], kind).isoformat()
    check(f'1.3 the day the results are due follows the way of counting ({kind})', code == 200 and act['resultsToQa']['dueOn'] == expected and act['resultsToQa']['dayType'] == kind, (code, act['resultsToQa'], expected))
    cur = admin.call('GET', '/training/settings')

print('== 2. the attendance list of a new or revised document (5.3.6)')
doc_id = sql("select id from training_activities where document_id is not null and kind_reason in ('NEW_SOP','SOP_VERSION') and status = 'COMPLETED' order by created_at desc limit 1")
doc = admin.call('GET', f'/training/activities/{doc_id}')
held_doc = sql(f"select max(held_on) from training_sessions where activity_id = '{doc['id']}' and status = 'PLANNED'")
check('2.1 for a document training the list is due on the day the training is held', doc['qaList']['dueOn'] == held_doc and doc['qaList']['state'] in ('SENT', 'SENT_LATE'), doc.get('qaList'))
ord_id = sql("select id from training_activities where document_id is null and status = 'COMPLETED' order by created_at desc limit 1")
ordinary = admin.call('GET', f'/training/activities/{ord_id}')
check('2.2 an ordinary training has no such rule', ordinary.get('qaList') is None, ordinary.get('qaList'))

print('== 3. the requirement for the SOPs after the periodic review (5.3.2)')
code, req, raw = attempt(admin, 'POST', '/training/requirements', {'year': 2026, 'kind': 'SOP_PERIODIC', 'reviewCompletedOn': '2026-10-12'})
check('3.1 it is due on the last day of the month of the review', code == 200 and req['dueBy'] == '2026-10-31', raw)
code, d, raw = attempt(admin, 'POST', '/training/requirements', {'year': 2026, 'kind': 'SOP_PERIODIC'})
check('3.2 the date of the review is needed (400)', code == 400 and 'TRAINING_REVIEW_DATE_REQUIRED' in raw, (code, raw))
code, ann, raw = attempt(admin, 'POST', '/training/requirements', {'year': 2027, 'kind': 'ANNUAL'})
check('3.3 the annual requirement keeps the due date of Training Properties', code == 200 and ann['dueBy'].endswith(f"-{cur['annualRequirementDueMonth']:02d}-{cur['annualRequirementDueDay']:02d}"), (code, ann.get('dueBy') if code == 200 else raw))

print('== 4. the matrix of the senior management is built by QA (5.3.1)')
code, role, raw = attempt(admin, 'POST', '/training/job-roles', {'code': f'E2E-SR{stamp}', 'name': f'E2E-TEST senior {stamp}', 'departmentId': RA, 'seniorManagement': True})
check('4.1 a Work Position is marked as a senior management position', code == 200 and role.get('seniorManagement') is True, raw)
cur_role = admin.call('GET', f"/training/job-roles/{role['id']}")
code, d, raw = attempt(admin, 'PUT', f"/training/job-roles/{role['id']}", {'name': role['name'], 'active': True, 'version': cur_role['version']})
check('4.2 Activate or Deactivate keeps the flag', code == 200 and d.get('seniorManagement') is True, raw)
ver = sql("select v.id from training_matrix_versions v join training_matrices m on m.id = v.matrix_id where m.department_id = '%s' and v.status = 'DRAFT' limit 1" % RA)
v = admin.call('GET', f'/training/matrix-versions/{ver}')
topic = {'name': 'E2E-TEST topic of the senior management column'}
rows = [{'group': r['rowGroup'], 'topicText': r.get('topicText'), 'documentId': r.get('documentId'), 'annualRequired': r['annualRequired'], 'note': r.get('note'), 'positionIds': r['positionIds'], 'allEmployees': bool(r.get('allEmployees'))} for r in v['rows']]
if not any(r['topicText'] == topic['name'] for r in rows):
    rows.append({'group': 'SOP', 'topicText': topic['name'], 'documentId': None, 'annualRequired': False, 'note': None, 'positionIds': [], 'allEmployees': False})
withsenior = [dict(r, positionIds=list(set(r['positionIds'] + [role['id']]))) if r['topicText'] == topic['name'] else r for r in rows]
code, saved, raw = attempt(admin, 'PUT', f'/training/matrix-versions/{ver}', {'version': v['version'], 'changeReason': 'E2E-TEST', 'rows': withsenior})
check('4.3 QA (Training Administration) ticks the column of the senior management position', code == 200 and any(role['id'] in r['positionIds'] for r in saved.get('rows', []) if r.get('topicText') == topic['name']), raw)
positions = {p['id']: p for p in saved['positions']}
check('4.4 the matrix says which columns are senior management', positions[role['id']].get('seniorManagement') is True, positions.get(role['id']))
non_qa = None
for name in ('author.test1', 'user.b.test', 'dco.test1', 'reviewer.test1', 'user.c.test', 'user.d.test', 'coauthor.test1'):
    try:
        c = Client(name)
    except SystemExit:
        continue
    code1, role_try, _ = attempt(c, 'POST', '/training/job-roles', {'code': f'E2E-X{name[-3:]}{stamp}', 'name': 'x', 'departmentId': RA})
    code2, vv, _ = attempt(c, 'GET', f'/training/matrix-versions/{ver}')
    if code1 in (401, 403) and code2 == 200 and vv.get('capabilities', {}).get('edit'):
        non_qa = c
        break
if non_qa:
    cur_v = non_qa.call('GET', f'/training/matrix-versions/{ver}')
    changed = [dict(r, positionIds=[p for p in r['positionIds'] if p != role['id']]) if r['topicText'] == topic['name'] else r for r in [{'group': x['rowGroup'], 'topicText': x.get('topicText'), 'documentId': x.get('documentId'), 'annualRequired': x['annualRequired'], 'note': x.get('note'), 'positionIds': x['positionIds'], 'allEmployees': bool(x.get('allEmployees'))} for x in cur_v['rows']]]
    code, d, raw = attempt(non_qa, 'PUT', f'/training/matrix-versions/{ver}', {'version': cur_v['version'], 'changeReason': 'E2E-TEST', 'rows': changed})
    check('4.5 a head of department who may edit the matrix but is not QA cannot change that column (403)', code == 403 and 'TRAINING_MATRIX_SENIOR_QA_ONLY' in raw, (code, raw))
    unchanged = [{'group': x['rowGroup'], 'topicText': x.get('topicText'), 'documentId': x.get('documentId'), 'annualRequired': x['annualRequired'], 'note': x.get('note'), 'positionIds': x['positionIds'], 'allEmployees': bool(x.get('allEmployees'))} for x in cur_v['rows']]
    code, d, raw = attempt(non_qa, 'PUT', f'/training/matrix-versions/{ver}', {'version': cur_v['version'], 'changeReason': 'E2E-TEST', 'rows': unchanged})
    check('4.6 the same person can save the other columns', code == 200, (code, raw))
else:
    print('NOTE: no test account can edit the matrix without being QA: 4.5 and 4.6 were NOT checked')

print('== 5. the matrix completion for all employees (5.3.8)')
pos = admin.call('GET', f'/training/compliance/positions?departmentId={ME}')
check('5.1 the first choice is All employees, with the rows for all employees and every employee of the department', pos and pos[0]['id'] == ALL and pos[0]['rowCount'] >= 1 and pos[0]['peopleCount'] >= 2, pos[:1])
comp = admin.call('GET', f'/training/compliance/matrix-completion?departmentId={ME}&positionId={ALL}&limit=100')
people = comp['data']
without_role = [p for p in people if not sql(f"select 1 from training_person_positions where person_user_id = '{p['personId']}' and valid_to is null limit 1")]
check('5.2 the grid of All employees lists the people who hold no Work Position, with the row for all employees', comp['hasEffectiveMatrix'] and len(people) >= 2 and len(without_role) >= 1 and len(comp['columns']) >= 1, (len(people), len(without_role)))
print(sum(1 for r in results if r[1]), 'of', len(results), 'checks passed')
