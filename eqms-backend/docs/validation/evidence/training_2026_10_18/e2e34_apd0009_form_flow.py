"""DEV: the real form APD.0009.02 is the template of the assessments. Steps: (1) upload and enable the form from docs/training_docs; (2) design and approve two assessments of the library (a test of questions
with an essay, and a checklist); (3) a training activity with an internal trainer and three trainees: choose the assessment, the topic, the training number, the type and the duration are written in the form;
(4) the test copies are downloaded before the training starts: one file for each of the three trainees (PDF and Word) with their name, ID code, department and the date; (5) the same for a checklist;
(6) the training goes on to its end: attendance, results, the list and the results to QA, the confirmation of QA.
The password comes from DEVPW (never written). Records are titled "E2E-TEST ..."; none is deleted. The files are saved in docs/training_docs/draft/test-run."""
import os, sys, io, zipfile, re, json
sys.path.insert(0, os.path.dirname(__file__))
from api import Client, tick_all
from e2e21_matrix import mini_pdf, attempt, check, sign, results, admin, qa, trainee as content_approver, get, TODAY

OUT = os.environ.get('E2E_OUT') or r'D:\edms-project\docs\training_docs\draft\test-run'
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    os.remove(os.path.join(OUT, f))
FORM = r'D:\edms-project\docs\training_docs\APD.0009.02 Training assessment.docx'
trainer = Client('trainer.test1')
designer = admin
approver = qa                      # approver.test1 reviews the content and approves the assessments
t1, t2, t3 = Client('trainee.test1'), Client('trainee.test2'), Client('dco.test1')
TRAINEES = [t1, t2, t3]
TOPIC = 'SOP.0009 Thẩm định thiết bị và hệ thống (Phiên bản 2.0.0)/ Qualification of equipment and system (Version 2.0.0)'
CHECK_TOPIC = 'SOP.0021 Lấy mẫu vô trùng (Phiên bản 1.0.0)/ Aseptic sampling (Version 1.0.0)'
DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'


def step(title):
    print(chr(10) + '== ' + title)


def docx_text(b):
    z = zipfile.ZipFile(io.BytesIO(b))
    return re.sub(r'<[^>]+>', ' ', ''.join(z.read(n).decode('utf8') for n in z.namelist() if n.startswith('word/') and n.endswith('.xml') and ('document' in n or 'header' in n or 'footer' in n)))


step('1. the real form APD.0009.02 is uploaded and enabled')
label = '2.0.0 (APD.0009.02)'
mine = [t for t in designer.call('GET', '/training/form-templates?search=APD.0009&limit=20')['data'] if t['versionLabel'] == label]
if not mine:
    with open(FORM, 'rb') as f:
        mine = [designer.upload('/training/form-templates', 'file', 'APD.0009.02 Training assessment.docx', f.read(), DOCX,
                                '?code=APD.0009&title=Training%20assessment&versionLabel=' + label.replace(' ', '%20') + '&remark=The%20form%20of%20the%20company')]
tpl = mine[0]
if tpl['status'] != 'ENABLED':
    tpl = designer.call('POST', f"/training/form-templates/{tpl['id']}/enable", {'signatureToken': sign(designer), 'reason': 'E2E-TEST the real form APD.0009.02'})
check('1.1 the real form is the enabled APD.0009', tpl['status'] == 'ENABLED' and tpl['versionLabel'] == label, tpl)

