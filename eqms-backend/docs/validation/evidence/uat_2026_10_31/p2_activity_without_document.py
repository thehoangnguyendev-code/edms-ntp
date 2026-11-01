"""Scenario 2: a training activity that does NOT start from a document (an unplanned classroom training with a test), ten people of three departments (Quality Assurance, Quality Control, Production):
two pass, four fail the test, two are absent, two leave the company midway (their accounts are closed while the training runs). The trainer sends the attendance list, finishes the training; QA confirms.
Shots and APD files are named S2-xx."""
from flows31 import *

state = load()
S = state.setdefault('s2', {})
b = Browser()
PASS = ['uat31.s2.qa.pass', 'uat31.s2.qc.pass']
FAIL = ['uat31.s2.qa.fail', 'uat31.s2.qc.fail1', 'uat31.s2.qc.fail2', 'uat31.s2.pr.fail']
ABSENT = ['uat31.s2.qa.absent', 'uat31.s2.qc.absent']
LEFT = ['uat31.s2.qa.left', 'uat31.s2.pr.left']
ALL10 = PASS + FAIL + ABSENT + LEFT
TOPIC = 'UAT31 Good Laboratory Practice refresher: handling and recording of results'
if 'aid' not in S:
    for u in ALL10:
        set_status(u, 'Active')
    due = (TODAY + datetime.timedelta(days=30)).isoformat()
    a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'dueDate': due})
    S['aid'] = a['id']
    save(state)
aid = S['aid']

step('S2-1 the activity (not from a document) is prepared and started with ten people of three departments')
a = get(aid)
if a['status'] in ('PLANNED', 'RESERVED') and 'sid' not in S:
    sid, pid = run_to_start(aid, 'CLASSROOM', 'TEST', ALL10, TOPIC, exam='UAT31 GLP refresher test', material_link=True)
    S['sid'], S['pid'] = sid, pid
    save(state)
sid, pid = S['sid'], S['pid']
a = get(aid)
print('activity', a['trainingNumber'], a['status'], a.get('kind'), a.get('kindReason'), a.get('documentNumber'))
check('S2-1.1 the activity has no document and is In Progress with ten people', a['status'] == 'IN_PROGRESS' and not a.get('documentNumber') and len(a['participants']) == 10, (a['status'], a.get('documentNumber'), len(a['participants'])))
depts = sorted({p['department'] for p in a['participants']})
check('S2-1.2 the people belong to three departments', depts == ['Production', 'Quality Assurance', 'Quality Control'], depts)
A = f'/training-management/activities/{aid}'
WS = f'{A}/sessions/{sid}/workspace'
b.shot('admin', A, 'S2-01', 'Activity_without_document_general', f"Activity {a['trainingNumber']} không xuất phát từ tài liệu (Type: Unplanned, không có Document), In Progress")
b.shot('admin', A, 'S2-02', 'Participants_ten_people_before_attendance', 'Tab Participants: 10 nhân sự của 3 phòng (QA, QC, Production) trước khi điểm danh', action=tab('Participants'))

step('S2-2 two people leave the company midway: the accounts are closed while the training runs')
for u in LEFT:
    set_status(u, 'Terminated', 'UAT31 left the company during the training')
lines = {p['id']: p for p in get(aid)['participants']}
check('S2-2.1 the lines of the two people show the closed account', all(lines[pid[u]].get('accountStatus') == 'Terminated' for u in LEFT), [lines[pid[u]].get('accountStatus') for u in LEFT])
b.shot('admin', A, 'S2-03', 'Participants_two_left_account_closed', 'Tab Participants sau khi 2 người nghỉ việc (tài khoản Terminated) trong lúc đào tạo: dòng của họ báo "account terminated: cannot sign"', action=tab('Participants'))

step('S2-3 attendance')
for u in PASS + FAIL:
    code, d, t = attempt(admin, 'POST', f'/training/participants/{pid[u]}/attendance', {'state': 'ATTENDED'})
    check(f'S2-3 {u} attends', code == 200, (code, t))
for u in ABSENT:
    code, d, t = attempt(admin, 'POST', f'/training/participants/{pid[u]}/attendance', {'state': 'ABSENT', 'absenceReason': 'UAT31 on annual leave on the day of the training'})
    check(f'S2-3 {u} is recorded Absent', code == 200, (code, t))
