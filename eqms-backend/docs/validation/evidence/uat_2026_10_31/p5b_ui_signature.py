"""Scenario 5, part b: the employee signs the reading THROUGH THE SCREEN (My Training -> the training -> confirm with the e-signature window). A small self-reading activity with two QC employees is made for it:
one signs through the screen, the other through the API; the head of Quality Control confirms; the trainer finishes; QA confirms. Pictures S5-11.. show every step of the screen."""
from flows31 import *

state = load()
S = state.setdefault('s5b', {})
b = Browser()
EMP_UI, EMP_API = 'uat31.s2.qc.pass', 'uat31.s2.qc.fail1'
TOPIC = 'UAT31 Good documentation practice: how to correct an entry'
if 'aid' not in S:
    a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'dueDate': (TODAY + datetime.timedelta(days=10)).isoformat()})
    S['aid'] = a['id']
    sid, pid = run_to_start(S['aid'], 'SELF_READING', 'SELF_READING_CONFIRMATION', [EMP_UI, EMP_API], TOPIC)
    S['sid'], S['pid'] = sid, pid
    save(state)
aid, pid = S['aid'], S['pid']
number = get(aid)['trainingNumber']
print('activity', number)

pg = b.page(EMP_UI)
pg.set_default_timeout(20000)
pg.goto(BASE + '/training-management/my-training', wait_until='domcontentloaded')
pg.wait_for_timeout(4500)
b.shot(EMP_UI, None, 'S5-11', 'My_Training_employee_sees_the_self_reading', f'My Training của nhân viên Đỗ Thị Lan: việc cần làm có đào tạo tự đọc {number}')
note_ui = ''
try:
    pg.get_by_text(number, exact=True).first.click()
    pg.wait_for_timeout(4000)
    b.shot(EMP_UI, None, 'S5-12', 'Employee_opens_the_training', f'Nhân viên mở đào tạo {number} từ My Training: nội dung cần đọc và xác nhận')
    print('buttons after opening:', [x.inner_text().strip()[:40] for x in pg.get_by_role('button').all() if x.is_visible() and x.inner_text().strip()][-12:])
    cands = [x for x in pg.get_by_role('button').all() if x.is_visible() and re.search(r'read|confirm|sign', x.inner_text(), re.I)]
    print('candidate buttons:', [x.inner_text().strip() for x in cands])
    if cands:
        cands[0].click()
        pg.wait_for_timeout(2500)
        pw = pg.locator('input[type=password]')
        if pw.count():
            pw.first.fill(PW)
            reason = pg.locator('textarea')
            if reason.count():
                reason.first.fill('UAT31 I read the document and understood it')
            b.shot(EMP_UI, None, 'S5-13', 'E_signature_window_filled', 'Cửa sổ ký điện tử của nhân viên: nhập lý do và mật khẩu để ký xác nhận đã đọc và hiểu')
            done = [x for x in pg.get_by_role('button').all() if x.is_visible() and re.search(r'^(sign|confirm|submit)', x.inner_text().strip(), re.I)]
            print('submit candidates:', [x.inner_text().strip() for x in done])
            (done[-1] if done else cands[0]).click()
            pg.wait_for_timeout(4000)
            b.shot(EMP_UI, None, 'S5-14', 'After_the_employee_signed_on_screen', 'Sau khi nhân viên ký điện tử trên màn hình: đã xác nhận đã đọc')
        else:
            note_ui = 'no password field after the click'
    else:
        note_ui = 'no confirm button'
except Exception as e:
    note_ui = 'UI: ' + str(e)[:200]
states = {p['id']: p['state'] for p in get(aid)['participants']}
check('S5b.1 the employee signed the reading through the screen (e-signature window)', states[pid[EMP_UI]] == 'READ_CONFIRMED', note_ui)
if states[pid[EMP_UI]] != 'READ_CONFIRMED':
    print('NOTE UI signing did not complete:', note_ui)
    c = U(EMP_UI)
    attempt(c, 'POST', f'/training/me/participations/{pid[EMP_UI]}/confirm-read', {'signatureToken': sign(c), 'reason': 'UAT31 fallback through the API'})
c = U(EMP_API)
code, d, t = attempt(c, 'POST', f'/training/me/participations/{pid[EMP_API]}/confirm-read', {'signatureToken': sign(c), 'reason': 'UAT31 I read the document and understood it'})
check('S5b.2 the second employee signs (API)', code == 200, (code, t))
sig = sql(f"select count(*) from electronic_signatures where signer_user_id='{uid(EMP_UI)}' and created_at > now() - interval '1 hour'")
print('e-signature rows of the employee in the last hour:', sig)
h = U('uat31.head.qc')
code, d, t = attempt(h, 'POST', f'/training/activities/{aid}/verify-self-reading', {'signatureToken': sign(h), 'reason': 'UAT31 Head of Quality Control: both people read the document'})
check('S5b.3 the head of Quality Control confirms', code == 200, (code, t))
f, cc = finish_and_confirm(aid)
check('S5b.4 Finish Training and QA confirmation', f[0] == 200 and cc[0] == 200 and get(aid)['status'] == 'COMPLETED', (f[2], cc[2]))
b.shot('admin', f'/training-management/activities/{aid}', 'S5-15', 'Activity_signed_on_screen_signatures_tab', f'Activity {number} đã Completed: tab Signatures có chữ ký điện tử của nhân viên, trưởng bộ phận, người tổ chức, QA', action=tab('Signatures'))
st, w = get_bytes(admin, f"/training/sessions/{S['sid']}/self-reading-list?format=pdf")
if st == 200:
    data = w
    if data[:2] == b'PK':
        import zipfile
        z = zipfile.ZipFile(io.BytesIO(data))
        data = z.read(z.namelist()[0])
    save_apd('S5-16', 'APD0108_Quality_Control_signed_on_screen', f'APD.0108 phòng Quality Control ({number}): nhân viên ký điện tử trên màn hình + trưởng bộ phận xác nhận', data, 'pdf', pages=2)
    txt = pdf_text(data)
    check('S5b.5 APD.0108 shows the two employees with the e-signature block and the head', name_of(EMP_UI) in txt and name_of(EMP_API) in txt and name_of('uat31.head.qc') in txt and '(UTC+' in txt, txt[:300])
state['s5b'] = S
save(state)
finish('p5b', b)
