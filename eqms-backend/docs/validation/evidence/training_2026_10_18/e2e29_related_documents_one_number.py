"""DEV: the documents that go together share one Training Number. A SOP lists two documents as related; their own numbers are given up; the three revisions carry the number of the SOP; the training
opens only when the three are approved; once it is completed each revision waits for its own "Complete Training". The password comes from DEVPW (never written); records are titled "E2E-TEST ...";
none is deleted."""
import os, sys, io, zipfile, datetime
sys.path.insert(0, os.path.dirname(__file__))
from api import Client, tick_all, finish_for_qa
from e2e21_matrix import mini_pdf, attempt, check, sign, results, admin, qa, trainee, get, TODAY

reviewer = Client('dco.test1')
approver = Client('approver.test1')


def mini_docx(text):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        z.writestr('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        z.writestr('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>' + text + '</w:t></w:r></w:p></w:body></w:document>')
    return buf.getvalue()


def new_document(name, related=None):
    body = {'documentName': name, 'documentType': 'Standard Operating Procedure', 'businessUnit': 'Quality Unit', 'department': 'Quality Assurance', 'author': admin.user['id'], 'language': 'English',
            'requiresTraining': True, 'trainingPeriodDays': 14, 'description': 'E2E-TEST', 'isTemplate': False, 'coAuthorIds': [], 'reviewerUserIds': [reviewer.user['id']],
            'approverUserIds': [approver.user['id']], 'relatedDocumentIds': related or [], 'correlatedDocumentIds': []}
    return admin.call('POST', '/documents', body)


def activity_of(document):
    rows = [r for r in admin.call('GET', '/training/activities?limit=20&search=' + document['documentNumber'])['data'] if r.get('documentNumber') == document['documentNumber']]
    return rows


def approve(revision_id):
    admin.upload(f'/revisions/{revision_id}/upload', 'file', 'e2e-test.docx', mini_docx('E2E-TEST'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    for who, step in ((admin, 'complete-editing'), (admin, 'submit-review'), (reviewer, 'review/complete'), (approver, 'approve/complete')):
        code, data, text = attempt(who, 'POST', f'/revisions/{revision_id}/{step}', {'signatureToken': sign(who), 'comment': 'E2E-TEST', 'reason': 'E2E-TEST'})
        if code != 200:
            check(f'{step} of {revision_id}', False, (code, text))


print('== 1. two documents with a number of their own, then a SOP that lists them as related')
d1 = new_document('E2E-TEST related form 1')
d2 = new_document('E2E-TEST related form 2')
n1 = activity_of(d1)[0]
n2 = activity_of(d2)[0]
check('1.1 each document has its own Training Number at first', n1['trainingNumber'] != n2['trainingNumber'], (n1['trainingNumber'], n2['trainingNumber']))
sop = new_document('E2E-TEST SOP with related', related=[d1['id'], d2['id']])
lead = activity_of(sop)
check('1.2 the SOP has one Training Number', len(lead) == 1 and lead[0]['status'] == 'RESERVED', lead)
number = lead[0]['trainingNumber']
check('1.3 the numbers of the related documents are given up (cancelled, never used again)', activity_of(d1)[0]['status'] == 'CANCELLED' and activity_of(d2)[0]['status'] == 'CANCELLED', [a['status'] for a in activity_of(d1) + activity_of(d2)])

print(chr(10) + '== 2. the three revisions carry the number of the SOP')
r_sop = admin.call('POST', f"/documents/{sop['id']}/revisions", {})['id']
r1 = admin.call('POST', f"/documents/{d1['id']}/revisions", {})['id']
r2 = admin.call('POST', f"/documents/{d2['id']}/revisions", {})['id']
for name, rid in (('SOP', r_sop), ('form 1', r1), ('form 2', r2)):
    link = admin.call('GET', f'/training/links/revisions/{rid}')
    check(f'2.1 {name}: the revision shows the number of the SOP', link.get('trainingNumber') == number, link)
check('2.2 no new number was issued for the related documents', [a for a in activity_of(d1) if a['status'] != 'CANCELLED'] == [] and [a for a in activity_of(d2) if a['status'] != 'CANCELLED'] == [])
aid = lead[0]['id']
a = get(aid)
check('2.3 the activity lists the three documents', len(a.get('groupRevisions') or []) == 3 and [g['isMain'] for g in a['groupRevisions']].count(True) == 1, a.get('groupRevisions'))

print(chr(10) + '== 3. the training opens when the three are approved (the same release)')
approve(r_sop)
check('3.1 the SOP approved: the training still waits (the forms are not approved)', get(aid)['status'] == 'RESERVED', get(aid)['status'])
approve(r1)
check('3.2 one form approved: still waiting', get(aid)['status'] == 'RESERVED', get(aid)['status'])
approve(r2)
a = get(aid)
check('3.3 the last form approved: Planned, the due day counts from today', a['status'] == 'PLANNED' and a.get('approvedOn') == TODAY and bool(a.get('dueDate')), (a['status'], a.get('approvedOn'), a.get('dueDate')))

print(chr(10) + '== 4. the training, then Complete Training of each revision')
a = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainer': None, 'externalTrainerName': 'External Trainer', 'scheduledOn': TODAY, 'venue': 'Room 1', 'topics': [{'topicText': 'E2E-TEST SOP and forms'}]})
sid = a['sessions'][0]['id']
admin.upload(f'/training/activities/{aid}/materials', 'file', 'e2e-test.pdf', mini_pdf('E2E-TEST'), 'application/pdf', '?purpose=EXAM&title=E2E-TEST%20test')
a = admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': [trainee.user['id']], 'reason': 'E2E-TEST'})
pid = a['participants'][0]['id']
admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'E2E-TEST'})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': qa.user['id']})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': trainee.user['id']})
qa.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(qa)})
trainee.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(trainee)})
admin.call('POST', f'/training/activities/{aid}/notify', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
tick_all(admin, sid)
admin.call('POST', f'/training/sessions/{sid}/hold', {'signatureToken': sign(admin)})
admin.call('POST', f'/training/participants/{pid}/attendance', {'state': 'ATTENDED'})
admin.call('POST', f'/training/participants/{pid}/assessments', {'scoreObtained': 9, 'scoreMax': 10})
finish_for_qa(admin, aid, lambda: sign(admin))
admin.call('POST', f'/training/activities/{aid}/submit-for-confirmation', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
qa.call('POST', f'/training/activities/{aid}/confirm-completion', {'version': get(aid)['version'], 'signatureToken': sign(qa)})
a = get(aid)
check('4.1 completed', a['status'] == 'COMPLETED', a['status'])
waiting = [g for g in a['groupRevisions'] if g['revisionStatus'] == 'PENDING_TRAINING']
check('4.2 the three revisions wait for Complete Training and the screen shows a button for each', len(waiting) == 3 and a['capabilities'].get('completeTraining') is True, a['groupRevisions'])
row = [r for r in admin.call('GET', '/training/activities?limit=5&search=' + number)['data'] if r['id'] == aid][0]
check('4.3 the list has the action and links to a revision of the group', row.get('actions', {}).get('completeTraining') is True and row.get('revisionId') in [g['revisionId'] for g in waiting], row.get('revisionId'))
for g in waiting:
    code, data, text = attempt(admin, 'POST', f"/revisions/{g['revisionId']}/training/complete", {'signatureToken': sign(admin), 'comment': 'E2E-TEST', 'reason': 'E2E-TEST'})
    check(f"4.4 Complete Training of {g['documentNumber']}", code == 200, (code, text))
a = get(aid)
check('4.5 when all are done the button is gone', a['capabilities'].get('completeTraining') is False, a['capabilities'].get('completeTraining'))

failed = [r for r in results if not r[1]]
print(f'\n{len(results) - len(failed)} of {len(results)} checks passed')
sys.exit(1 if failed else 0)
