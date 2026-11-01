"""Scenario 5: self-reading with the electronic signature of every employee. Seven people of three departments: five read and sign (one of them through the screen, with the e-signature window), one person leaves
the company midway (account Terminated) and one goes on a long leave (account Suspended): the trainer records the two with Cannot Read. A reminder is sent to a person who has not signed (not to the closed accounts).
The head of each department confirms (e-signature, remarks), the trainer finishes the training, QA confirms. APD.0108 (one list for each department) is saved with the signatures. Shots and files are named S5-xx."""
from flows31 import *
import zipfile as _zip

state = load()
S = state.setdefault('s5', {})
b = Browser()
PEOPLE7 = {'Quality Assurance': ['uat31.s2.qa.pass', 'uat31.s2.qa.fail', 'uat31.s2.qa.absent'],
           'Quality Control': ['uat31.s2.qc.pass', 'uat31.s2.qc.fail1', 'uat31.s2.qc.fail2'],
           'Production': ['uat31.s2.pr.fail']}
HEAD = {'Quality Assurance': 'uat31.head.qa', 'Quality Control': 'uat31.head.qc', 'Production': 'uat31.head.prod'}
ALL7 = [u for v in PEOPLE7.values() for u in v]
LEAVER, LONGLEAVE = 'uat31.s2.qc.fail2', 'uat31.s2.qa.absent'
TOPIC = 'UAT31 Data integrity: ALCOA+ principles in the laboratory'

if 'aid' not in S:
    for u in ALL7:
        set_status(u, 'Active')
    a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'dueDate': (TODAY + datetime.timedelta(days=10)).isoformat()})
    S['aid'] = a['id']
    sid, pid = run_to_start(S['aid'], 'SELF_READING', 'SELF_READING_CONFIRMATION', ALL7, TOPIC)
    S['sid'], S['pid'] = sid, pid
    save(state)
aid, sid, pid = S['aid'], S['sid'], S['pid']
A = f'/training-management/activities/{aid}'
WS = f'{A}/sessions/{sid}/workspace'
a = get(aid)
check('S5-1 the self-reading is In Progress with seven people of three departments', a['status'] == 'IN_PROGRESS' and len(a['participants']) == 7, (a['status'], len(a['participants'])))
print('activity', a['trainingNumber'])

step('S5-2 what the employee sees and the e-signature through the screen')
b.shot('uat31.s2.qa.pass', '/training-management/my-training', 'S5-01', 'My_Training_self_reading_to_do', 'My Training của nhân viên Vũ Thị Giang: việc cần làm — tài liệu tự đọc chờ xác nhận bằng chữ ký điện tử')
ui_note = ''
try:
    emp = 'uat31.s2.qa.pass'
    pg = b.page(emp)
    pg.set_default_timeout(20000)
    pg.goto(BASE + f'/training-management/activities/{aid}/participate', wait_until='domcontentloaded')
    pg.wait_for_timeout(4000)
    b.shot(emp, None, 'S5-02', 'Participate_page_self_reading', 'Trang tham gia đào tạo của nhân viên: nội dung cần đọc và nút xác nhận đã đọc')
    btn = pg.get_by_role('button', name=re.compile(r'confirm|read|sign', re.I))
    names = [x.inner_text() for x in btn.all() if x.is_visible()]
    print('buttons on the participate page:', names)
    target = [x for x in btn.all() if x.is_visible() and re.search(r'read', x.inner_text(), re.I)]
    if target:
        target[0].click()
        pg.wait_for_timeout(2500)
        pw = pg.locator('input[type=password]')
        if pw.count():
            pw.first.fill(PW)
            b.shot(emp, None, 'S5-03', 'E_signature_window_password_entered', 'Cửa sổ ký điện tử của nhân viên: nhập mật khẩu để ký xác nhận đã đọc và hiểu')
            for label in ('Sign', 'Confirm', 'Submit'):
                bt = [x for x in pg.get_by_role('button', name=re.compile(label, re.I)).all() if x.is_visible()]
                if bt:
                    bt[-1].click()
                    break
            pg.wait_for_timeout(3500)
            b.shot(emp, None, 'S5-04', 'After_the_employee_signed', 'Sau khi nhân viên ký điện tử xác nhận đã đọc')
        else:
            ui_note = 'no password field after the click'
    else:
        ui_note = 'no read/confirm button found: ' + str(names)
