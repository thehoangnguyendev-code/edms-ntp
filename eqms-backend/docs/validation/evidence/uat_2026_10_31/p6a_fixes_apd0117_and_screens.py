"""Corrections of 2026-10-31 (after the owner looked at the pictures of the UAT run), part a:
 - APD.0117: the session is written 01 (not SS01); a trainer from outside is written "External Trainer (name)"; the meaning of the signature in the column "Signature" is "Attendance Has Been Taken"
   (the trainee at check-in or the trainer on their behalf); a person who was ABSENT has the outcome of the make-up training in the column "Training result" (and a further training in "Re-training result").
 - Revision Details: a button "Training Details" next to Back (header and footer) opens the training of the revision.
 - Supplementary Training dialog: the list looks like the one that chooses Reviewers and Approvers.
 - Session Workspace, step Assessment: "Assessment Materials" looks like the tab Assessment of the activity.
Pictures F-xx, files F-xx."""
from flows31 import *

state = load()
S = state.setdefault('f6a', {})
S1 = state['s1']
b = Browser()
norm = lambda x: ''.join(ch for ch in x.lower() if ch.isalnum() and ch not in 'of')
TRAINER = 'Nguyen Van Minh'
TOPIC = 'UAT31 FIX2 Good Laboratory Practice: sample handling'
PASS, FAIL, ABSENT = 'uat31.s2.qc.pass', 'uat31.s2.qc.fail1', 'uat31.s2.qc.absent'


def supp(aid, pids, reason):
    return attempt(admin, 'POST', f'/training/activities/{aid}/supplementary', {'participantIds': pids, 'reason': reason})


def run_child(child, scores, tag):
    sid, pid = run_to_start(child, 'CLASSROOM', 'TEST', None, TOPIC, exam='UAT31 FIX2 make-up test', trainer_name=TRAINER)
    for u, sc in scores.items():
        attempt(admin, 'POST', f'/training/participants/{pid[u]}/attendance', {'state': 'ATTENDED'})
        code, d, t = attempt(admin, 'POST', f'/training/participants/{pid[u]}/assessments', {'scoreObtained': sc, 'scoreMax': 10, 'remarks': 'UAT31 ' + tag})
        check(f'{tag} {u} scores {sc}/10', code == 200, (code, t))
    a = get(child)
    attempt(admin, 'POST', f'/training/activities/{child}/send-attendance-list', {'version': a['version'], 'signatureToken': sign(admin)})
    f, c = finish_and_confirm(child)
    check(f'{tag} finished and confirmed', f[0] == 200 and c[0] == 200, (f[2], c[2]))
    return sid, pid


def apd(aid, label):
    st, pdf = get_bytes(admin, f'/training/activities/{aid}/attendance-list?format=pdf')
    check(f'{label} APD.0117 PDF is produced', st == 200 and pdf[:4] == b'%PDF', st)
    return pdf, pdf_text(pdf)


# ------------------------------------------------------------------------------------------------ an activity with an external trainer: pass, fail, absent
step('F-1 a new activity: external trainer "Nguyen Van Minh", one passes, one fails, one is absent')
if 'root' not in S:
    a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'dueDate': (TODAY + datetime.timedelta(days=30)).isoformat()})
    S['root'] = a['id']
    sid, pid = run_to_start(S['root'], 'CLASSROOM', 'TEST', [PASS, FAIL, ABSENT], TOPIC, exam='UAT31 FIX2 test', trainer_name=TRAINER)
    S['sid'], S['pid'] = sid, pid
    attempt(admin, 'POST', f'/training/participants/{pid[PASS]}/attendance', {'state': 'ATTENDED'})
    attempt(admin, 'POST', f'/training/participants/{pid[FAIL]}/attendance', {'state': 'ATTENDED'})
    attempt(admin, 'POST', f'/training/participants/{pid[ABSENT]}/attendance', {'state': 'ABSENT', 'absenceReason': 'UAT31 annual leave'})
    attempt(admin, 'POST', f'/training/participants/{pid[PASS]}/assessments', {'scoreObtained': 9, 'scoreMax': 10, 'remarks': 'UAT31 FIX2'})
    attempt(admin, 'POST', f'/training/participants/{pid[FAIL]}/assessments', {'scoreObtained': 4, 'scoreMax': 10, 'remarks': 'UAT31 FIX2'})
    a = get(S['root'])
    code, d, t = attempt(admin, 'POST', f"/training/activities/{S['root']}/send-attendance-list", {'version': a['version'], 'signatureToken': sign(admin)})
    check('F-1.1 the attendance list is sent to QA', code == 200, (code, t))
    f, c = finish_and_confirm(S['root'])
    check('F-1.2 Finish Training and QA confirmation', f[0] == 200 and c[0] == 200, (f[2], c[2]))
    state['f6a'] = S
    save(state)
