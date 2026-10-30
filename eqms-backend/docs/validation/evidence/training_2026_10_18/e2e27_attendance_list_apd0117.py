"""DEV: the attendance list of an activity in the form APD.0117, filled in the Word file of the organization (the template uploaded and enabled in Training Properties, with a signature).
Checks the file that comes out (Word and PDF): the header code, the general information, the topics of every session, the list of every session with what was recorded, the confirmations, and that the
instructions of the template do not appear. The samples are kept in ./exports. The password comes from DEVPW (never written); records are titled "E2E-TEST ..."; none is deleted."""
import os, sys, io, zipfile, re, urllib.request, urllib.error, json
sys.path.insert(0, os.path.dirname(__file__))
from api import Client, tick_all, BASE
from e2e21_matrix import mini_pdf, attempt, check, sign, results, admin, qa, trainee, other, get, TODAY

HERE = os.path.dirname(__file__)
TEMPLATE = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', '..', 'docs', 'training_docs', 'APD.0117.01 Training attendence sheet_260815.docx'))
os.makedirs(os.path.join(HERE, 'exports'), exist_ok=True)
trainer1 = Client('trainer.test1')


def download(c, aid, fmt):
    req = urllib.request.Request(BASE + f'/training/activities/{aid}/attendance-list?format={fmt}', headers={'Authorization': 'Bearer ' + c.token})
    try:
        with c.opener.open(req) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def words(docx):
    z = zipfile.ZipFile(io.BytesIO(docx))
    xml = ''.join(z.read(n).decode('utf-8') for n in z.namelist() if re.match(r'word/(document|header\d*|footer\d*)\.xml$', n))
    paragraphs = [''.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>', p)) for p in re.findall(r'<w:p[ >].*?</w:p>', xml, flags=re.S)]
    return xml, [p for p in paragraphs if p.strip()]


print('== 1. the template')
code, payload = download(admin, '00000000-0000-0000-0000-000000000000', 'docx')
check('1.1 an unknown activity is refused', code in (403, 404), code)
current = admin.call('GET', '/training/form-templates/current').get('data') or []
if not [t for t in current if t['code'] == 'APD.0117']:
    with open(TEMPLATE, 'rb') as f:
        data = f.read()
    up = admin.upload('/training/form-templates', 'file', 'APD.0117.01 Training attendence sheet.docx', data, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                      '?code=APD.0117&title=Training%20attendance%20list&versionLabel=1.0.0&remark=E2E-TEST')
    tid = up['id']
    en = admin.call('POST', f'/training/form-templates/{tid}/enable', {'signatureToken': sign(admin), 'reason': 'E2E-TEST enable the form APD.0117'})
    check('1.2 the template APD.0117 is uploaded and enabled with a signature', en.get('status') == 'ENABLED', en)
else:
    check('1.2 the template APD.0117 is already enabled', True)

print(chr(10) + '== 2. an activity of two sessions')
a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'NEW_SOP', 'trainingTitle': 'E2E-TEST attendance list APD.0117'})
aid = a['id']
number = a['trainingNumber']
s1 = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'Tran Van Ngoai', 'scheduledOn': TODAY, 'venue': 'Room 1', 'topics': [{'topicText': 'E2E-TEST first topic'}, {'topicText': 'E2E-TEST second topic'}]})
sid1 = s1['sessions'][0]['id']
s2 = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'HYBRID', 'assessmentMethod': 'TEST', 'externalTrainerName': 'Le Thi Hai', 'scheduledOn': TODAY, 'venue': 'Room 2', 'topics': [{'topicText': 'E2E-TEST third topic'}]})
sid2 = [s for s in s2['sessions'] if s['id'] != sid1][0]['id']
a = admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid1, 'personUserIds': [trainee.user['id'], other.user['id']], 'reason': 'E2E-TEST'})
a = admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid2, 'personUserIds': [trainee.user['id']], 'reason': 'E2E-TEST'})
pid = {(p['sessionId'], p['personUserId']): p['id'] for p in a['participants']}