except Exception as e:
    ui_note = 'UI signing failed: ' + str(e)[:200]
state_of = {p['id']: p['state'] for p in get(aid)['participants']}
if state_of[pid['uat31.s2.qa.pass']] != 'READ_CONFIRMED':
    print('NOTE the signing through the screen did not complete:', ui_note, '-> signing through the API')
    c = U('uat31.s2.qa.pass')
    attempt(c, 'POST', f"/training/me/participations/{pid['uat31.s2.qa.pass']}/confirm-read", {'signatureToken': sign(c), 'reason': 'UAT31 I read it and understood it'})
check('S5-2.1 the employee signed the reading electronically', {p['id']: p['state'] for p in get(aid)['participants']}[pid['uat31.s2.qa.pass']] == 'READ_CONFIRMED', ui_note)
check('S5-2.2 the e-signature was made through the screen (no API fallback)', not ui_note and state_of[pid['uat31.s2.qa.pass']] == 'READ_CONFIRMED', ui_note)

step('S5-3 one person leaves the company, one goes on a long leave; a reminder goes to a person who has not signed')
set_status(LEAVER, 'Terminated', 'UAT31 left the company during the self-reading')
set_status(LONGLEAVE, 'Suspended', 'UAT31 long leave (maternity)')
lines = {p['id']: p for p in get(aid)['participants']}
check('S5-3.1 the lines show the closed accounts', lines[pid[LEAVER]].get('accountStatus') == 'Terminated' and lines[pid[LONGLEAVE]].get('accountStatus') == 'Suspended', (lines[pid[LEAVER]].get('accountStatus'), lines[pid[LONGLEAVE]].get('accountStatus')))
b.shot('admin', WS, 'S5-05', 'Workspace_reading_step_left_and_long_leave', 'Session Workspace, bước Reading: 1 người đã ký, 2 tài khoản đã đóng (nghỉ việc / nghỉ dài hạn) hiện "cannot sign", người còn lại chưa ký', action=tab('Reading'))
code, d, t = attempt(admin, 'POST', f'/training/participants/{pid[LEAVER]}/remind-read', {})
check('S5-3.2 no reminder is sent to the person who left', code == 409 and 'TRAINING_READER_ACCOUNT_NOT_ACTIVE' in t, (code, t))
code, d, t = attempt(admin, 'POST', f"/training/participants/{pid['uat31.s2.qc.pass']}/remind-read", {})
check('S5-3.3 a reminder is sent to a person who has not signed', code == 200, (code, t))
sent = sql(f"select count(*) from training_notification_log where object_id='{aid}'")
print('notification log rows for the activity:', sent)

step('S5-4 the others sign the reading with an e-signature')
for u in ('uat31.s2.qa.fail', 'uat31.s2.qc.pass', 'uat31.s2.qc.fail1', 'uat31.s2.pr.fail'):
    c = U(u)
    code, d, t = attempt(c, 'POST', f'/training/me/participations/{pid[u]}/confirm-read', {'signatureToken': sign(c), 'reason': 'UAT31 I read the document and understood it'})
    check(f'S5-4 {u} signs the reading', code == 200, (code, t))
for u in (LEAVER, LONGLEAVE):
    code, d, t = attempt(admin, 'POST', f'/training/participants/{pid[u]}/cannot-read', {'signatureToken': sign(admin), 'reason': 'UAT31 ' + ('left the company on ' + TODAY.isoformat() if u == LEAVER else 'on a long leave (maternity)')})
    check(f'S5-4.1 {u} is recorded with Cannot Read (reason + e-signature)', code == 200, (code, t))
b.shot('admin', WS, 'S5-06', 'Workspace_reading_step_all_recorded', 'Session Workspace, bước Reading: 5 người đã ký điện tử, 2 người ghi Cannot Read (nghỉ việc / nghỉ dài hạn)', action=tab('Reading'))

step('S5-5 the head of each department confirms with an e-signature (remarks in APD.0108)')
for dept, head in HEAD.items():
    h = U(head)
    code, d, t = attempt(h, 'POST', f'/training/activities/{aid}/verify-self-reading', {'signatureToken': sign(h), 'reason': f'UAT31 Head of {dept}: the people of the department read the document; people who left or are on leave are recorded Absent'})
    check(f'S5-5 the head of {dept} confirms', code == 200, (code, t))