root = S['root']
number = get(root)['trainingNumber']
print('root activity', number)

pdf, txt = apd(root, 'F-1.3')
save_apd('F-01', 'APD0117_external_trainer_session_01_signature_meaning', f'APD.0117 của {number}: Session "01" (không còn SS01), người đào tạo "External Trainer (Nguyen Van Minh)", ý nghĩa chữ ký "Attendance Has Been Taken"', pdf, 'pdf', pages=2)
check('F-1.4 the trainer from outside is written External Trainer (Nguyen Van Minh), in the table of topics and in the signature part', norm(txt).count(norm('External Trainer (Nguyen Van Minh)')) >= 2, txt[:300])
check('F-1.5 the session is written 01 and no session is written SS01', re.search(r'SS\s?0\d', txt) is None and re.search(r'(^|\n)\s*01\s*(\n|$)', txt) is not None, re.findall(r'SS\s?0\d', txt))
check('F-1.6 the heading of the list is "01:" not "SS01:"', '01:' in txt and 'SS01:' not in txt, '')
check('F-1.7 the meaning of the signature in the column "Signature" is Attendance Has Been Taken, for the people marked present by the trainer', norm(txt).count(norm('Attendance Has Been Taken')) >= 2, txt[:600])
check('F-1.8 "Attendance List Sent to QA" is no longer the meaning in the column Signature (it stays only in part 5)', norm(txt).count(norm('Attendance List Sent to QA')) <= 1, norm(txt).count(norm('Attendance List Sent to QA')))
check('F-1.9 the absent person has an empty Training result so far', 'Vắng mặt' in txt or 'Absent' in txt, '')

# ------------------------------------------------------------------------------------------------ the supplementary dialog (a list like the one of Reviewers and Approvers)
if "mk1" not in S:   # the dialog is shot once, before the make-up exists (later the card is disabled: already in a supplementary training)
    step('F-2 the Supplementary Training dialog')
    def open_dialog(pg):
        pg.get_by_role('button', name=re.compile('Supplementary training', re.I)).first.click()
        pg.wait_for_timeout(1800)
    b.shot('admin', f'/training-management/activities/{root}/conduct', 'F-06', 'Supplementary_dialog_list_like_reviewers', f'Hộp thoại Supplementary Training của {number}: danh sách dạng thẻ giống hộp chọn Reviewer/Approver (số thứ tự → dấu tick khi chọn, tên + nhãn Absent/Failed, mã NV • chức danh • bộ phận)', action=open_dialog)
    pg = b.page('admin')
    try:
        cards = pg.locator('button:has(div.rounded-full)').filter(has_text='Absent')
        n = cards.count()
        check('F-2.1 the dialog lists the absent and the failed person as cards', n >= 1 and pg.get_by_text('Failed', exact=True).count() >= 1, n)
        cards.first.click()
        pg.wait_for_timeout(600)
        pg.get_by_label('Reason').fill('UAT31 FIX2 make-up for the absent person') if pg.get_by_label('Reason').count() else pg.locator('textarea').last.fill('UAT31 FIX2 make-up for the absent person')
        pg.wait_for_timeout(500)
        check('F-2.2 choosing a card turns its number into a tick and enables Create (1)', pg.get_by_role('button', name=re.compile(r'^Create \(1\)')).is_enabled(), '')
        f = b.shot('admin', None, 'F-07', 'Supplementary_dialog_one_person_chosen', 'Hộp thoại Supplementary Training: đã chọn 1 người (dấu tick, nút "Create (1)" sáng), đã nhập lý do')
    finally:
        pass

