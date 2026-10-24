"""PLAN-TR-002 on DEV: a training that starts from a document (Document Control). The password comes from DEVPW and is never written to disk; the records are titled "E2E-TEST ..."."""
import os, sys, json, io, zipfile
sys.path.insert(0, os.path.dirname(__file__))
from api import Client

PW = os.environ['DEVPW']
results = []


def sign(c):
    return c.call('POST', '/auth/verify-signature', {'username': c.user['username'], 'password': PW})['signatureToken']


def check(name, ok, detail=''):
    results.append((name, ok, detail))
    print(('PASS  ' if ok else 'FAIL  ') + name + (' -- ' + str(detail) if detail and not ok else ''))


def attempt(c, method, path, body=None):
    code, payload = c.call(method, path, body, raw=True)
    try:
        data = json.loads(payload) if payload else {}
    except Exception:
        data = {}
    return code, data, payload[:300].decode('utf-8', 'ignore')


def mini_docx(text):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        z.writestr('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        z.writestr('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>' + text + '</w:t></w:r></w:p></w:body></w:document>')
    return buf.getvalue()


admin = Client('admin')
reviewer = Client('dco.test1')
approver = Client('approver.test1')

print('== 1. the document is created: the Training Number is given at once')
body = {'documentName': 'E2E-TEST SOP from document', 'documentType': 'Standard Operating Procedure', 'businessUnit': 'Quality Unit', 'department': 'Quality Assurance',
        'author': admin.user['id'], 'language': 'English', 'requiresTraining': True, 'trainingPeriodDays': 14, 'description': 'E2E-TEST', 'isTemplate': False,
        'coAuthorIds': [], 'reviewerUserIds': [reviewer.user['id']], 'approverUserIds': [approver.user['id']], 'relatedDocumentIds': [], 'correlatedDocumentIds': []}
doc = admin.call('POST', '/documents', body)
print('   document', doc['documentNumber'], doc['status'])
lst = admin.call('GET', '/training/activities?limit=5&search=' + doc['documentNumber'])
rows = [r for r in lst['data'] if r.get('documentNumber') == doc['documentNumber']]
check('1.1 a Training Number is given with the document', len(rows) == 1, lst['data'])
act = admin.call('GET', '/training/activities/' + rows[0]['id'])
print('   activity', act['trainingNumber'], act['status'])
check('1.2 the activity waits for the document (Reserved)', act['status'] == 'RESERVED', act['status'])
check('1.3 the document is the material and nothing is missing', act['contentRules']['materialsSource'] == 'DOCUMENT' and act['contentRules']['missing'] == [], act['contentRules'])

print('\n== 2. the document goes through its revision, review and approval')
rev = admin.call('POST', f"/documents/{doc['id']}/revisions", {})
rid = rev['id']
print('   revision', rev.get('revisionNumber'), rev.get('status'))
up = admin.upload(f'/revisions/{rid}/upload', 'file', 'e2e-test-sop.docx', mini_docx('E2E-TEST SOP'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
code, data, text = attempt(admin, 'POST', f'/revisions/{rid}/complete-editing', {'signatureToken': sign(admin), 'comment': 'E2E-TEST', 'reason': 'E2E-TEST'})
check('2.1 editing completed', code == 200, (code, text))
code, data, text = attempt(admin, 'POST', f'/revisions/{rid}/submit-review', {'signatureToken': sign(admin), 'comment': 'E2E-TEST', 'reason': 'E2E-TEST'})
check('2.2 submitted for review', code == 200, (code, text))
code, data, text = attempt(reviewer, 'POST', f'/revisions/{rid}/review/complete', {'signatureToken': sign(reviewer), 'comment': 'E2E-TEST', 'reason': 'E2E-TEST'})
check('2.3 reviewed', code == 200, (code, text))
code, data, text = attempt(approver, 'POST', f'/revisions/{rid}/approve/complete', {'signatureToken': sign(approver), 'comment': 'E2E-TEST', 'reason': 'E2E-TEST'})
check('2.4 approved', code == 200, (code, text))
act = admin.call('GET', '/training/activities/' + rows[0]['id'])
print('   activity after the approval:', act['status'], 'due', act.get('dueDate'), 'approved on', act.get('approvedOn'))
check('3.1 the activity opens (Planned) when the document is approved', act['status'] == 'PLANNED', act['status'])
check('3.2 the due date counts from the approval', bool(act.get('dueDate') and act.get('approvedOn')), (act.get('approvedOn'), act.get('dueDate')))

print('\n== 3. the organizer plans it: the document is the material, the session still asks for its test')
a = admin.call('POST', f"/training/activities/{act['id']}/sessions", {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'External Trainer', 'scheduledOn': act.get('dueDate'), 'venue': 'Room 1', 'topics': [{'topicText': 'E2E-TEST SOP'}]})
check('4.1 the test is missing, the materials are not', a['contentRules']['missing'] == ['TRAINING_TEST_REQUIRED'] and a['contentRules']['materialsSatisfied'], a['contentRules'])

failed = [r for r in results if not r[1]]
print(f'\n{len(results) - len(failed)} of {len(results)} checks passed')
sys.exit(1 if failed else 0)