check('S5-5.1 Finish Training is offered once all three departments are confirmed', get(aid)['capabilities'].get('finishTraining') is True, get(aid)['capabilities'].get('finishTraining'))
b.shot('admin', WS, 'S5-07', 'Workspace_results_step_departments_confirmed', 'Session Workspace, bước Results: 3 phòng đã được trưởng bộ phận xác nhận, sẵn sàng Finish Training', action=tab('Results'))

step('S5-6 APD.0108, one list for each department')
for fmt in ('docx', 'pdf'):
    st, body = get_bytes(admin, f'/training/sessions/{sid}/self-reading-list?format={fmt}')
    check(f'S5-6.1 APD.0108 ({fmt}) downloads', st == 200, st)
    if st != 200:
        continue
    files = {}
    if body[:2] == b'PK' and fmt == 'pdf' or (body[:2] == b'PK' and b'word/' not in body[:3000] and fmt == 'docx' and b'[Content_Types]' not in body[:200]):
        z = _zip.ZipFile(io.BytesIO(body))
        files = {n: z.read(n) for n in z.namelist()}
    elif body[:2] == b'PK' and fmt == 'docx':
        try:
            z = _zip.ZipFile(io.BytesIO(body))
            if any(n.endswith('.docx') for n in z.namelist()):
                files = {n: z.read(n) for n in z.namelist()}
            else:
                files = {'APD0108.docx': body}
        except Exception:
            files = {'APD0108.docx': body}
    else:
        files = {'APD0108.pdf': body}
    print(fmt, 'files:', list(files))
    for n, data in files.items():
        dept = next((d for d in HEAD if d in n), None) or 'dept'
        ext = 'pdf' if data[:4] == b'%PDF' else 'docx'
        save_apd('S5-08', 'APD0108_' + re.sub(r'[^A-Za-z0-9]+', '_', dept), f'APD.0108 danh sách tự đọc của phòng {dept}: chữ ký điện tử của từng nhân viên, người ghi Vắng mặt (nghỉ việc / nghỉ dài hạn), xác nhận của trưởng bộ phận', data, ext, pages=2)
        text = pdf_text(data) if ext == 'pdf' else words(data)
        if dept == 'Quality Control':
            check('S5-6.2 APD.0108 of Quality Control marks the person who left "Vắng mặt" and shows the signed people', 'Vắng mặt' in text and name_of('uat31.s2.qc.pass') in text, text[:300])
        if dept == 'Quality Assurance':
            check('S5-6.3 APD.0108 of Quality Assurance marks the person on long leave "Vắng mặt"', 'Vắng mặt' in text and name_of(LONGLEAVE) in text, text[:300])

step('S5-7 Finish Training and QA confirmation')
f, c = finish_and_confirm(aid)
check('S5-7.1 Finish Training', f[0] == 200, (f[0], f[2]))
check('S5-7.2 QA confirms: Completed', c[0] == 200 and get(aid)['status'] == 'COMPLETED', (c[0], c[2]))
b.shot('admin', A, 'S5-09', 'Activity_self_reading_completed_signatures', 'Activity tự đọc đã Completed: tab Signatures (chữ ký của nhân viên, trưởng bộ phận, người tổ chức, QA)', action=tab('Signatures'))
ov = admin.call('GET', f'/training/activities/{aid}/overview')
cands = {x['fullName']: x.get('canOfferSupplementary') for x in ov.get('supplementaryCandidates', [])}
print('candidates:', cands)
check('S5-7.3 both the person who left and the person on long leave are blocked from a make-up while the account is closed', cands.get(name_of(LEAVER)) is False and cands.get(name_of(LONGLEAVE)) is False, cands)
set_status(LONGLEAVE, 'Active')
ov = admin.call('GET', f'/training/activities/{aid}/overview')
cands = {x['fullName']: x.get('canOfferSupplementary') for x in ov.get('supplementaryCandidates', [])}
check('S5-7.4 when the long leave ends (account Active) the person can be offered the make-up; the one who left still cannot', cands.get(name_of(LONGLEAVE)) is True and cands.get(name_of(LEAVER)) is False, cands)
b.shot('admin', A, 'S5-10', 'Activity_self_reading_notice_make_up', 'Activity tự đọc sau khi người nghỉ dài hạn trở lại (Active): thông báo cần bố trí đào tạo bù cho 1 người, 1 người không thể bù (đã nghỉ việc)', action=tab('General Information'))
state['s5'] = S
save(state)
finish('p5', b)