step('2. the library: a test with an essay and a checklist, approved by another person')
QUESTIONS = [
    {'kind': 'SINGLE', 'prompt': 'Dựa theo khuyến nghị của ISPE, hệ thống, thiết bị và cơ sở vật chất (không bao gồm thiết bị phân tích) được phân loại thành mấy nhóm?', 'options': [{'text': '4 nhóm'}, {'text': '3 nhóm'}, {'text': '2 nhóm'}, {'text': '1 nhóm'}], 'correct': ['B'], 'points': 1},
    {'kind': 'SINGLE', 'prompt': 'Đơn vị nào chịu trách nhiệm đánh giá tác động của thiết bị hoặc hệ thống theo APD.0025?', 'options': [{'text': 'ME'}, {'text': 'QA'}, {'text': 'INJ'}, {'text': 'Thiết bị, hệ thống thuộc đơn vị nào thì đơn vị đó phụ trách'}], 'correct': ['B'], 'points': 1},
    {'kind': 'SINGLE', 'prompt': 'Trong một thử nghiệm thẩm định phát hiện sai lệch thì phương án xử lý như thế nào?', 'options': [{'text': 'Báo cáo sai lệch theo hướng dẫn của SOP.0005 Quản lý sai lệch'}, {'text': 'Thông báo cho trưởng nhóm thẩm định xem xét'}, {'text': 'Không báo cáo, tiếp tục tiến hành thẩm định'}, {'text': 'Không có ý nào đúng'}], 'correct': ['A'], 'points': 1},
    {'kind': 'MULTI', 'prompt': 'Những thử nghiệm nào cần thực hiện tại thẩm định lắp đặt thiết bị?', 'options': [{'text': 'Kiểm tra chứng chỉ vật liệu'}, {'text': 'Kiểm tra vận hành cơ bản'}, {'text': 'Kiểm tra Panel điều khiển và mức độ truy cập'}, {'text': 'Kiểm tra chức năng hệ thống máy tính'}], 'correct': ['A', 'C'], 'points': 2},
    {'kind': 'TRUE_FALSE', 'prompt': 'Thẩm định vận hành chỉ được thực hiện khi báo cáo thẩm định lắp đặt đã được phê duyệt.', 'options': [], 'correct': ['A'], 'points': 1},
    {'kind': 'ESSAY', 'prompt': 'Hãy liệt kê tóm tắt các bước phục vụ thẩm định thiết bị đến khi thiết bị được phép đưa vào vận hành đối với thiết bị nồi hấp của phòng QC.', 'options': [], 'correct': [], 'points': 4,
     'modelAnswer': 'URS; FAT/SAT; thẩm định lắp đặt (IQ); thẩm định vận hành (OQ); thẩm định hiệu năng (PQ); báo cáo tóm tắt thẩm định được phê duyệt; phê duyệt đưa vào sử dụng.'},
]
CHECK = [{'kind': 'CHECK', 'prompt': p, 'options': [], 'correct': [c], 'points': 1} for p, c in (
    ('Rửa tay và sát khuẩn trước khi mặc trang phục vô trùng', 'CORRECT'), ('Mang găng tay đã khử trùng khi lấy mẫu', 'CORRECT'), ('Có thể dùng lại dụng cụ lấy mẫu mà không cần tiệt trùng', 'INCORRECT'),
    ('Ghi nhãn mẫu ngay sau khi lấy', 'CORRECT'), ('Để mẫu ở khu vực chung chờ bàn giao', 'INCORRECT'), ('Ghi nhật ký lấy mẫu đầy đủ, ký và ghi ngày', 'CORRECT'))]
code, a, text = attempt(designer, 'POST', '/training/assessments', {'title': 'E2E-TEST Kiểm tra đào tạo SOP.0009', 'kind': 'QUESTIONS', 'durationMinutes': 45, 'items': QUESTIONS})
check('2.1 the test is created (total 10 points, 45 minutes)', code == 200 and float(a['maxScore']) == 10 and a['durationMinutes'] == 45, (code, text))
designer.call('POST', f"/training/assessments/{a['id']}/submit")
code, a, text = attempt(approver, 'POST', f"/training/assessments/{a['id']}/approve", {'signatureToken': sign(approver)})
check('2.2 approved by another person: Effective', code == 200 and a['status'] == 'EFFECTIVE', (code, text))
exam_def = a
code, c, text = attempt(designer, 'POST', '/training/assessments', {'title': 'E2E-TEST Checklist lấy mẫu vô trùng', 'kind': 'CHECKLIST', 'items': CHECK})
designer.call('POST', f"/training/assessments/{c['id']}/submit")
code, c, text = attempt(approver, 'POST', f"/training/assessments/{c['id']}/approve", {'signatureToken': sign(approver)})
check('2.3 the checklist is created and approved (no score)', code == 200 and c['status'] == 'EFFECTIVE' and c['maxScore'] is None, (code, text))
check_def = c


