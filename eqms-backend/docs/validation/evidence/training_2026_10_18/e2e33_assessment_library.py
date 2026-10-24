"""DEV: the library of Training Assessments (APD.0009). A designer writes a test (single, multiple, true or false, essay) and a checklist; another person approves with a signature; an approved version
never changes (a change is a new version); an activity chooses an approved one and keeps a frozen copy; the key never reaches the activity detail; the test copies are printed before the training
starts (Notified), with the key kept for the trainer; a checklist is passed only when every line is correct.
NEEDS two accounts that hold training.assessment.design (admin) and training.assessment.approve (approver.test1): Security grants them, this script does not. Without them it stops and says so.
The password comes from DEVPW (never written); records are titled "E2E-TEST ..."; none is deleted."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from api import Client, tick_all
from e2e21_matrix import mini_pdf, attempt, check, sign, results, admin, qa, trainee, other, get, TODAY

designer = admin
approver = qa  # approver.test1

code, data, text = attempt(designer, 'GET', '/training/assessments?limit=1')
code2, data2, text2 = attempt(approver, 'GET', '/training/assessments?limit=1')
if code != 200 or code2 != 200:
    print('STOP: the designer (admin) and the approver (approver.test1) must hold training.assessment.design and training.assessment.approve. Ask Security to grant them, then run again.', (code, code2))
    sys.exit(2)

Q = [
    {'kind': 'SINGLE', 'prompt': 'E2E-TEST Tần suất vệ sinh?', 'options': [{'text': 'Mỗi ca'}, {'text': 'Mỗi tuần'}], 'correct': ['A'], 'points': 2},
    {'kind': 'MULTI', 'prompt': 'E2E-TEST Dụng cụ nào được dùng?', 'options': [{'text': 'Khăn'}, {'text': 'Bàn chải kim loại'}, {'text': 'IPA 70%'}], 'correct': ['A', 'C'], 'points': 2},
    {'kind': 'TRUE_FALSE', 'prompt': 'E2E-TEST Có thể bỏ qua nhật ký?', 'options': [], 'correct': ['B'], 'points': 1},
    {'kind': 'ESSAY', 'prompt': 'E2E-TEST Mô tả xử lý tràn hóa chất.', 'options': [], 'correct': [], 'points': 5, 'modelAnswer': 'E2E-KEY-SECRET cách ly, hấp thụ, ghi hồ sơ'},
]

print('== 1. design, approval, versions')
code, a, text = attempt(designer, 'POST', '/training/assessments', {'title': 'E2E-TEST Kiểm tra đào tạo SOP', 'kind': 'QUESTIONS', 'items': Q})
check('1.1 the designer creates a draft with the four kinds of question', code == 200 and a['status'] == 'DRAFT' and a['itemCount'] == 4 and float(a['maxScore']) == 10, (code, text))
aid = a['id']
check('1.2 the draft has a code and version 1; the designer may edit and delete it, not approve it', a['code'].startswith('TAS-') and a['versionNo'] == 1 and a['capabilities']['edit'] and a['capabilities']['delete'] and a['capabilities']['submit'] and not a['capabilities']['approve'], a['capabilities'])
code, data, text = attempt(designer, 'POST', '/training/assessments', {'title': '', 'kind': 'QUESTIONS', 'items': Q})
check('1.3 a title is needed', code == 400 and 'TRAINING_ASSESSMENT_TITLE_REQUIRED' in text, (code, text))
bad = [dict(Q[0], correct=[])]
code, data, text = attempt(designer, 'POST', '/training/assessments', {'title': 'E2E-TEST bad', 'kind': 'QUESTIONS', 'items': bad})
check('1.4 a single choice with no right answer is refused', code == 400 and 'TRAINING_ASSESSMENT_ITEM_INVALID' in text, (code, text))
code, data, text = attempt(designer, 'PUT', f'/training/assessments/{aid}', {'version': a['version'] + 5, 'title': a['title'], 'kind': 'QUESTIONS', 'items': Q})
check('1.5 an old version of the draft is refused (TRAINING_ASSESSMENT_VERSION_CHANGED)', code == 409 and 'TRAINING_ASSESSMENT_VERSION_CHANGED' in text, (code, text))
code, a, text = attempt(designer, 'PUT', f'/training/assessments/{aid}', {'version': a['version'], 'title': 'E2E-TEST Kiểm tra đào tạo SOP v1', 'kind': 'QUESTIONS', 'items': Q})
check('1.6 the draft is saved', code == 200 and a['title'].endswith('v1'), (code, text))
code, data, text = attempt(designer, 'POST', f'/training/assessments/{aid}/approve', {'signatureToken': sign(designer)})
code, data, text = attempt(designer, 'POST', f'/training/assessments/{aid}/approve', {'signatureToken': sign(designer)})
check('1.6b a draft cannot be approved before it is submitted (TRAINING_ASSESSMENT_NOT_PENDING)', code == 409 and 'TRAINING_ASSESSMENT_NOT_PENDING' in text, (code, text))
code, a, text = attempt(designer, 'POST', f'/training/assessments/{aid}/submit')
check('1.6c the designer submits it: Pending Approval, no longer editable', code == 200 and a['status'] == 'PENDING_APPROVAL' and not a['capabilities']['edit'], (code, text))
code, data, text = attempt(designer, 'POST', f'/training/assessments/{aid}/approve', {'signatureToken': sign(designer)})
check('1.7 the person who wrote and submitted the draft cannot approve it', code in (400, 403) and ('SEGREGATION' in text or code == 403), (code, text))
code, data, text = attempt(approver, 'POST', f'/training/assessments/{aid}/approve', {})
check('1.8 the approval needs a signature', code == 400 and 'TRAINING_SIGNATURE_REQUIRED' in text, (code, text))
code, data, text = attempt(approver, 'POST', f'/training/assessments/{aid}/return', {})
check('1.8b returning it needs a reason', code == 400 and 'TRAINING_REASON_REQUIRED' in text, (code, text))
code, a, text = attempt(approver, 'POST', f'/training/assessments/{aid}/return', {'reason': 'E2E-TEST check again'})
check('1.8c the approver returns it to Draft with a reason', code == 200 and a['status'] == 'DRAFT', (code, text))
code, a, text = attempt(designer, 'POST', f'/training/assessments/{aid}/submit')
code, a, text = attempt(approver, 'POST', f'/training/assessments/{aid}/approve', {'signatureToken': sign(approver)})
check('1.9 another person approves with a signature: Effective', code == 200 and a['status'] == 'EFFECTIVE' and a['approvedByName'], (code, text))
code, data, text = attempt(designer, 'PUT', f'/training/assessments/{aid}', {'version': a['version'], 'title': 'changed', 'kind': 'QUESTIONS', 'items': Q})
check('1.10 an effective version cannot be changed (TRAINING_ASSESSMENT_NOT_DRAFT)', code == 409 and 'TRAINING_ASSESSMENT_NOT_DRAFT' in text, (code, text))
code, v2, text = attempt(designer, 'POST', f'/training/assessments/{aid}/new-version')
check('1.11 a change is a new version of the same code', code == 200 and v2['versionNo'] == 2 and v2['code'] == a['code'] and v2['status'] == 'DRAFT', (code, text))
code, data, text = attempt(designer, 'POST', f'/training/assessments/{aid}/new-version')
check('1.12 only one draft of a code at a time', code == 409, (code, text))
attempt(designer, 'POST', f"/training/assessments/{v2['id']}/submit")
code, data, text = attempt(approver, 'POST', f"/training/assessments/{v2['id']}/approve", {'signatureToken': sign(approver)})
check('1.13 the version 2 is approved by another person than the one who made it', code == 200 and data['status'] == 'EFFECTIVE', (code, text))
old = designer.call('GET', f'/training/assessments/{aid}')
check('1.14 version 1 is then replaced', old['status'] == 'SUPERSEDED', old['status'])
listed = [x['id'] for x in designer.call('GET', '/training/assessments/approved?search=E2E-TEST')['data']]
check('1.15 only the effective version is offered to an activity', v2['id'] in listed and aid not in listed, listed)
code, data, text = attempt(trainee, 'GET', '/training/assessments')
check('1.16 a person who neither designs nor approves cannot read the library (the key is in it)', code == 403, (code, text))
code, d3, text = attempt(designer, 'POST', f"/training/assessments/{v2['id']}/new-version")
code, data, text = attempt(designer, 'POST', f"/training/assessments/{d3['id']}/delete", {})
check('1.17 deleting a draft needs a reason', code == 400 and 'TRAINING_REASON_REQUIRED' in text, (code, text))
code, data, text = attempt(designer, 'POST', f"/training/assessments/{d3['id']}/delete", {'reason': 'E2E-TEST not needed'})
check('1.18 a draft is deleted with a reason', code == 200, (code, text))

print(chr(10) + '== 2. an activity chooses it; the key stays on the server; the copies are printed before the training starts')
code, act, text = attempt(admin, 'POST', '/training/activities', {'kind': 'UNPLANNED', 'trainingTitle': 'E2E-TEST library test', 'kindReason': 'OTHER'})
act_id = act['id']
a_ = admin.call('POST', f'/training/activities/{act_id}/sessions', {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'E2E Trainer', 'scheduledOn': TODAY, 'venue': 'Room 1', 'topics': [{'topicText': 'E2E-TEST topic'}]})
sid = a_['sessions'][0]['id']
a_ = admin.call('POST', f'/training/activities/{act_id}/participants', {'sessionId': sid, 'personUserIds': [trainee.user['id'], other.user['id']], 'reason': 'E2E-TEST'})
check('2.1 before choosing, the activity needs a test', 'TRAINING_TEST_REQUIRED' in get(act_id)['contentRules']['missing'], get(act_id)['contentRules'])
check('2.2 the organizer may choose', get(act_id)['capabilities'].get('chooseAssessment') is True)
code, data, text = attempt(admin, 'PUT', f'/training/activities/{act_id}/assessment', {'assessmentId': aid})
check('2.3 a replaced version cannot be chosen (TRAINING_ASSESSMENT_NOT_APPROVED)', code == 409 and 'TRAINING_ASSESSMENT_NOT_APPROVED' in text, (code, text))
code, data, text = attempt(admin, 'PUT', f'/training/activities/{act_id}/assessment', {'assessmentId': v2['id']})
check('2.4 the effective version is chosen', code == 200 and data['assessment']['code'] == a['code'] and data['assessment']['version'] == 2, (code, text))
check('2.5 the test is no longer missing', get(act_id)['contentRules']['missing'] == [] or 'TRAINING_TEST_REQUIRED' not in get(act_id)['contentRules']['missing'], get(act_id)['contentRules'])
detail_text = str(get(act_id))
check('2.6 the detail of the activity never carries the key or the model answer', 'E2E-KEY-SECRET' not in detail_text and 'snapshot' not in detail_text.lower(), 'leak')
check('2.7 the total score is that of the assessment', float(get(act_id)['assessment']['maxScore']) == 10 and get(act_id)['assessment']['itemCount'] == 4)
code, data, text = attempt(admin, 'POST', f'/training/activities/{act_id}/assessment/remove')
check('2.8 it can be taken off before the content is reviewed', code == 200 and not data.get('assessment'), (code, text))
admin.call('PUT', f'/training/activities/{act_id}/assessment', {'assessmentId': v2['id']})
admin.call('POST', f'/training/activities/{act_id}/confirm-list', {'signatureToken': sign(admin), 'reason': 'E2E-TEST'})
admin.call('PUT', f'/training/activities/{act_id}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': qa.user['id']})
admin.call('PUT', f'/training/activities/{act_id}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': trainee.user['id']})
admin.call('POST', f'/training/activities/{act_id}/material-links', {'title': 'E2E-TEST material', 'url': 'https://example.com/e2e'})
qa.call('POST', f'/training/activities/{act_id}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(qa)})
code, data, text = attempt(admin, 'POST', f'/training/activities/{act_id}/assessment/remove')
check('2.9 after the review the choice is fixed (TRAINING_CONTENT_ALREADY_REVIEWED)', code == 409 and 'TRAINING_CONTENT_ALREADY_REVIEWED' in text, (code, text))
trainee.call('POST', f'/training/activities/{act_id}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(trainee)})
admin.call('POST', f'/training/sessions/{sid}/delivery-mode', {'mode': 'PAPER'})
code, payload = admin.call('POST', f'/training/sessions/{sid}/exam-pack', {}, raw=True)
check('2.10 before the training is notified the copies are not printed (TRAINING_PAPER_STATUS)', code == 409, code)
admin.call('POST', f'/training/activities/{act_id}/notify', {'version': get(act_id)['version'], 'signatureToken': sign(admin)})
code, payload = admin.call('POST', f'/training/sessions/{sid}/exam-pack', {}, raw=True)
check('2.11 notified, not yet In progress: the test copies are printed (a PDF)', code == 200 and payload[:4] == b'%PDF', code)
check('2.12 the print is numbered and recorded', len([p for p in admin.call('GET', f'/training/activities/{act_id}/paper-packs') if p['packKind'] == 'EXAM']) == 1)
try:
    import io
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(payload))
    pdf_text = ' '.join(p.extract_text() for p in reader.pages)
    names = [p['fullName'] for p in get(act_id)['participants']]
    check('2.13 each copy carries the name of its trainee and the questions, and no key', all(n in pdf_text for n in names) and 'E2E-TEST Tần suất vệ sinh?' in pdf_text and 'E2E-KEY-SECRET' not in pdf_text and 'ANSWER KEY' not in pdf_text, names)
except ImportError:
    print('SKIP  2.13 (pypdf is not installed: the text of the copies was not read)')
code, key = admin.call('POST', f'/training/sessions/{sid}/test-key', {}, raw=True)
check('2.14 the answer key is printed for the trainer (a PDF)', code == 200 and key[:4] == b'%PDF', code)
code, data = trainee.call('POST', f'/training/sessions/{sid}/test-key', {}, raw=True)
check('2.15 a trainee cannot print the key', code in (401, 403), code)

print(chr(10) + '== 3. a checklist is passed only when every line is correct')
code, c, text = attempt(designer, 'POST', '/training/assessments', {'title': 'E2E-TEST Checklist', 'kind': 'CHECKLIST', 'items': [
    {'kind': 'CHECK', 'prompt': 'E2E-TEST line 1', 'options': [], 'correct': ['CORRECT'], 'points': 1}, {'kind': 'CHECK', 'prompt': 'E2E-TEST line 2', 'options': [], 'correct': ['INCORRECT'], 'points': 1}]})
check('3.1 a checklist is created, and has no score', code == 200 and c['kind'] == 'CHECKLIST' and c['maxScore'] is None, (code, text))
code, data, text = attempt(designer, 'POST', '/training/assessments', {'title': 'E2E-TEST bad checklist', 'kind': 'CHECKLIST', 'items': [dict(Q[0])]})
check('3.2 a question is refused in a checklist', code == 400, (code, text))
attempt(designer, 'POST', f"/training/assessments/{c['id']}/submit")
code, c, text = attempt(approver, 'POST', f"/training/assessments/{c['id']}/approve", {'signatureToken': sign(approver)})
code, act2, text = attempt(admin, 'POST', '/training/activities', {'kind': 'UNPLANNED', 'trainingTitle': 'E2E-TEST library checklist', 'kindReason': 'OTHER'})
act2_id = act2['id']
s2 = admin.call('POST', f'/training/activities/{act2_id}/sessions', {'method': 'PRACTICAL', 'assessmentMethod': 'CHECKLIST', 'externalTrainerName': 'E2E Trainer', 'scheduledOn': TODAY, 'venue': 'Room 1', 'topics': [{'topicText': 'E2E-TEST topic'}]})
sid2 = s2['sessions'][0]['id']
code, data, text = attempt(admin, 'PUT', f'/training/activities/{act2_id}/assessment', {'assessmentId': v2['id']})
check('3.3 a test cannot be chosen for a session assessed by a checklist (TRAINING_ASSESSMENT_KIND_MISMATCH)', code == 409 and 'TRAINING_ASSESSMENT_KIND_MISMATCH' in text, (code, text))
code, data, text = attempt(admin, 'PUT', f'/training/activities/{act2_id}/assessment', {'assessmentId': c['id']})
check('3.4 the checklist is chosen', code == 200 and data['assessment']['kind'] == 'CHECKLIST', (code, text))
p2 = admin.call('POST', f'/training/activities/{act2_id}/participants', {'sessionId': sid2, 'personUserIds': [trainee.user['id']], 'reason': 'E2E-TEST'})
pid2 = p2['participants'][0]['id']
admin.call('POST', f'/training/activities/{act2_id}/confirm-list', {'signatureToken': sign(admin), 'reason': 'E2E-TEST'})
admin.call('PUT', f'/training/activities/{act2_id}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': qa.user['id']})
admin.call('PUT', f'/training/activities/{act2_id}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': trainee.user['id']})
admin.call('POST', f'/training/activities/{act2_id}/material-links', {'title': 'E2E-TEST material', 'url': 'https://example.com/e2e'})
qa.call('POST', f'/training/activities/{act2_id}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(qa)})
trainee.call('POST', f'/training/activities/{act2_id}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(trainee)})
admin.call('POST', f'/training/activities/{act2_id}/notify', {'version': get(act2_id)['version'], 'signatureToken': sign(admin)})
tick_all(admin, sid2)
admin.call('POST', f'/training/sessions/{sid2}/hold', {'signatureToken': sign(admin)})
admin.call('POST', f'/training/participants/{pid2}/attendance', {'state': 'ATTENDED'})
r = admin.call('POST', f'/training/participants/{pid2}/assessments', {'scoreObtained': 1, 'scoreMax': 2})
p = [x for x in r['participants'] if x['id'] == pid2][0]
check('3.5 one line out of two is not enough for a checklist (50%: Failed)', p['result'] == 'FAILED', p['result'])
r = admin.call('POST', f'/training/participants/{pid2}/assessments', {'scoreObtained': 2, 'scoreMax': 2})
p = [x for x in r['participants'] if x['id'] == pid2][0]
check('3.6 every line correct: Passed', p['result'] == 'PASSED', p['result'])
print(chr(10) + 'NOTE: a test with 7 of 10 points passes with the pass mark of Training Properties (70%), a checklist needs 10 of 10: see unit tests and e2e32.')

failed = [r for r in results if not r[1]]
print(f'\n{len(results) - len(failed)} of {len(results)} checks passed')
sys.exit(1 if failed else 0)
