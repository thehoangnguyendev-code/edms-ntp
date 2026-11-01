"""Scenario 5, part d: AFTER the fix (own screen for the employee: GET /training/me/participations/{id}, page /training-management/participations/{id}). A new self-reading with two QC employees: the first signs THROUGH THE
SCREEN with the e-signature window (My Training -> the training -> "I have read and understood" -> password), the second tries the invitation of the first (denied) and signs. The head confirms, the trainer finishes, QA confirms.
Pictures S5-17.. ; the denied pictures S5-02 / S5-12 of the first run stay as the evidence of the defect (before the fix)."""
from flows31 import *

state = load()
S = state.setdefault('s5d', {})
b = Browser()
EMP_UI, EMP_API = 'uat31.s2.qc.pass', 'uat31.s2.qc.fail1'
TOPIC = 'UAT31 Good documentation practice: second look, after the fix'
if 'aid' not in S:
    a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'dueDate': (TODAY + datetime.timedelta(days=10)).isoformat()})
    S['aid'] = a['id']
    sid, pid = run_to_start(S['aid'], 'SELF_READING', 'SELF_READING_CONFIRMATION', [EMP_UI, EMP_API], TOPIC)
    S['sid'], S['pid'] = sid, pid
    save(state)
aid, sid, pid = S['aid'], S['sid'], S['pid']
number = get(aid)['trainingNumber']
print('activity', number)

step('S5d-1 the access rules of the new endpoint')
e1, e2 = U(EMP_UI), U(EMP_API)
code, d, t = attempt(e1, 'GET', f'/training/me/participations/{pid[EMP_UI]}')
check('S5d-1.1 the invited employee reads their own invitation with training.self.view only', code == 200 and d.get('canConfirmRead') is True, (code, t))
check('S5d-1.2 the answer holds no other participant and no result of another person', 'participants' not in d and 'selfReadingDepartments' not in d, list(d.keys()))
code, d, t = attempt(e2, 'GET', f'/training/me/participations/{pid[EMP_UI]}')
check('S5d-1.3 another employee cannot read the invitation of the first (403)', code == 403, (code, t))
code, d, t = attempt(e1, 'GET', f'/training/activities/{aid}')
check('S5d-1.4 the activity itself is still not opened to the employee (403)', code == 403, (code, t))
code, d, t = attempt(e2, 'POST', f'/training/me/participations/{pid[EMP_UI]}/confirm-read', {'signatureToken': sign(e2)})
check('S5d-1.5 another employee cannot sign for the first (403)', code == 403, (code, t))

step('S5d-2 the employee signs through the screen')
pg = b.page(EMP_UI)
pg.set_default_timeout(20000)
pg.goto(BASE + '/training-management/my-training', wait_until='domcontentloaded')
pg.wait_for_timeout(4500)
b.shot(EMP_UI, None, 'S5-17', 'After_fix_My_Training_to_do', f'Sau khi sửa: My Training của nhân viên Đỗ Thị Lan có đào tạo tự đọc {number}')
ui_note = ''
try:
    pg.get_by_text(number, exact=True).first.click()
    pg.wait_for_timeout(4000)
    b.shot(EMP_UI, None, 'S5-18', 'After_fix_Self_reading_screen_of_the_employee', f'Sau khi sửa: màn Self-Reading riêng cho nhân viên ({number}): đào tạo, hạn, tài liệu cần đọc, nút "I have read and understood"')
    pg.get_by_role('button', name='I have read and understood').first.click()
    pg.wait_for_timeout(2500)
    b.shot(EMP_UI, None, 'S5-19', 'After_fix_E_signature_window_opened', 'Cửa sổ ký điện tử mở ra khi nhân viên bấm "I have read and understood"')
    un = pg.get_by_placeholder('Enter your username')
    if un.count():
        un.first.fill(EMP_UI)
    pw = pg.locator('input[type=password]')
    pw.first.fill(PW)
    ta = pg.locator('textarea')
    if ta.count():
        ta.first.fill('UAT31 I read the document and understood it')
    b.shot(EMP_UI, None, 'S5-20', 'After_fix_E_signature_window_filled', 'Cửa sổ ký điện tử: nhân viên nhập lý do và mật khẩu (mật khẩu bị ẩn) để ký xác nhận đã đọc')
    btns = [x for x in pg.get_by_role('button').all() if x.is_visible() and re.search(r'^(sign|confirm|submit|e-?sign)', x.inner_text().strip(), re.I)]
    print('submit candidates:', [x.inner_text().strip() for x in btns])
    btns[-1].click()
    pg.wait_for_timeout(4500)
    b.shot(EMP_UI, None, 'S5-21', 'After_fix_Employee_signed_on_screen', 'Sau khi nhân viên ký điện tử trên màn hình: "You confirmed the reading", không còn nút ký')
