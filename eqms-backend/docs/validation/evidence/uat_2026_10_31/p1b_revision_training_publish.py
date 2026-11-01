"""Scenario 1, part b: revision 2 of the document is trained in a classroom with a test: five people of Quality Control: two pass, one is absent, one fails the test, one leaves the company midway
(the account is closed while the training is running). The trainer finishes the training, QA confirms, Complete Training moves revision 2 to Ready For Publishing and Publish makes it EFFECTIVE while the list
still has an absent person, a person who failed and a person who left. The shots and the APD files are named S1-xx."""
from flows31 import *

state = load()
S = state['s1']
b = Browser()
aid, rid = S['aid2'], S['rid2']
PEOPLE5 = ['uat31.s1.pass1', 'uat31.s1.pass2', 'uat31.s1.absent', 'uat31.s1.fail', 'uat31.s1.left']
TOPIC = 'UAT31 SOP Handling of QC samples, revision 2'
for u in PEOPLE5:
    set_status(u, 'Active')   # a re-run starts with everyone Active

step('S1-b.1 the activity of revision 2 is planned and started (classroom, test)')
a = get(aid)
if a['status'] == 'PLANNED':
    sid, pid = run_to_start(aid, 'CLASSROOM', 'TEST', PEOPLE5, TOPIC, rid=rid, exam='UAT31 test of SOP Handling of QC samples revision 2')
    S['sid2'], S['pid2'] = sid, pid
    save(state)
else:
    sid, pid = S['sid2'], S['pid2']
a = get(aid)
check('S1-b.1 the training is In Progress with five people on the list', a['status'] == 'IN_PROGRESS' and len(a['participants']) == 5, (a['status'], len(a['participants'])))
WS = f'/training-management/activities/{aid}/sessions/{sid}/workspace'
b.shot('admin', f'/training-management/activities/{aid}', 'S1-04', 'Activity_rev2_in_progress_five_people', f"Activity {a['trainingNumber']} của revision 2: đang In Progress, 5 nhân sự trong danh sách", full=True)
b.shot('admin', WS, 'S1-05', 'Session_workspace_before_attendance', 'Session Workspace của buổi đào tạo trước khi điểm danh')

step('S1-b.2 one person leaves the company midway: the account is closed while the training runs')
set_status('uat31.s1.left', 'Terminated', 'UAT31 left the company during the training')
line = {p['id']: p for p in get(aid)['participants']}[pid['uat31.s1.left']]
print('line of the person who left:', {k: line.get(k) for k in ('fullName', 'state', 'accountStatus', 'result')})
check('S1-b.2 the line of the person shows that the account is closed', line.get('accountStatus') == 'Terminated', line.get('accountStatus'))
b.shot('admin', f'/training-management/activities/{aid}', 'S1-06', 'Activity_rev2_person_left_midway', 'Activity sau khi Hoàng Văn Em nghỉ việc giữa chừng (tài khoản Terminated): xem dòng nhân sự', full=True)

step('S1-b.3 attendance: three attend, one is absent, the one who left is recorded Absent with the reason')
for u in ('uat31.s1.pass1', 'uat31.s1.pass2', 'uat31.s1.fail'):
    code, d, t = attempt(admin, 'POST', f'/training/participants/{pid[u]}/attendance', {'state': 'ATTENDED'})
    check(f'S1-b.3 {u} attends', code == 200, (code, t))
code, d, t = attempt(admin, 'POST', f"/training/participants/{pid['uat31.s1.absent']}/attendance", {'state': 'ABSENT', 'absenceReason': 'UAT31 sick leave on the day of the training'})
check('S1-b.4 the absent person is recorded Absent with a reason', code == 200, (code, t))
code, d, t = attempt(admin, 'POST', f"/training/participants/{pid['uat31.s1.left']}/attendance", {'state': 'ABSENT', 'absenceReason': 'UAT31 left the company on ' + TODAY.isoformat()})
check('S1-b.5 the person who left is recorded Absent with the reason (left the company)', code == 200, (code, t))
b.shot('admin', WS, 'S1-07', 'Session_workspace_attendance_recorded', 'Session Workspace sau khi điểm danh: 3 có mặt, 1 vắng (nghỉ ốm), 1 vắng do nghỉ việc')

step('S1-b.6 the test: two pass, one fails')
for u, got in (('uat31.s1.pass1', 9), ('uat31.s1.pass2', 8), ('uat31.s1.fail', 4)):
    code, d, t = attempt(admin, 'POST', f'/training/participants/{pid[u]}/assessments', {'scoreObtained': got, 'scoreMax': 10, 'remarks': 'UAT31 test of revision 2'})
    check(f'S1-b.6 score of {u}: {got}/10', code == 200, (code, t))