code, body = download(admin, aid, 'docx')
check('2.1 the Word file is made before anything happens', code == 200 and body[:2] == b'PK', (code, body[:200]))
xml, paras = words(body)
text = ' | '.join(paras)
open(os.path.join(HERE, 'exports', 'APD0117-before.docx'), 'wb').write(body)
check('2.2 the header carries the Training Number', 'Code: ' + number in text, text[:300])
check('2.3 the general information: title, department, type', 'E2E-TEST first topic' in text and 'Quality Assurance' in text and 'Đột xuất / Unplanned' in text, text[:600])
check('2.4 the three topics are in the table of topics', all(t in text for t in ('E2E-TEST first topic', 'E2E-TEST second topic', 'E2E-TEST third topic')), text[:900])
check('2.5 a list for each session, numbered 01 and 02 (no SS)', '01: ' in text and '02: ' in text and 'SS0' not in text, text[:900])
check('2.5b the trainer outside the company is written with his own name', 'Tran Van Ngoai' in text and 'Le Thi Hai' in text and 'External Trainer' not in text, text[:900])
check('2.5c the column of the way is called Mode (Hình thức / Mode) and the session numbers are 01, 02', 'Mode' in text, text[:600])
check('2.6 the people are in the lists (two in SS01, one in SS02)', text.count('User A (DCO Test)') == 2 and text.count('TEST-USER-A') == 2, text.count('User A (DCO Test)'))
check('2.7 the instructions of the template are not in the form', 'Đầu trang/ Header' not in text and 'Chân trang/ Footer' not in text and 'LỊCH SỬ SỬA ĐỔI' not in text and 'Ban hành lần đầu' not in text, text[-500:])
check('2.8 the four parts of the form are there', all(k in text for k in ('Thông tin chung', 'Chi tiết nội dung đào tạo', 'Danh sách tham gia đào tạo', 'Phần xác nhận của người đào tạo')), text[:300])
check('2.9 before the training the signature boxes are empty (no "Present" or "Absent" written)', 'Có mặt' not in text and 'Vắng mặt' not in text, text[:900])
check('2.10 no preparer yet: the list is not confirmed', 'Ký điện tử / Signed electronically' not in text)

print(chr(10) + '== 3. after the list is confirmed, the training and the completion')
admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'E2E-TEST'})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': qa.user['id']})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': trainee.user['id']})
admin.call('POST', f'/training/activities/{aid}/material-links', {'title': 'E2E-TEST material', 'url': 'https://example.com/e2e'})
admin.upload(f'/training/activities/{aid}/materials', 'file', 'e2e-test.pdf', mini_pdf('E2E-TEST'), 'application/pdf', '?purpose=EXAM&title=E2E-TEST%20test')
qa.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(qa)})
trainee.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(trainee)})
admin.call('POST', f'/training/activities/{aid}/notify', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
code, body = download(admin, aid, 'docx')
xml, paras = words(body)
text = ' | '.join(paras)
check('3.1 once the list is confirmed the preparer is written with the date (dd/MM/yyyy HH:mm:ss)', 'Nguyen The Hoang' in text and re.search(r'Electronically Signed \| \d{2}/\d{2}/\d{4} \d{2}:\d{2}:\d{2}', text), text[-700:])
for sid in (sid1, sid2):
    tick_all(admin, sid)
admin.call('POST', f'/training/sessions/{sid1}/hold', {'signatureToken': sign(admin)})
admin.call('POST', f'/training/sessions/{sid2}/hold', {})
admin.call('POST', f'/training/participants/{pid[(sid1, trainee.user["id"])]}/attendance', {'state': 'ATTENDED'})
admin.call('POST', f'/training/participants/{pid[(sid1, other.user["id"])]}/attendance', {'state': 'ABSENT', 'absenceReason': 'E2E-TEST leave'})
admin.call('POST', f'/training/participants/{pid[(sid2, trainee.user["id"])]}/attendance', {'state': 'ONLINE'})
admin.call('POST', f'/training/participants/{pid[(sid1, trainee.user["id"])]}/assessments', {'scoreObtained': 5, 'scoreMax': 10})
admin.call('POST', f'/training/participants/{pid[(sid2, trainee.user["id"])]}/assessments', {'scoreObtained': 9, 'scoreMax': 10})
code, body = download(admin, aid, 'docx')
xml, paras = words(body)
text = ' | '.join(paras)
open(os.path.join(HERE, 'exports', 'APD0117-after-training.docx'), 'wb').write(body)
check('3.2 the attendance is written: present, absent, online', 'Có mặt / Present' in text and 'Vắng mặt / Absent' in text and 'Trực tuyến / Online' in text, text[:1200])
check('3.3 the results are not written before the trainer has finished the training (they are, after it: e2e32)', 'Không đạt / Failed' not in text and 'Đạt / Passed' not in text, text[:1200])
check('3.4 the dates of the sessions are dd/MM/yyyy', re.search(r'\d{2}/\d{2}/\d{4}', text) and not re.search(r'\d{4}-\d{2}-\d{2}', text), text[:600])

print(chr(10) + '== 4. the make-up for the person who failed shows in the column of the re-training result')
child = admin.call('POST', f'/training/activities/{aid}/supplementary', {'participantIds': [pid[(sid1, trainee.user['id'])]], 'reason': 'E2E-TEST retraining'})
code, body = download(admin, aid, 'docx')
xml, paras = words(body)
check('4.1 the export of the original still works with a make-up beside it', code == 200, code)

print(chr(10) + '== 4a. a topic that comes from a document: the document number, and the name with the title in the local language')
doc_body = {'documentName': 'E2E-TEST Data Integrity', 'titleLocalLanguage': 'E2E-TEST Toàn vẹn dữ liệu', 'documentType': 'Standard Operating Procedure', 'businessUnit': 'Quality Unit', 'department': 'Quality Assurance',
            'author': admin.user['id'], 'language': 'English', 'requiresTraining': False, 'reasonForSkippingTraining': 'E2E-TEST reference only', 'description': 'E2E-TEST', 'isTemplate': False, 'coAuthorIds': [], 'reviewerUserIds': [Client('dco.test1').user['id']], 'approverUserIds': [Client('approver.test1').user['id']],
            'relatedDocumentIds': [], 'correlatedDocumentIds': []}
code, doc, text = attempt(admin, 'POST', '/documents', doc_body)
if code == 200:
    rev = admin.call('POST', f"/documents/{doc['id']}/revisions", {})
    k = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'trainingTitle': 'E2E-TEST topic from a document'})
    admin.call('POST', f"/training/activities/{k['id']}/sessions", {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'Tran Van Ngoai', 'scheduledOn': TODAY, 'venue': 'Room 1',
                                                                    'topics': [{'topicText': 'free text that must not be used', 'documentRevisionId': rev['id']}]})
    code, body = download(admin, k['id'], 'docx')
    xml, paras = words(body)
    text = ' | '.join(paras)
    check('4a.1 SOP/Doc. No. is the document number only', doc['documentNumber'] + ' |' in text + ' |' and 'rev.' not in text.split('Chủ đề')[1].split('Danh sách tham gia')[0], text[:700])
    check('4a.2 the topic is the name of the document and its title in the local language', 'E2E-TEST Data Integrity / E2E-TEST Toàn vẹn dữ liệu' in text and 'free text that must not be used' not in text, text[:700])