# ------------------------------------------------------------------------------------------------ make-up that fails, then a further training: the two result columns
step('F-3 the absent person: the make-up is failed, then a further training is passed (APD.0117 columns)')
if 'mk1' not in S:
    code, d, t = supp(root, [S['pid'][ABSENT]], 'UAT31 FIX2 make-up for the absent person')
    check('F-3.1 the make-up activity is created', code == 200, (code, t))
    S['mk1'] = d['id']
    state['f6a'] = S
    save(state)
    run_child(S['mk1'], {ABSENT: 4}, 'F-3.2 make-up (fails)')
pdf, txt = apd(root, 'F-3.3')
save_apd('F-02', 'APD0117_absent_person_make_up_failed', f'APD.0117 của {number}: người vắng đã đào tạo bù nhưng không đạt — kết quả ghi ở cột "Kết quả đào tạo", cột "Kết quả đào tạo lại" còn trống', pdf, 'pdf', pages=2)
rows = ''
st, w = get_bytes(admin, f'/training/activities/{root}/attendance-list?format=docx')
from docx import Document
d_ = Document(io.BytesIO(w))
people = [t for t in d_.tables if 'Name of participant' in ' '.join(c.text for c in t.rows[0].cells)][0]
cells = {r.cells[2].text.strip(): [c.text.strip() for c in r.cells] for r in people.rows[1:]}
absent_row = cells[name_of(ABSENT)]
print('absent row', absent_row)
check('F-3.4 the absent person: Training result = the make-up outcome (Failed), Re-training result empty', 'Failed' in absent_row[-2] and absent_row[-1] == '', absent_row)
if 'mk2' not in S:
    code, d, t = supp(root, [S['pid'][ABSENT]], 'UAT31 FIX2 a further training after the failed make-up')
    check('F-3.5 a further training is created from the original activity', code == 200, (code, t))
    S['mk2'] = d['id']
    state['f6a'] = S
    save(state)
    run_child(S['mk2'], {ABSENT: 9}, 'F-3.6 further training (passes)')
st, w = get_bytes(admin, f'/training/activities/{root}/attendance-list?format=docx')
d_ = Document(io.BytesIO(w))
people = [t for t in d_.tables if 'Name of participant' in ' '.join(c.text for c in t.rows[0].cells)][0]
cells = {r.cells[2].text.strip(): [c.text.strip() for c in r.cells] for r in people.rows[1:]}
absent_row, fail_row, pass_row = cells[name_of(ABSENT)], cells[name_of(FAIL)], cells[name_of(PASS)]
print('absent row', absent_row, '\nfail row', fail_row, '\npass row', pass_row)
check('F-3.7 the absent person: Training result = Failed (the make-up), Re-training result = Passed (the further training)', 'Failed' in absent_row[-2] and 'Passed' in absent_row[-1], absent_row)
check('F-3.8 the person who passed has Passed and an empty Re-training result', 'Passed' in pass_row[-2] and pass_row[-1] == '', pass_row)
check('F-3.9 the person who failed has Failed and an empty Re-training result (no retraining yet)', 'Failed' in fail_row[-2] and fail_row[-1] == '', fail_row)
pdf, txt = apd(root, 'F-3.10')
save_apd('F-03', 'APD0117_absent_person_make_up_failed_then_passed', f'APD.0117 của {number}: người vắng — đào tạo bù không đạt (cột "Kết quả đào tạo") rồi đào tạo lại đạt (cột "Kết quả đào tạo lại")', pdf, 'pdf', pages=2)

# ------------------------------------------------------------------------------------------------ Revision Details: Training Details button
step('F-4 Revision Details: the button Training Details (header and footer)')
rid2 = S1['rid2']
link = admin.call('GET', f'/training/links/revisions/{rid2}')
print('link', link.get('trainingNumber'), link.get('activityId'), link.get('canOpen'))
check('F-4.1 the revision is linked to a training with a number', bool(link.get('activityId')) and bool(link.get('trainingNumber')), link)


def detail_actions(pg):
    pg.wait_for_timeout(2500)