res = {p['personUserId']: p['result'] for p in get(aid)['participants']}
check('S1-b.7 results: two PASSED, one FAILED, the two absent have none', res[uid('uat31.s1.pass1')] == 'PASSED' and res[uid('uat31.s1.pass2')] == 'PASSED' and res[uid('uat31.s1.fail')] == 'FAILED', res)
susp = sql(f"select count(*) from training_work_suspensions where person_user_id='{uid('uat31.s1.fail')}'") if sql("select to_regclass('training_work_suspensions')")[0][0] else None
print('work-suspension rows for the person who failed:', susp)
b.shot('admin', WS, 'S1-08', 'Session_workspace_test_results', 'Session Workspace sau khi chấm bài: 2 đạt, 1 trượt (Failed)')
b.shot('admin', f'/training-management/activities/{aid}', 'S1-09', 'Activity_rev2_results_before_finish', 'Activity trước khi Finish Training: kết quả từng người', full=True)

step('S1-b.8 the trainer sends the attendance list and finishes the training; QA confirms')
a = get(aid)
code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/send-attendance-list', {'version': a['version'], 'signatureToken': sign(admin)})
check('S1-b.8 the attendance list is sent', code == 200, (code, t))
f, c = finish_and_confirm(aid)
check('S1-b.9 Finish Training works although one is absent, one failed and one left', f[0] == 200, (f[0], f[2]))
check('S1-b.10 QA confirms: Completed', c[0] == 200 and get(aid)['status'] == 'COMPLETED', (c[0], c[2]))
b.shot('admin', f'/training-management/activities/{aid}', 'S1-10', 'Activity_rev2_completed', 'Activity revision 2 đã Completed khi vẫn còn người vắng, người trượt và người nghỉ việc', full=True)

step('S1-b.11 supplementary candidates (what is offered for the people still not trained)')
ov = admin.call('GET', f'/training/activities/{aid}/overview')
cands = {x['fullName']: (x.get('canOfferSupplementary'), x.get('state'), x.get('result')) for x in ov.get('supplementaryCandidates', [])}
print('candidates:', cands)
check('S1-b.11 the absent person and the one who failed can be offered a supplementary training, the one who left cannot', cands.get(name_of('uat31.s1.absent'), (None,))[0] is True and cands.get(name_of('uat31.s1.fail'), (None,))[0] is True and cands.get(name_of('uat31.s1.left'), (None,))[0] is False, cands)

step('S1-b.12 Complete Training of revision 2, then Publish: the document goes Effective with people still not trained')
link = admin.call('GET', f'/training/links/revisions/{rid}')
check('S1-b.12 the revision sees the training as Completed', link.get('statusLabel') == 'Completed', link)
code, d, t = attempt(admin, 'POST', f'/revisions/{rid}/training/complete', {'signatureToken': sign(admin), 'comment': 'UAT31', 'reason': 'UAT31 Complete Training with absent / failed people'})
check('S1-b.13 Complete Training of revision 2', code == 200, (code, t))
print('revision 2 status:', admin.call('GET', f'/revisions/{rid}').get('status'))
b.shot('admin', f'/documents/revisions/{rid}', 'S1-11', 'Revision_2_ready_for_publishing', 'Revision 2 sau Complete Training: Ready For Publishing')
status, problems = publish_revision(rid)
check('S1-b.14 revision 2 is Effective after Publish', str(status).upper() in ('EFFECTIVE', 'ACTIVE') or str(status).upper().startswith('PUBLISH'), (status, problems))
b.shot('admin', f'/documents/revisions/{rid}', 'S1-12', 'Revision_2_effective', 'Revision 2 đã Effective dù danh sách đào tạo còn người vắng, người trượt và người nghỉ việc')
r1 = admin.call('GET', f"/revisions/{S['rid1']}")
print('revision 1 status now:', r1.get('status'))

step('S1-b.15 the APD files of the training')
st, w = get_bytes(admin, f'/training/activities/{aid}/attendance-list?format=docx')
check('S1-b.15 APD.0117 attendance list as Word', st == 200 and w[:2] == b'PK', (st, w[:100]))
if st == 200:
    save_apd('S1-13', 'APD0117_attendance_list_rev2', 'APD.0117 danh sách tham dự đào tạo revision 2 (2 đạt, 1 trượt, 2 vắng)', w, 'docx')
    t = words(w)
    check('S1-b.16 the list names all five people and "Vắng mặt" for the absent ones', all(name_of(u) in t for u in PEOPLE5), t[:300])
    print('   absent words in APD.0117:', t.count('Vắng'), t.count('Absent'))
st, p = get_bytes(admin, f'/training/activities/{aid}/attendance-list?format=pdf')
if st == 200 and p[:4] == b'%PDF':
    save_apd('S1-13', 'APD0117_attendance_list_rev2', 'APD.0117 danh sách tham dự đào tạo revision 2 (PDF)', p, 'pdf')
state['s1'] = S
save(state)
finish('p1b', b)