except Exception as e:
    ui_note = 'UI: ' + str(e)[:300]
states = {p['id']: p['state'] for p in get(aid)['participants']}
check('S5d-2.1 the employee signed the reading through the screen (e-signature window)', states[pid[EMP_UI]] == 'READ_CONFIRMED', ui_note)
sig = sql(f"select count(*) from electronic_signatures where signer_user_id='{uid(EMP_UI)}' and meaning_code='TRAINING_READ_CONFIRMED' and created_at > now() - interval '30 minutes'") if sql("select to_regclass('electronic_signatures')")[0][0] else None
print('e-signature rows (meaning TRAINING_READ_CONFIRMED) in the last 30 minutes:', sig)
code, d, t = (200, {}, '') if {p['id']: p['state'] for p in get(aid)['participants']}[pid[EMP_API]] == 'READ_CONFIRMED' else attempt(e2, 'POST', f'/training/me/participations/{pid[EMP_API]}/confirm-read', {'signatureToken': sign(e2), 'reason': 'UAT31 I read the document and understood it'})
check('S5d-2.2 the second employee signs', code == 200, (code, t))
h = U('uat31.head.qc')
code, d, t = attempt(h, 'POST', f'/training/activities/{aid}/verify-self-reading', {'signatureToken': sign(h), 'reason': 'UAT31 Head of Quality Control: both people read the document'})
check('S5d-2.3 the head of Quality Control confirms', code == 200, (code, t))
f, cc = finish_and_confirm(aid)
check('S5d-2.4 Finish Training and QA confirmation: Completed', f[0] == 200 and cc[0] == 200 and get(aid)['status'] == 'COMPLETED', (f[2], cc[2]))
b.shot('admin', f'/training-management/activities/{aid}', 'S5-22', 'After_fix_Activity_signatures_tab', f'Activity {number} đã Completed: tab Signatures có chữ ký điện tử của nhân viên (ký trên màn hình), trưởng bộ phận, người tổ chức, QA', action=tab('Signatures'))
st, w = get_bytes(admin, f'/training/sessions/{sid}/self-reading-list?format=pdf')
if st == 200:
    data = w
    if data[:2] == b'PK':
        import zipfile
        z = zipfile.ZipFile(io.BytesIO(data))
        data = z.read(z.namelist()[0])
    save_apd('S5-23', 'APD0108_Quality_Control_signed_on_screen_after_fix', f'APD.0108 phòng Quality Control ({number}): nhân viên ký điện tử trên màn hình + trưởng bộ phận xác nhận', data, 'pdf', pages=1)
    txt = pdf_text(data)
    norm = lambda x: ''.join(ch for ch in x.lower() if ch.isalnum() and ch not in 'of')
    check('S5d-2.5 APD.0108 shows both employees, the head and the e-signature blocks', all(norm(name_of(u)) in norm(txt) for u in (EMP_UI, EMP_API, 'uat31.head.qc')) and txt.count('UTC+') >= 3, txt[:200])
state['s5d'] = S
save(state)
finish('p5d', b)
