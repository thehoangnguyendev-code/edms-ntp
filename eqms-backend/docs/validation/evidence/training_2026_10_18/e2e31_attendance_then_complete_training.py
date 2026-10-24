"""DEV: the order of APD.0117. The attendance is recorded and signed, the attendance list is sent to QA, and the revision can be completed in Document Control at once; the results of the assessment come later and
the QA confirmation closes the training. Checks the step "Send attendance list to QA" (signature, conditions, once), the capability and the link of the revision, Complete Training before any result, and the
results afterwards. The password comes from DEVPW (never written); records are titled "E2E-TEST ..."; none is deleted."""
import os, sys, io, zipfile
sys.path.insert(0, os.path.dirname(__file__))
from api import Client, tick_all, finish_for_qa
from e2e21_matrix import mini_pdf, attempt, check, sign, results, admin, qa, trainee, other, get, TODAY

reviewer = Client('dco.test1')
approver = Client('approver.test1')


def mini_docx(text):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        z.writestr('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        z.writestr('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>' + text + '</w:t></w:r></w:p></w:body></w:document>')
    return buf.getvalue()


print('== 1. a SOP is approved and its training is planned')
body = {'documentName': 'E2E-TEST SOP attendance first', 'documentType': 'Standard Operating Procedure', 'businessUnit': 'Quality Unit', 'department': 'Quality Assurance', 'author': admin.user['id'],
        'language': 'English', 'requiresTraining': True, 'trainingPeriodDays': 14, 'description': 'E2E-TEST', 'isTemplate': False, 'coAuthorIds': [], 'reviewerUserIds': [reviewer.user['id']],
        'approverUserIds': [approver.user['id']], 'relatedDocumentIds': [], 'correlatedDocumentIds': []}
doc = admin.call('POST', '/documents', body)
aid = [r for r in admin.call('GET', '/training/activities?limit=5&search=' + doc['documentNumber'])['data'] if r.get('documentNumber') == doc['documentNumber']][0]['id']
rid = admin.call('POST', f"/documents/{doc['id']}/revisions", {})['id']
admin.upload(f'/revisions/{rid}/upload', 'file', 'e2e.docx', mini_docx('E2E-TEST'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
for who, step in ((admin, 'complete-editing'), (admin, 'submit-review'), (reviewer, 'review/complete'), (approver, 'approve/complete')):
    attempt(who, 'POST', f'/revisions/{rid}/{step}', {'signatureToken': sign(who), 'comment': 'E2E-TEST', 'reason': 'E2E-TEST'})
a = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'Tran Van Ngoai', 'scheduledOn': TODAY, 'venue': 'Room 1', 'topics': [{'topicText': 'E2E-TEST SOP'}]})
sid = a['sessions'][0]['id']
admin.upload(f'/training/activities/{aid}/materials', 'file', 'e2e-test.pdf', mini_pdf('E2E-TEST'), 'application/pdf', '?purpose=EXAM&title=E2E-TEST%20test')
a = admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': [trainee.user['id'], other.user['id']], 'reason': 'E2E-TEST'})
pid = {p['personUserId']: p['id'] for p in a['participants']}
admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'E2E-TEST'})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': qa.user['id']})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': trainee.user['id']})
qa.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(qa)})
trainee.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(trainee)})
admin.call('POST', f'/training/activities/{aid}/notify', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
tick_all(admin, sid)
admin.call('POST', f'/training/sessions/{sid}/hold', {'signatureToken': sign(admin)})
a = get(aid)
check('1.1 in progress, nothing sent: the revision cannot be completed yet', a['status'] == 'IN_PROGRESS' and a['capabilities'].get('completeTraining') is False and a['capabilities'].get('sendAttendanceList') is True, a['capabilities'])
link = admin.call('GET', f'/training/links/revisions/{rid}')
check('1.2 the revision does not see the attendance list as sent', not link.get('attendanceSentOn'), link)
code, data, text = attempt(admin, 'POST', f'/revisions/{rid}/training/complete', {'signatureToken': sign(admin), 'comment': 'E2E-TEST', 'reason': 'E2E-TEST'})
check('1.3 Complete Training of the revision is refused (the attendance list was not sent)', code >= 400, (code, text))

print(chr(10) + '== 2. the attendance, then the list is sent to QA')
code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/send-attendance-list', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
check('2.1 not while someone is not recorded yet (TRAINING_PARTICIPANT_NOT_FINAL)', code == 409 and 'TRAINING_PARTICIPANT_NOT_FINAL' in text, (code, text))
admin.call('POST', f"/training/participants/{pid[trainee.user['id']]}/attendance", {'state': 'ATTENDED'})
admin.call('POST', f"/training/participants/{pid[other.user['id']]}/attendance", {'state': 'ABSENT', 'absenceReason': 'E2E-TEST on leave'})
code, data, text = attempt(admin, 'POST', f'/training/sessions/{sid}/confirm-attendance', {'signatureToken': sign(admin)})
check('2.1b there is no separate confirmation step any more (the signature of the send is the confirmation)', code in (404, 405), (code, text))
code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/send-attendance-list', {'version': get(aid)['version']})
check('2.2 not without a signature (TRAINING_SIGNATURE_REQUIRED)', code == 400 and 'TRAINING_SIGNATURE_REQUIRED' in text, (code, text))
admin.call('POST', f'/training/activities/{aid}/send-attendance-list', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
a = get(aid)
check('2.4 the attendance list is sent (date and person kept)', bool(a.get('attendanceSentAt')) and bool(a.get('attendanceSentByName')) and a['status'] == 'IN_PROGRESS', (a.get('attendanceSentAt'), a['status']))
code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/send-attendance-list', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
import json, urllib.request
with urllib.request.urlopen('http://localhost:8025/api/v2/messages?limit=300') as r:
    mails = [m for m in json.load(r)['items'] if aid in m['Content']['Body'] and 'attendance list received' in m['Content']['Headers']['Subject'][0]]
check('2.4b QA is told by e-mail (the people who confirm the completion)', len(mails) >= 1, len(mails))
check('2.4c the e-mail carries the attendance list as a PDF named after the Training Number', any(('APD.0117.pdf' in m['Content']['Body']) and ('application/pdf' in m['Content']['Body']) for m in mails), [m['Content']['Body'][:80] for m in mails][:1])
check('2.5 it is sent once (TRAINING_ATTENDANCE_ALREADY_SENT)', code == 409 and 'TRAINING_ATTENDANCE_ALREADY_SENT' in text, (code, text))
check('2.6 the capability of the button is off and Complete Training is on', a['capabilities'].get('sendAttendanceList') is False and a['capabilities'].get('completeTraining') is True, a['capabilities'])
check('2.7 the person who is absent keeps the "Absent" line', [p for p in a['participants'] if p['id'] == pid[other.user['id']]][0]['state'] == 'ABSENT')

print(chr(10) + '== 3. Complete Training of the revision, before any result')
link = admin.call('GET', f'/training/links/revisions/{rid}')
check('3.1 the revision sees the day the list was sent and the day of the training as the completion day', bool(link.get('attendanceSentOn')) and link.get('completedOn') == TODAY, link)
code, data, text = attempt(admin, 'POST', f'/revisions/{rid}/training/complete', {'signatureToken': sign(admin), 'comment': 'E2E-TEST', 'reason': 'E2E-TEST'})
check('3.2 Complete Training of the revision works with no result recorded', code == 200, (code, text))
check('3.3 no person has a result yet', all(p['result'] == 'PENDING' for p in get(aid)['participants'] if p['state'] == 'ATTENDED'))

print(chr(10) + '== 4. the results come later, then QA confirms')
def apd_text():
    status, payload = admin.call('GET', f'/training/activities/{aid}/attendance-list?format=docx', raw=True)
    assert status == 200, status
    with zipfile.ZipFile(io.BytesIO(payload)) as z:
        return z.read('word/document.xml').decode('utf-8')


a = get(aid)
check('4.0 results still missing: Finish Training and Send results are both off', a['capabilities'].get('finishTraining') is False and a['capabilities'].get('submitForConfirmation') is False, a['capabilities'])
code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/finish-training', {'version': a['version'], 'signatureToken': sign(admin)})
check('4.0b Finish Training is refused while a result is missing (TRAINING_RESULT_PENDING)', code == 409 and 'TRAINING_RESULT_PENDING' in text, (code, text))
admin.call('POST', f"/training/participants/{pid[trainee.user['id']]}/assessments", {'scoreObtained': 9, 'scoreMax': 10})
a = get(aid)
check('4.0c every result is in: Finish Training is offered, Send results is not yet', a['capabilities'].get('finishTraining') is True and a['capabilities'].get('submitForConfirmation') is False, a['capabilities'])
check('4.0d the column of results of APD.0117 is still empty before the training is finished', 'Đạt / Passed' not in apd_text())
code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/submit-for-confirmation', {'version': a['version'], 'signatureToken': sign(admin)})
check('4.0e Send results is refused before Finish Training (TRAINING_NOT_FINISHED)', code == 409 and 'TRAINING_NOT_FINISHED' in text, (code, text))
code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/finish-training', {'version': a['version']})
check('4.0f Finish Training needs a signature (TRAINING_SIGNATURE_REQUIRED)', code == 400 and 'TRAINING_SIGNATURE_REQUIRED' in text, (code, text))
a = admin.call('POST', f'/training/activities/{aid}/finish-training', {'version': a['version'], 'signatureToken': sign(admin)})
check('4.0g Finish Training: date and person kept, Send results offered, Finish off', bool(a.get('resultsFinishedAt')) and bool(a.get('resultsFinishedByName')) and a['capabilities'].get('submitForConfirmation') is True and a['capabilities'].get('finishTraining') is False, (a.get('resultsFinishedAt'), a['capabilities']))
check('4.0h the results are written in the column of APD.0117 once finished', 'Đạt / Passed' in apd_text())
code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/finish-training', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
check('4.0i Finish Training once only (TRAINING_ALREADY_FINISHED)', code == 409 and 'TRAINING_ALREADY_FINISHED' in text, (code, text))
code, data, text = attempt(admin, 'POST', f"/training/participants/{pid[trainee.user['id']]}/assessments", {'scoreObtained': 10, 'scoreMax': 10})
check('4.0j no result can be changed after the training is finished (TRAINING_ALREADY_FINISHED)', code == 409 and 'TRAINING_ALREADY_FINISHED' in text, (code, text))
a = admin.call('POST', f'/training/activities/{aid}/submit-for-confirmation', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
check('4.1 the results are sent to QA (the list sent before keeps its first date)', a['status'] == 'PENDING_QA_CONFIRMATION' and a['attendanceSentAt'] is not None, a.get('attendanceSentAt'))
with urllib.request.urlopen('http://localhost:8025/api/v2/messages?limit=300') as r:
    mails = [m for m in json.load(r)['items'] if aid in m['Content']['Body'] and 'results are waiting for QA' in m['Content']['Headers']['Subject'][0]]
check('4.1b QA is told by e-mail, with the list APD.0117 (with the results) as a PDF', any(('APD.0117.pdf' in m['Content']['Body']) and ('application/pdf' in m['Content']['Body']) for m in mails), len(mails))
a = qa.call('POST', f'/training/activities/{aid}/confirm-completion', {'version': get(aid)['version'], 'signatureToken': sign(qa)})
check('4.2 QA confirms: Completed', a['status'] == 'COMPLETED', a['status'])

failed = [r for r in results if not r[1]]
print(f'\n{len(results) - len(failed)} of {len(results)} checks passed')
sys.exit(1 if failed else 0)
