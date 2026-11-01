"""Part 8d: the reason for the records of a Legacy Import: Training Compliance. A SOP imported from paper is put in the training matrix of Quality Assurance; the person who was trained on paper
must be "done" and the person who was not must be "missing"; after that the matrix and the coverage are looked at the way the department looks at them."""
from lib7 import *

state = load()
qc = sql("select id from departments where name = 'Quality Control'")[0][0]
trained = sql("select id from app_users where username = 'uat31.s1.pass1'")[0][0]
not_trained = sql("select id from app_users where username = 'uat31.s1.pass2'")[0][0]
approver_id = sql("select id from app_users where username = 'approver.test1'")[0][0]
appr = U('approver.test1')
Nx = 'TRN/QC/26-%d' % (int(sql("select coalesce(max(substring(training_number from '-([0-9]+)$')::int), 0) from training_activities where training_number like 'TRN/QC/26-%' and length(training_number) < 16")[0][0]) + 25)

step('H-6 a SOP imported from paper and put in the matrix of the department')
# test set-up (DEV only, not a product path): the two persons of Quality Control get the Work Position QC Analyst, as the matrix is by position
for person in (trained, not_trained):
    sqlx(f"insert into training_person_positions(id, person_user_id, position_id, department_id, source) select gen_random_uuid(), '{person}', '32111111-1111-1111-1111-111111111112', '{qc}', 'ADMIN' where not exists (select 1 from training_person_positions where person_user_id = '{person}' and position_id = '32111111-1111-1111-1111-111111111112' and valid_to is null)")
docX = free_number()
code, data, text = do_import(docX, 'UAT8 compliance SOP', [section(number=Nx, people=[trained])], [SCAN], department=qc, reviewers=[], approvers=[approver_id])
check('H-6.1 the SOP is imported; only one of the two persons is named as trained', code == 200, (code, text[:300]))
doc_id = sql(f"select id from documents where document_number = '{docX}'")[0][0]
pos = {u: sql(f"select position_id from training_person_positions where person_user_id = '{u}' and valid_to is null limit 1") for u in (trained, not_trained)}
print('positions', pos, flush=True)
pos_ids = sorted({p[0][0] for p in pos.values() if p})
check('H-6.2 both persons have a Work Position in the department', len(pos_ids) >= 1 and all(pos.values()), pos)

mats = admin.call('GET', '/training/matrices?limit=100')['data']
qa_m = [m for m in mats if m.get('departmentName') == 'Quality Control' or m.get('department') == 'Quality Control']
check('H-6.3 the department has a training matrix', len(qa_m) >= 1, [(m.get('code'), m.get('departmentName')) for m in mats][:6])
mid = qa_m[0]['id']
vers = admin.call('GET', f'/training/matrices/{mid}/versions?limit=50')['data']
draft = [x for x in vers if x['status'] == 'DRAFT']
if draft:
    ver = draft[0]['id']
else:
    code, d, t = attempt(admin, 'POST', f'/training/matrices/{mid}/upgrade')
    check('H-6.4 a new version of the matrix is started', code == 200, (code, t[:200]))
    ver = d.get('id') or admin.call('GET', f'/training/matrices/{mid}/versions?limit=50')['data'][0]['id']
v = admin.call('GET', f'/training/matrix-versions/{ver}')
rows = [{'group': r['rowGroup'], 'topicText': r.get('topicText'), 'documentId': r.get('documentId'), 'annualRequired': r['annualRequired'], 'note': r.get('note'), 'positionIds': r['positionIds'],
         'allEmployees': bool(r.get('allEmployees')), 'locked': bool(r.get('locked'))} for r in v['rows']]
rows = [r for r in rows if r['positionIds'] or r['allEmployees']]     # a draft left by an earlier run may hold a row that had no position
rows.append({'group': 'SOP', 'topicText': None, 'documentId': doc_id, 'annualRequired': False, 'note': 'UAT8 imported from paper', 'positionIds': pos_ids, 'allEmployees': False, 'locked': False})
code, saved, t = attempt(admin, 'PUT', f'/training/matrix-versions/{ver}', {'version': v['version'], 'changeReason': 'UAT8 the SOP imported from paper', 'rows': rows})
check('H-6.5 the imported SOP is added to the matrix', code == 200, (code, t[:300]))
v = admin.call('GET', f'/training/matrix-versions/{ver}')
code, d, t = attempt(admin, 'POST', f'/training/matrix-versions/{ver}/submit', {'version': v['version'], 'signatureToken': sign(admin), 'approverUserId': approver_id})
check('H-6.6 the matrix is submitted with a signature', code == 200, (code, t[:300]))
v = admin.call('GET', f'/training/matrix-versions/{ver}')
code, d, t = attempt(appr, 'POST', f'/training/matrix-versions/{ver}/approve', {'version': v['version'], 'signatureToken': sign(appr)})
check('H-6.7 QA approves it: the matrix is Effective', code == 200, (code, t[:300]))

step('H-7 what Training Compliance says')
cov = admin.call('GET', f'/training/compliance/coverage?departmentId={qc}&search={docX}&limit=50')
rows_c = cov.get('data', [])
print('coverage rows', [(r.get('fullName'), r.get('status'), r.get('lastDone')) for r in rows_c], flush=True)
by_name = {r.get('personId') or r.get('pid'): r for r in rows_c}
status_trained = [r for r in rows_c if (r.get('personId') or r.get('pid')) == trained]
status_not = [r for r in rows_c if (r.get('personId') or r.get('pid')) == not_trained]
check('H-7.1 the person who was trained on paper is OK for the imported SOP', status_trained and status_trained[0].get('status') == 'OK', status_trained)
check('H-7.2 the person who was not named is MISSING for the same SOP', status_not and status_not[0].get('status') == 'MISSING', status_not)
summary = admin.call('GET', f'/training/compliance/summary?departmentId={qc}')
check('H-7.3 the summary of the department answers', isinstance(summary, dict) and summary, str(summary)[:200])
gaps = admin.call('GET', f'/training/compliance/gaps?departmentId={qa}&personId={not_trained}') if False else None
state['p8d'] = {'doc': docX, 'matrix_version': ver}
save(state)
finish('p8d')