for u in LEFT:
    code, d, t = attempt(admin, 'POST', f'/training/participants/{pid[u]}/attendance', {'state': 'ABSENT', 'absenceReason': 'UAT31 left the company on ' + TODAY.isoformat()})
    check(f'S2-3 {u} (left the company) is recorded Absent with the reason', code == 200, (code, t))
b.shot('admin', WS, 'S2-04', 'Workspace_attendance_recorded', 'Session Workspace sau khi điểm danh: 6 có mặt, 4 vắng (2 nghỉ phép, 2 nghỉ việc)')

step('S2-4 the test: two pass, four fail')
for u, got in list(zip(PASS, (9, 8))) + list(zip(FAIL, (3, 4, 5, 6))):
    code, d, t = attempt(admin, 'POST', f'/training/participants/{pid[u]}/assessments', {'scoreObtained': got, 'scoreMax': 10, 'remarks': 'UAT31 GLP refresher test'})
    check(f'S2-4 score of {u}: {got}/10', code == 200, (code, t))
res = {p['personUserId']: p['result'] for p in get(aid)['participants']}
check('S2-4.1 two PASSED and four FAILED', sum(1 for u in PASS if res[uid(u)] == 'PASSED') == 2 and sum(1 for u in FAIL if res[uid(u)] == 'FAILED') == 4, res)
check('S2-4.2 each failed person has an open Work Suspension flag', sql(f"select count(*) from training_work_suspensions s join app_users u on u.id=s.person_user_id where s.activity_id='{aid}' and s.status='OPEN'") == [['4']], sql(f"select count(*) from training_work_suspensions where activity_id='{aid}'"))
b.shot('admin', A, 'S2-05', 'Assessment_tab_scores', 'Tab Assessment: điểm của 6 người có mặt (2 đạt, 4 trượt)', action=tab('Assessment'))

step('S2-5 attendance list to QA, Finish Training, QA confirmation')
a = get(aid)
code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/send-attendance-list', {'version': a['version'], 'signatureToken': sign(admin)})
check('S2-5.1 the attendance list is sent to QA', code == 200, (code, t))
f, c = finish_and_confirm(aid)
check('S2-5.2 Finish Training with 2 absent, 2 left and 4 failed', f[0] == 200, (f[0], f[2]))
check('S2-5.3 QA confirms: Completed', c[0] == 200 and get(aid)['status'] == 'COMPLETED', (c[0], c[2]))
b.shot('admin', A, 'S2-06', 'Participants_tab_final', 'Tab Participants khi activity Completed: kết quả cuối của 10 nhân sự', action=tab('Participants'))
b.shot('admin', A, 'S2-07', 'Signatures_tab_final', 'Tab Signatures: các chữ ký điện tử của activity', action=tab('Signatures'))
b.shot('admin', WS, 'S2-08', 'Workspace_results_step', 'Session Workspace, bước Results', action=tab('Results'))

step('S2-6 who can be offered a supplementary training')
ov = admin.call('GET', f'/training/activities/{aid}/overview')
cands = {x['fullName']: x.get('canOfferSupplementary') for x in ov.get('supplementaryCandidates', [])}
print('candidates:', cands)
ok = all(cands.get(name_of(u)) is True for u in ABSENT + FAIL) and all(cands.get(name_of(u)) is False for u in LEFT)
check('S2-6.1 the 2 absent and the 4 failed can be offered a supplementary training, the 2 who left cannot', ok, cands)

step('S2-7 the APD files')
st, w = get_bytes(admin, f'/training/activities/{aid}/attendance-list?format=docx')
check('S2-7.1 APD.0117 as Word', st == 200 and w[:2] == b'PK', st)
if st == 200:
    save_apd('S2-09', 'APD0117_attendance_list_activity_without_document', 'APD.0117 danh sách tham dự đào tạo (activity không từ tài liệu): 10 nhân sự, 3 phòng', w, 'docx')
    t = words(w)
    check('S2-7.2 all ten names are in the list', all(name_of(u) in t for u in ALL10), [name_of(u) for u in ALL10 if name_of(u) not in t])
st, p = get_bytes(admin, f'/training/activities/{aid}/attendance-list?format=pdf')
if st == 200 and p[:4] == b'%PDF':
    save_apd('S2-09', 'APD0117_attendance_list_activity_without_document', 'APD.0117 danh sách tham dự đào tạo (PDF)', p, 'pdf', pages=3)
state['s2'] = S
save(state)
finish('p2', b)
