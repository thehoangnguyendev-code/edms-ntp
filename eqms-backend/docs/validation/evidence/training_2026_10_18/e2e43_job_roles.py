"""DEV: Job Roles of Training (SOP.0003 5.2 and 5.3.8). The Position of a person is the title; a Job Role is a duty under a department, the column of the training matrix, and what a job
assignment (APD.0024) gives. Checks: the roles made from the positions, creating and changing a Job Role and its rules, a person who may not manage them, several Job Roles held at the same
time (initial, additional, change), the guard of a role that someone holds, the menu actions of the lists decided by the server, and that a role can no longer be given by hand.
The password comes from DEVPW. The records are named "E2E-TEST"; a job assignment that is accepted stays (it is never changed)."""
import os, sys, subprocess, time
sys.path.insert(0, os.path.dirname(__file__))
from api import Client
from e2e21_matrix import admin, check, sign, attempt, results

QA_DEPT = '23111111-1111-1111-1111-111111111111'
stamp = str(int(time.time()))[-6:]
trainee = Client('trainee.test2')
person = trainee.user['id']


def sql(q):
    return subprocess.run(['docker', 'exec', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-Atc', q], capture_output=True, text=True).stdout.strip()


# an open draft left by an earlier run would block the new ones: it is cancelled (it stays as history)
for row in admin.call('GET', f'/training/job-assignments?personId={person}&limit=100')['data']:
    if row['status'] in ('DRAFT', 'PENDING_RECEIVER'):
        got = admin.call('GET', f"/training/job-assignments/{row['id']}")
        attempt(admin, 'POST', f"/training/job-assignments/{row['id']}/cancel", {'version': got['version'], 'reason': 'E2E-TEST cleanup'})
print('== 1. the Job Roles')
page = admin.call('GET', '/training/job-roles?limit=100')
check('1.1 the positions of the departments became Job Roles', page['pagination']['total'] >= 12 and all('holders' in r for r in page['data']), page['pagination'])
code, a, raw = attempt(admin, 'POST', '/training/job-roles', {'code': f'E2E-JR-A{stamp}', 'name': f'E2E-TEST Role A {stamp}', 'departmentId': QA_DEPT, 'jurisdiction': 'E2E-TEST jurisdiction of A'})
check('1.2 a Job Role is created in a department', code == 200 and a.get('active') and a.get('departmentId') == QA_DEPT, raw)
code, d, raw = attempt(admin, 'POST', '/training/job-roles', {'code': f'e2e-jr-a{stamp}', 'name': 'E2E-TEST other name', 'departmentId': QA_DEPT})
check('1.3 the code is unique whatever the case (409)', code == 409 and 'TRAINING_JOB_ROLE_CODE_USED' in raw, (code, raw))
code, d, raw = attempt(admin, 'POST', '/training/job-roles', {'code': f'E2E-JR-X{stamp}', 'name': f'e2e-test role a {stamp}', 'departmentId': QA_DEPT})
check('1.4 the name is unique in the department (409)', code == 409 and 'TRAINING_JOB_ROLE_NAME_USED' in raw, (code, raw))
code, d, raw = attempt(admin, 'POST', '/training/job-roles', {'code': 'bad code!', 'name': 'x', 'departmentId': QA_DEPT})
check('1.5 a code with other characters is refused (400)', code == 400, (code, raw))
code, d, raw = attempt(trainee, 'POST', '/training/job-roles', {'code': f'E2E-JR-T{stamp}', 'name': 'E2E-TEST by trainee', 'departmentId': QA_DEPT})
check('1.6 a person without the right to administer Training cannot create one', code in (401, 403), (code, raw))
code, b, raw = attempt(admin, 'POST', '/training/job-roles', {'code': f'E2E-JR-B{stamp}', 'name': f'E2E-TEST Role B {stamp}', 'departmentId': QA_DEPT})
code2, c, raw2 = attempt(admin, 'POST', '/training/job-roles', {'code': f'E2E-JR-C{stamp}', 'name': f'E2E-TEST Role C {stamp}', 'departmentId': QA_DEPT})
code3, e, raw3 = attempt(admin, 'POST', '/training/job-roles', {'code': f'E2E-JR-D{stamp}', 'name': f'E2E-TEST Role D {stamp}', 'departmentId': QA_DEPT})
code, d, raw = attempt(admin, 'PUT', f"/training/job-roles/{a['id']}", {'name': a['name'], 'version': a['version'] + 5})
check('1.7 a change on an old version is refused (409)', code == 409, (code, raw))
opts = admin.call('GET', f'/training/job-roles/options?departmentId={QA_DEPT}')['data']
check('1.8 the options of a department list the active Job Roles', any(o['id'] == a['id'] for o in opts), len(opts))

print('== 2. several Job Roles at the same time')


def assign(role, **extra):
    body = {'personUserId': person, 'positionId': role['id'], 'duties': [{'responsibility': 'E2E-TEST responsibility', 'description': 'E2E-TEST work'}]}
    body.update(extra)
    return attempt(admin, 'POST', '/training/job-assignments', body)


def make_effective(draft):
    got = admin.call('GET', f"/training/job-assignments/{draft['id']}")
    code, sub, raw = attempt(admin, 'POST', f"/training/job-assignments/{draft['id']}/submit", {'version': got['version'], 'signatureToken': sign(admin)})
    if code != 200:
        return code, raw
    got = trainee.call('GET', f"/training/job-assignments/{draft['id']}")
    code, acc, raw = attempt(trainee, 'POST', f"/training/job-assignments/{draft['id']}/accept", {'version': got['version'], 'signatureToken': sign(trainee)})
    return code, acc.get('status') if code == 200 else raw


before = int(sql(f"select count(*) from training_job_assignments where person_user_id='{person}' and status='EFFECTIVE'") or 0)
code, ja, raw = assign(a) if before == 0 else assign(a, mode='ADDITIONAL', changeReason='E2E-TEST an additional duty')
check('2.1 the first Job Role of a person is an initial assignment (an additional one when the person already holds some), with the jurisdiction of the role', code == 200 and ja.get('caseType') == ('INITIAL' if before == 0 else 'ADDITIONAL') and 'jurisdiction of A' in str(ja.get('jurisdiction')), raw)
res = make_effective(ja)
check('2.2 signed by both people it becomes effective', res == (200, 'EFFECTIVE'), res)
roles = sql(f"select string_agg(position_id::text, ',') from training_person_positions where person_user_id='{person}' and valid_to is null and source='JOB_ASSIGNMENT'")
check('2.3 the person holds the role for the matrix', a['id'] in (roles or ''), roles)
code, d, raw = assign(a)
check('2.4 the same role again is refused', code == 400 and 'TRAINING_JOB_SAME_POSITION' in raw, (code, raw))
code, d, raw = assign(b)
check('2.5 with one role held a change without a reason is refused; with several the way must be said', code == 400 and ('TRAINING_REASON_REQUIRED' if before == 0 else 'TRAINING_JOB_MODE_REQUIRED') in raw, (code, raw))
code, d, raw = assign(b, mode='ADDITIONAL')
check('2.5b an additional role needs the reason too, as the form has it (400)', code == 400 and 'TRAINING_REASON_REQUIRED' in raw, (code, raw))
code, jb, raw = assign(b, mode='ADDITIONAL', changeReason='E2E-TEST an additional duty')
check('2.6 an additional role is a case of its own, and keeps the list of the roles held before', code == 200 and jb.get('caseType') == 'ADDITIONAL' and any(r['id'] == a['id'] for r in jb.get('rolesBefore', [])) and len(jb.get('rolesAfter', [])) == len(jb.get('rolesBefore', [])) + 1, raw)
res = make_effective(jb)
check('2.7 the additional role is effective and the first one is still held', res == (200, 'EFFECTIVE') and sql(f"select count(*) from training_job_assignments where person_user_id='{person}' and status='EFFECTIVE' and position_id in ('{a['id']}','{b['id']}')") == '2', res)
code, d, raw = assign(c)
check('2.8 with two roles held the way must be said (400)', code == 400 and 'TRAINING_JOB_MODE_REQUIRED' in raw, (code, raw))
code, d, raw = assign(c, mode='CHANGE', changeReason='E2E-TEST the duty moves')
check('2.9 a change must say which role it replaces (400)', code == 400 and 'TRAINING_JOB_REPLACES_REQUIRED' in raw, (code, raw))
code, jc, raw = assign(c, mode='CHANGE', replacesPositionId=a['id'], changeReason='E2E-TEST the duty moves')
check('2.10 a change names the role it replaces', code == 200 and jc.get('caseType') == 'CHANGE' and jc.get('previousPositionName') == a['name'], raw)
res = make_effective(jc)
status_a = sql(f"select status from training_job_assignments where person_user_id='{person}' and position_id='{a['id']}'")
held = sql(f"select string_agg(position_id::text, ',' order by position_id) from training_person_positions where person_user_id='{person}' and valid_to is null and source='JOB_ASSIGNMENT'")
check('2.11 the replaced role is Obsoleted and no longer held; the other roles stay', res == (200, 'EFFECTIVE') and status_a == 'OBSOLETED' and a['id'] not in held and b['id'] in held and c['id'] in held, (res, status_a, held))

import zipfile, io, re
st, docx = admin.call('GET', f"/training/job-assignments/{jb['id']}/export?format=docx", raw=True)
xml = zipfile.ZipFile(io.BytesIO(docx)).read('word/document.xml').decode('utf8') if st == 200 else ''
text = re.sub(r'<w:br[^>]*/>', '\n', xml)
text = re.sub(r'<[^>]+>', '', text)
check('2.12 the form lists every role held before and every one after (APD.0024)', st == 200 and a['name'] in text and b['name'] in text and text.count(a['name']) >= 2, (st, len(text)))
print('== 3. a role that someone holds')
code, d, raw = attempt(admin, 'PUT', f"/training/job-roles/{c['id']}", {'name': c['name'], 'active': False, 'version': admin.call('GET', f"/training/job-roles/{c['id']}")['version']})
check('3.1 a Job Role that a person holds cannot be deactivated (409)', code == 409 and 'TRAINING_JOB_ROLE_IN_USE' in raw, (code, raw))
cur = admin.call('GET', f"/training/job-roles/{a['id']}")
code, d, raw = attempt(admin, 'PUT', f"/training/job-roles/{a['id']}", {'name': a['name'], 'active': False, 'version': cur['version']})
check('3.2 one that nobody holds can be deactivated', code == 200 and d.get('active') is False, raw)
code, d, raw = assign(a, mode='ADDITIONAL')
check('3.3 and it is not offered for a new job assignment', code == 400, (code, raw))

print('== 4. the menu of the lists is decided by the server')
code, jd, raw = assign(e, mode='ADDITIONAL', changeReason='E2E-TEST menu')
rows = admin.call('GET', '/training/job-assignments?limit=100')['data']
mine = next((r for r in rows if r['id'] == jd['id']), {})
check('4.1 the person who manages sees View Details and Continue Draft of a draft, not Review and Accept', mine.get('actions') == {'view': True, 'continueDraft': True, 'review': False}, mine.get('actions'))
got = admin.call('GET', f"/training/job-assignments/{jd['id']}")
attempt(admin, 'POST', f"/training/job-assignments/{jd['id']}/submit", {'version': got['version'], 'signatureToken': sign(admin)})
rows = trainee.call('GET', '/training/job-assignments?limit=100')['data']
mine = next((r for r in rows if r['id'] == jd['id']), {})
check('4.2 the employee sees Review and Accept of the assignment waiting for the signature, not Continue Draft', mine.get('actions') == {'view': True, 'continueDraft': False, 'review': True}, mine.get('actions'))
rows = admin.call('GET', '/training/job-assignments?limit=100')['data']
mine = next((r for r in rows if r['id'] == jd['id']), {})
check('4.3 the one who assigned does not see Review and Accept', mine.get('actions', {}).get('review') is False, mine.get('actions'))
got = admin.call('GET', f"/training/job-assignments/{jd['id']}")
code, d, raw = attempt(admin, 'POST', f"/training/job-assignments/{jd['id']}/cancel", {'version': got['version'], 'reason': 'E2E-TEST cancelled'})
check('4.4 the waiting assignment is cancelled (it stays as history)', code == 200, raw)
assess = admin.call('GET', '/training/assessments?limit=100')['data']
check('4.5 every row of the assessments says what the menu may offer', all('actions' in r for r in assess) and any(r['actions'].get('continueDraft') for r in assess if r['status'] == 'DRAFT') or not any(r['status'] == 'DRAFT' for r in assess), assess[0].get('actions') if assess else None)
code, tl, raw = attempt(trainee, 'GET', '/training/assessments?limit=100')
check('4.6 a person without the right to see the library does not get the list, so no draft to continue (403)', code in (401, 403), (code, raw))

print('== 4b. the trainings ticked as a condition, and the duties in two languages')
topics = admin.call('GET', '/training/topics?activeOnly=true')['data']
topic = next((t for t in topics if not sql(f"select 1 from training_records where person_user_id='{person}' and lower(topic_text)=lower('{t['name'].replace(chr(39), chr(39) * 2)}') limit 1")), None)
duties = [{'responsibility': 'E2E-TEST Dam bao hoat dong\n- Dong thu hai', 'responsibilityEn': 'E2E-TEST Ensure the work', 'description': 'E2E-TEST Giam sat', 'descriptionEn': 'E2E-TEST Supervise the work\nSecond English line'}]
code, jr, raw = assign(e, mode='ADDITIONAL', changeReason='E2E-TEST condition', duties=duties, requiredTopicIds=[topic['id']] if topic else [])
check('4.7 the draft keeps the duties in two languages and the ticked training', code == 200 and jr['duties'][0].get('responsibilityEn') == 'E2E-TEST Ensure the work' and (not topic or jr['requiredItems'][0]['title'] == topic['name']), raw)
elig = jr.get('eligibility') or {}
check('4.8 the check is made at once: the ticked training the person has not done is missing, and it says where it comes from', not topic or (elig.get('missingCount', 0) >= 1 and any(i.get('source') == 'CHOSEN' and i.get('lastDone') is None for i in elig.get('items', []))), elig)
live = admin.call('GET', f"/training/job-assignments/eligibility?person={person}&position={e['id']}&topicIds={topic['id'] if topic else ''}")
check('4.9 the same answer is given before the draft exists (the form asks while the person is chosen)', not topic or live.get('missingCount', 0) >= 1, live)
got = admin.call('GET', f"/training/job-assignments/{jr['id']}")
code, d, raw = attempt(admin, 'POST', f"/training/job-assignments/{jr['id']}/submit", {'version': got['version'], 'signatureToken': sign(admin)})
check('4.10 it cannot be signed while a required training is not done (409)', not topic or (code == 409 and 'TRAINING_MATRIX_INCOMPLETE' in raw), (code, raw))
st, docx = admin.call('GET', f"/training/job-assignments/{jr['id']}/export?format=docx", raw=True)
xml = zipfile.ZipFile(io.BytesIO(docx)).read('word/document.xml').decode('utf8') if st == 200 else ''
check('4.11 the form has the Vietnamese lines, then the English ones in italic, one paragraph for each line', st == 200 and 'E2E-TEST Dam bao hoat dong' in xml and 'Dong thu hai' in xml and 'Second English line' in xml and xml.count('E2E-TEST Ensure the work') == 1, st)
got = admin.call('GET', f"/training/job-assignments/{jr['id']}")
attempt(admin, 'POST', f"/training/job-assignments/{jr['id']}/cancel", {'version': got['version'], 'reason': 'E2E-TEST cleanup'})

print('== 5. a role is not given by hand any more')
code, d, raw = attempt(admin, 'PUT', '/training/person-positions', {'personUserId': person, 'positionId': b['id']})
check('5.1 there is no way to set a role from the screen of the people (405)', code in (404, 405), (code, raw))
people = admin.call('GET', '/training/person-positions?search=Trainee%20Test%202&limit=5')
code, d, raw = attempt(Client('trainee.test1'), 'GET', '/training/person-positions?limit=5')
check('5.3 a person without the right to see job assignments or matrices does not get the list', code in (401, 403), (code, raw))
row = next((r for r in people['data'] if r['personId'] == person), {})
check('5.2 the list of the people shows the roles they hold', row.get('jobRoleCount', 0) >= 2 and b['name'] in str(row.get('jobRoleNames')), row)
print(sum(1 for r in results if r[1]), 'of', len(results), 'checks passed')