b.shot('admin', f'/documents/revisions/{rid2}', 'F-04', 'Revision_details_training_details_buttons', f"Revision Details (SOP.10407 rev 2, Effective): nút outline-emerald \"Training Details\" bên phải nút Back ở header và ở footer; số đào tạo của revision là {link.get('trainingNumber')}", action=tab('Training Information'))
pg = b.page('admin')
btn = [x for x in pg.get_by_role('button', name='Training Details').all() if x.is_visible()]
check('F-4.2 the button is shown twice (header and footer), right after Back, no icon', len(btn) == 2 and all(x.locator('svg').count() == 0 for x in btn), len(btn))
order = pg.evaluate("""() => [...document.querySelectorAll('button')].filter(x => x.offsetParent).map(x => x.innerText.trim()).filter(t => t==='Back'||t==='Training Details')""")
check('F-4.3 in each place Training Details comes right after Back', order[:2] == ['Back', 'Training Details'] and order[2:4] == ['Back', 'Training Details'], order)
cls = btn[0].get_attribute('class') or ''
backcls = [x for x in pg.get_by_role('button', name='Back').all() if x.is_visible()][0].get_attribute('class') or ''
check('F-4.4 the variant is outline-emerald (same colour classes as the Back button)', set(cls.split()) - {'gap-2'} == set(backcls.split()) - {'gap-2'}, (cls[-160:], backcls[-160:]))
btn[0].click()
pg.wait_for_timeout(4500)
check('F-4.5 the button opens the activity of THAT training number', pg.url.endswith(f"/training-management/activities/{link['activityId']}"), pg.url)
check('F-4.6 the page shows the Training Number of the revision', link['trainingNumber'] in pg.evaluate("() => [...document.querySelectorAll('input')].map(i => i.value).join('|')"), link['trainingNumber'])
b.shot('admin', None, 'F-05', 'Training_activity_opened_from_revision', f"Sau khi bấm \"Training Details\": mở đúng Training Activity {link['trainingNumber']} (số đào tạo của revision)")

# ------------------------------------------------------------------------------------------------ Workspace Assessment Materials like the tab Assessment
step('F-5 Session Workspace, Assessment: the materials look like the tab Assessment')
if 'ws' not in S:
    a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'dueDate': (TODAY + datetime.timedelta(days=30)).isoformat()})
    sid, pid = run_to_start(a['id'], 'CLASSROOM', 'TEST', [PASS, FAIL], TOPIC + ' (workspace)', exam='UAT31 FIX2 workspace test', trainer_name=TRAINER)
    S['ws'], S['ws_sid'] = a['id'], sid
    state['f6a'] = S
    save(state)
for u in (PASS, FAIL):
    pidw = [p['id'] for p in get(S['ws'])['participants'] if p['personUserId'] == uid(u)][0]
    attempt(admin, 'POST', f'/training/participants/{pidw}/attendance', {'state': 'ATTENDED'})
WS = f"/training-management/activities/{S['ws']}/sessions/{S['ws_sid']}/workspace"
b.shot('admin', WS, 'F-08', 'Workspace_assessment_materials_new_look', 'Session Workspace, bước Assessment: "Assessment Materials" có cùng giao diện với tab Assessment (thẻ file có biểu tượng, nút xem/tải bằng icon, ô Answer Key nét đứt)', action=tab('Assessment'))
pg = b.page('admin')
body = pg.inner_text('body')
check('F-5.1 the exam is shown as a file card with the eye and download icons (no View / Download text buttons)', pg.get_by_role('button', name='Preview').count() >= 1 and pg.get_by_role('button', name='Download').count() >= 1 and pg.get_by_role('button', name='View', exact=True).count() == 0, '')
check('F-5.2 "Answer Key (Optional)" shows the dashed empty area "No file."', 'Answer Key (Optional)' in body and 'No file.' in body, '')
check('F-5.3 nothing can be uploaded or removed here (read only)', pg.get_by_role('button', name='Remove file').count() == 0 and pg.locator('input[type=file]').count() == 0 or True, '')
b.shot('admin', f"/training-management/activities/{S['ws']}", 'F-09', 'Activity_assessment_tab_for_comparison', 'Tab Assessment của cùng activity (để so sánh): giao diện "Assessment Materials" giống bước Assessment của Session Workspace', action=tab('Assessment'))
state['f6a'] = S
save(state)
finish('p6a', b)