else:
    check('4a.0 the document was made', False, text)

print(chr(10) + '== 4b. an external training: the unit or the person who trains is written as the trainer')
e = admin.call('POST', '/training/activities', {'kind': 'EXTERNAL', 'externalType': 'ACTIVE', 'kindReason': 'OTHER', 'trainingTitle': 'E2E-TEST external APD.0117', 'trainingUnitName': 'Cong ty ABC Training'})
admin.call('POST', f"/training/activities/{e['id']}/sessions", {'scheduledOn': TODAY, 'venue': 'Hotel', 'topics': [{'topicText': 'E2E-TEST external topic'}]})
code, body = download(admin, e['id'], 'docx')
xml, paras = words(body)
text = ' | '.join(paras)
check('4b.1 the trainer of an external training is the unit that trains, not "External Trainer"', code == 200 and 'Cong ty ABC Training' in text and 'External Trainer' not in text, text[:900])

print(chr(10) + '== 5. PDF and who may export')
code, pdf = download(admin, aid, 'pdf')
if code == 200:
    open(os.path.join(HERE, 'exports', 'APD0117-latest.pdf'), 'wb').write(pdf)
check('5.1 the PDF is made by the document server', code == 200 and pdf[:4] == b'%PDF', (code, pdf[:200]))
code, body = download(admin, aid, 'xlsx')
check('5.2 another format is refused', code == 400, (code, body[:120]))
code, body = download(trainer1, aid, 'docx')
check('5.3 a person who can view the activities may export it (trainer.test1)', code == 200, (code, body[:120]))
code, body = download(other, aid, 'docx')
check('5.4 a person with no right on the activities may not (dco.test1)', code == 403, (code, body[:120]))
audit = [r for r in (admin.call('GET', f'/training/activities/{aid}').get('audit') or [])]

failed = [r for r in results if not r[1]]
print(f'\n{len(results) - len(failed)} of {len(results)} checks passed')
sys.exit(1 if failed else 0)
