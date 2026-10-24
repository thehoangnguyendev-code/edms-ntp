"""DEV: a training that starts from a document, from the creation of the document to "Complete Training" of its revision. The document is created (the Training Number is given at once), written,
reviewed and approved; the activity opens (Planned); it is planned, notified, started, attended, scored, sent to QA and completed; the capability "completeTraining" then shows the button of the
screen, and "Complete Training" of the revision moves the revision on. The password comes from DEVPW (never written); records are titled "E2E-TEST ..."; none is deleted."""
import os, sys, json, io, zipfile, datetime
sys.path.insert(0, os.path.dirname(__file__))
from api import Client, tick_all, finish_for_qa
from e2e21_matrix import mini_pdf, attempt, check, sign, results, admin, qa, trainee, other, get, TODAY

reviewer = Client('dco.test1')       # reviews the document
approver = Client('approver.test1')  # approves the document, and is QA of the training


def mini_docx(text):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        z.writestr('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        z.writestr('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>' + text + '</w:t></w:r></w:p></w:body></w:document>')
    return buf.getvalue()


print('== 1. the document, its revision, review and approval')
body = {'documentName': 'E2E-TEST SOP to completion', 'documentType': 'Standard Operating Procedure', 'businessUnit': 'Quality Unit', 'department': 'Quality Assurance',
        'author': admin.user['id'], 'language': 'English', 'requiresTraining': True, 'trainingPeriodDays': 14, 'description': 'E2E-TEST', 'isTemplate': False,
        'coAuthorIds': [], 'reviewerUserIds': [reviewer.user['id']], 'approverUserIds': [approver.user['id']], 'relatedDocumentIds': [], 'correlatedDocumentIds': []}
doc = admin.call('POST', '/documents', body)
rows = [r for r in admin.call('GET', '/training/activities?limit=5&search=' + doc['documentNumber'])['data'] if r.get('documentNumber') == doc['documentNumber']]
check('1.1 a Training Number is given with the document and the activity waits (Pending Document Approval)', len(rows) == 1 and rows[0]['status'] == 'RESERVED', rows)
aid = rows[0]['id']
rev = admin.call('POST', f"/documents/{doc['id']}/revisions", {})
rid = rev['id']
admin.upload(f'/revisions/{rid}/upload', 'file', 'e2e-test-sop.docx', mini_docx('E2E-TEST SOP'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
for who, step in ((admin, 'complete-editing'), (admin, 'submit-review'), (reviewer, 'review/complete'), (approver, 'approve/complete')):
    code, data, text = attempt(who, 'POST', f'/revisions/{rid}/{step}', {'signatureToken': sign(who), 'comment': 'E2E-TEST', 'reason': 'E2E-TEST'})
    check(f'1.2 {step}', code == 200, (code, text))
a = get(aid)
check('1.3 the document is approved: the activity opens (Planned) with the day it was approved', a['status'] == 'PLANNED' and bool(a.get('approvedOn')), (a['status'], a.get('approvedOn')))
code, data, text = attempt(admin, 'GET', f'/training/links/revisions/{rid}')
check('1.4 Document Control reads the status text from the server: "Planned"', code == 200 and data.get('statusLabel') == 'Planned', data)

print(chr(10) + '== 2. the organizer plans and runs the training')
a = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'External Trainer', 'scheduledOn': TODAY, 'venue': 'Room 1', 'topics': [{'topicText': 'E2E-TEST SOP'}]})
sid = a['sessions'][0]['id']
check('2.1 the document is the material; the test is still missing', a['contentRules']['materialsSatisfied'] and a['contentRules']['missing'] == ['TRAINING_TEST_REQUIRED'], a['contentRules'])
admin.upload(f'/training/activities/{aid}/materials', 'file', 'e2e-test.pdf', mini_pdf('E2E-TEST'), 'application/pdf', '?purpose=EXAM&title=E2E-TEST%20test')
a = admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': [trainee.user['id']], 'reason': 'E2E-TEST'})
pid = a['participants'][0]['id']
admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'E2E-TEST'})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': qa.user['id']})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': trainee.user['id']})
qa.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(qa)})
trainee.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(trainee)})
a = admin.call('POST', f'/training/activities/{aid}/notify', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
check('2.2 notified', a['status'] == 'NOTIFIED', a['status'])
tick_all(admin, sid)
a = admin.call('POST', f'/training/sessions/{sid}/hold', {'signatureToken': sign(admin)})
check('2.3 started', a['status'] == 'IN_PROGRESS', a['status'])
admin.call('POST', f'/training/participants/{pid}/attendance', {'state': 'ATTENDED'})
a = admin.call('POST', f'/training/participants/{pid}/assessments', {'scoreObtained': 9, 'scoreMax': 10, 'remarks': 'E2E-TEST'})
finish_for_qa(admin, aid, lambda: sign(admin))
a = admin.call('POST', f'/training/activities/{aid}/submit-for-confirmation', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
check('2.4 sent to QA', a['status'] == 'PENDING_QA_CONFIRMATION', a['status'])
check('2.5 sending the results sends the attendance list too: the revision can be completed already', a['capabilities'].get('completeTraining') is True and bool(a.get('attendanceSentAt')), (a['capabilities'].get('completeTraining'), a.get('attendanceSentAt')))
a = qa.call('POST', f'/training/activities/{aid}/confirm-completion', {'version': get(aid)['version'], 'signatureToken': sign(qa)})
check('2.6 completed by QA', a['status'] == 'COMPLETED', a['status'])

print(chr(10) + '== 3. Complete Training of the revision')
a = get(aid)
check('3.1 the capability completeTraining is on (the screen shows the button)', a['capabilities'].get('completeTraining') is True, a['capabilities'].get('completeTraining'))
row = [r for r in admin.call('GET', '/training/activities?limit=5&search=' + doc['documentNumber'])['data'] if r['id'] == aid][0]
check('3.2 the list gives the same action', row.get('actions', {}).get('completeTraining') is True, row.get('actions'))
link = admin.call('GET', f'/training/links/revisions/{rid}')
check('3.3 the revision sees the status text "Completed" and the completion day', link.get('statusLabel') == 'Completed' and bool(link.get('completedOn')), link)
KEEP = 'keep' in sys.argv   # keep: leave the revision waiting for "Complete Training", for the check of the screen
if KEEP:
    print('KEEP', aid, rid)
else:
    code, data, text = attempt(admin, 'POST', f'/revisions/{rid}/training/complete', {'signatureToken': sign(admin), 'comment': 'E2E-TEST', 'reason': 'E2E-TEST'})
    check('3.4 Complete Training of the revision', code == 200, (code, text))
    check('3.5 after it the button is gone', get(aid)['capabilities'].get('completeTraining') is False, get(aid)['capabilities'].get('completeTraining'))

failed = [r for r in results if not r[1]]
print(f'\n{len(results) - len(failed)} of {len(results)} checks passed')
sys.exit(1 if failed else 0)