def prepare(tag, definition, method, assess, topic, title, with_key_copy):
    """An activity with the internal trainer (an exception approved) and the three trainees, the assessment chosen, the content approved, notified, and the test copies downloaded."""
    code, act, text = attempt(admin, 'POST', '/training/activities', {'kind': 'INITIAL', 'kindReason': 'NEW_HIRE', 'trainingTitle': title})
    check(f'{tag}.0 the activity is created with a Training Number', code == 200 and bool(act.get('trainingNumber')), (code, text))
    aid, number = act['id'], act['trainingNumber']
    s = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': method, 'assessmentMethod': assess, 'trainerUserId': trainer.user['id'], 'scheduledOn': TODAY, 'venue': 'Phòng đào tạo QA', 'topics': [{'topicText': topic}]})
    sid = s['sessions'][0]['id']
    q = [x for x in get(aid)['sessions'] if x['id'] == sid][0]['trainerQualification']
    check(f'{tag}.1 the internal trainer has no training record on GMP or on the SOP yet: SOP.0003 5.3.4 asks for an exception', q['qualified'] is False and len(q['reasons']) >= 1, q['reasons'])
    admin.call('POST', f'/training/sessions/{sid}/trainer-exception', {'reason': 'E2E-TEST the trainer of the department trains on the SOP of the unit', 'approverUserId': approver.user['id']})
    ex = [x for x in get(aid)['sessions'] if x['id'] == sid][0]['trainerQualification']['exception']
    approver.call('POST', f"/training/trainer-exceptions/{ex['id']}/approve", {'signatureToken': sign(approver)})
    p = admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': [x.user['id'] for x in TRAINEES], 'reason': 'E2E-TEST'})
    pid = {x['personUserId']: x['id'] for x in p['participants']}
    admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'E2E-TEST'})
    admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': approver.user['id']})
    admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': content_approver.user['id']})
    admin.call('POST', f'/training/activities/{aid}/material-links', {'title': 'E2E-TEST the SOP', 'url': 'https://example.com/sop'})
    code, d, text = attempt(admin, 'PUT', f'/training/activities/{aid}/assessment', {'assessmentId': definition['id']})
    check(f'{tag}.2 the assessment is chosen: its content is written into the form APD.0009', code == 200 and d['assessment']['code'] == definition['code'], (code, text))
    mats = admin.call('GET', f'/training/activities/{aid}/files')['materials']
    exam_file = [m for m in mats if m['purpose'] == 'EXAM' and not m.get('removedAt')]
    key_file = [m for m in mats if m['purpose'] == 'ANSWER_KEY' and not m.get('removedAt')]
    check(f'{tag}.3 one exam file and one answer key (Word) in the tab Assessment', len(exam_file) == 1 and len(key_file) == 1, [(m['purpose'], m['originalName']) for m in mats])
    status, exam_bytes = admin.call('GET', f"/training/materials/{exam_file[0]['id']}/download", raw=True)
    status, key_bytes = admin.call('GET', f"/training/materials/{key_file[0]['id']}/download", raw=True)
    open(os.path.join(OUT, f'{tag}-exam-file-of-the-activity.docx'), 'wb').write(exam_bytes)
    open(os.path.join(OUT, f'{tag}-answer-key-of-the-activity.docx'), 'wb').write(key_bytes)
    plain = docx_text(exam_bytes)
    check(f'{tag}.4 the form has the topic, the Training Number and (for a test) the duration', topic.split(' (')[0] in plain and number in plain and (assess != 'TEST' or '45 phút' in plain), plain[:300])
    check(f'{tag}.5 the title of the library is not in the form', 'E2E-TEST' not in plain and 'Kiểm tra đào tạo SOP.0009' not in plain and 'Checklist lấy mẫu' not in plain)
    check(f'{tag}.5b the key is only in the answer key file', ('ĐÁP ÁN' in docx_text(key_bytes)) and ('ĐÁP ÁN' not in plain))
    approver.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(approver)})
    content_approver.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(content_approver)})
    admin.call('POST', f'/training/sessions/{sid}/delivery-mode', {'mode': 'PAPER'})
    admin.call('POST', f'/training/activities/{aid}/notify', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
    check(f'{tag}.6 notified, not yet In progress', get(aid)['status'] == 'NOTIFIED')
    code, payload = admin.call('POST', f'/training/sessions/{sid}/exam-pack', {'format': 'pdf'}, raw=True)
    check(f'{tag}.7 the test copies: a ZIP with one PDF for each of the three trainees', code == 200 and payload[:2] == b'PK' and len(zipfile.ZipFile(io.BytesIO(payload)).namelist()) == 3, code)
    zpdf = zipfile.ZipFile(io.BytesIO(payload))
    code, payload2 = admin.call('POST', f'/training/sessions/{sid}/exam-pack', {'format': 'docx', 'reason': 'E2E-TEST the Word copies'}, raw=True)
    check(f'{tag}.8 the Word copies are downloaded too (a second print has a reason)', code == 200 and payload2[:2] == b'PK', code)
    zdocx = zipfile.ZipFile(io.BytesIO(payload2))
    for n in zpdf.namelist():
        open(os.path.join(OUT, f'{tag}-{n}'), 'wb').write(zpdf.read(n))
    for n in zdocx.namelist():
        open(os.path.join(OUT, f'{tag}-{n}'), 'wb').write(zdocx.read(n))
        who = [x for x in TRAINEES if x.user['employeeCode'] in n]
        text = docx_text(zdocx.read(n))
        other_names = [x.user['fullName'] for x in TRAINEES if x is not who[0]]
        check(f'{tag}.9 {n}: this trainee only (name, ID code, department, date)', len(who) == 1 and who[0].user['fullName'] in text and who[0].user['employeeCode'] in text and all(o not in text for o in other_names)
              and who[0].user['department'] in text and re.search(r'\d{2}/\d{2}/\d{4}', text) is not None, (n, text[:300]))
    try:
        import fitz
        for n in zpdf.namelist():
            doc = fitz.open(stream=zpdf.read(n), filetype='pdf')
            check(f'{tag}.10 {n}: a PDF of {doc.page_count} page(s) without the line of the trainee in the footer', doc.page_count >= 1 and 'Trainee:' not in ''.join(pg.get_text() for pg in doc), n)
            for i in range(min(3, doc.page_count)):
                doc[i].get_pixmap(dpi=70).save(os.path.join(OUT, f'{tag}-{n[:-4]}-page{i + 1}.png'))
    except ImportError:
        print('SKIP the picture of the PDF (PyMuPDF is not installed)')
    return aid, sid, pid, number


step('3. the test of questions: the activity, the three trainees, the test copies')
aid, sid, pid, number = prepare('T', exam_def, 'CLASSROOM', 'TEST', TOPIC, 'E2E-TEST Đào tạo SOP.0009 Thẩm định thiết bị và hệ thống', True)

step('4. the checklist: the same, with the table Correct / Incorrect')
caid, csid, cpid, cnumber = prepare('C', check_def, 'PRACTICAL', 'CHECKLIST', CHECK_TOPIC, 'E2E-TEST Đào tạo SOP.0021 Lấy mẫu vô trùng', False)

step('5. the test of questions goes on: the training, the attendance, the list to QA')
tick_all(admin, sid)
admin.call('POST', f'/training/sessions/{sid}/hold', {'signatureToken': sign(admin)})
a = get(aid)
check('5.1 In progress', a['status'] == 'IN_PROGRESS', a['status'])
for t in TRAINEES:
    admin.call('POST', f"/training/participants/{pid[t.user['id']]}/attendance", {'state': 'ATTENDED'})
code, data, text = attempt(trainer, 'POST', f'/training/activities/{aid}/send-attendance-list', {'version': trainer.call('GET', f'/training/activities/{aid}')['version'], 'signatureToken': sign(trainer)})
check('5.2 the trainer sends the attendance list to QA (signature)', code == 200 and bool(data.get('attendanceSentAt')), (code, text))

step('6. the results: the maximum score is 10, the pass mark of Training Properties')
pm = admin.call('GET', '/training/settings')['passPercent']
scores = {t1.user['id']: 9, t2.user['id']: 5, t3.user['id']: 8}
for t in TRAINEES:
    r = admin.call('POST', f"/training/participants/{pid[t.user['id']]}/assessments", {'scoreObtained': scores[t.user['id']], 'scoreMax': 10})
    got = [x for x in r['participants'] if x['id'] == pid[t.user['id']]][0]
    want = 'PASSED' if scores[t.user['id']] * 10 >= pm else 'FAILED'
    check(f"6.1 {t.user['fullName']}: {scores[t.user['id']]}/10 with the pass mark {pm}% is {want}", got['result'] == want, got['result'])
    # the scan of the paper of that person is kept under that person
    f = admin.upload(f'/training/activities/{aid}/paper-evidence', 'file', 'scan.pdf', mini_pdf('E2E-TEST scan ' + t.user['employeeCode']), 'application/pdf', f"?kind=ASSESSMENT&participantId={pid[t.user['id']]}")
    check(f"6.2 the scan of {t.user['fullName']} is kept under that person", len([e for e in f['evidence'] if e.get('participantId') == pid[t.user['id']]]) == 1)
a = trainer.call('GET', f'/training/activities/{aid}')
check('6.3 every result is in: Finish Training is offered to the trainer', a['capabilities']['finishTraining'] is True, a['capabilities'])
a = trainer.call('POST', f'/training/activities/{aid}/finish-training', {'version': a['version'], 'signatureToken': sign(trainer)})
check('6.4 the training is finished (signature)', bool(a.get('resultsFinishedAt')) and a['capabilities']['submitForConfirmation'] is True, a['capabilities'])
status, apd = admin.call('GET', f'/training/activities/{aid}/attendance-list?format=docx', raw=True)
apd_text = docx_text(apd)
check('6.5 the list APD.0117 has the three trainees and their results', status == 200 and all(t.user['fullName'] in apd_text for t in TRAINEES) and 'Passed' in apd_text and 'Failed' in apd_text, apd_text[:300])
open(os.path.join(OUT, 'APD.0117-attendance-list.docx'), 'wb').write(apd)

step('7. the results to QA and the confirmation of QA')
a = trainer.call('POST', f'/training/activities/{aid}/submit-for-confirmation', {'version': trainer.call('GET', f'/training/activities/{aid}')['version'], 'signatureToken': sign(trainer)})
check('7.1 the trainer sends the results to QA: Pending QA Confirmation', a['status'] == 'PENDING_QA_CONFIRMATION', a['status'])
a = qa.call('POST', f'/training/activities/{aid}/confirm-completion', {'version': get(aid)['version'], 'signatureToken': sign(qa)})
check('7.2 QA confirms: Completed', a['status'] == 'COMPLETED', a['status'])
failed_person = [x for x in a['participants'] if x['result'] == 'FAILED']
check('7.3 the one who did not pass is the one to be trained again', len(failed_person) == 1 and failed_person[0]['fullName'] == t2.user['fullName'], failed_person)

print(f'\nfiles are in {OUT}')
failed = [r for r in results if not r[1]]
print(f'\n{len(results) - len(failed)} of {len(results)} checks passed')
json.dump({'test': {'activityId': aid, 'number': number}, 'checklist': {'activityId': caid, 'number': cnumber}}, open(os.path.join(OUT, 'state.json'), 'w'))
sys.exit(1 if failed else 0)
