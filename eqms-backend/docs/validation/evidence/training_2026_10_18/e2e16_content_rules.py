"""PLAN-TR-002 on DEV: Training Materials and Assessment form by case, from the Training Activities screen (the same API the screen calls).
The password comes from the environment variable DEVPW and is never written to disk. Every record made here is titled "E2E-TEST ..." and is left in place."""
import os, sys, json, datetime
sys.path.insert(0, os.path.dirname(__file__))
from api import Client

PW = os.environ['DEVPW']
TODAY = datetime.date.today().isoformat()
MATERIALS, TEST, CHECKLIST = 'TRAINING_MATERIALS_REQUIRED', 'TRAINING_TEST_REQUIRED', 'TRAINING_CHECKLIST_REQUIRED'
results = []


def sign(c):
    return c.call('POST', '/auth/verify-signature', {'username': c.user['username'], 'password': PW})['signatureToken']


def mini_pdf(text):
    """A small valid PDF (one page of text), with a correct cross-reference table."""
    objs = [b'<< /Type /Catalog /Pages 2 0 R >>', b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>']
    stream = ('BT /F1 14 Tf 60 780 Td (' + text + ') Tj ET').encode()
    objs.append(b'<< /Length ' + str(len(stream)).encode() + b' >>\nstream\n' + stream + b'\nendstream')
    objs.append(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
    out = b'%PDF-1.4\n'
    offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += str(i).encode() + b' 0 obj\n' + o + b'\nendobj\n'
    xref = len(out)
    out += b'xref\n0 ' + str(len(objs) + 1).encode() + b'\n0000000000 65535 f \n'
    for off in offsets:
        out += ('%010d 00000 n \n' % off).encode()
    out += b'trailer\n<< /Size ' + str(len(objs) + 1).encode() + b' /Root 1 0 R >>\nstartxref\n' + str(xref).encode() + b'\n%%EOF\n'
    return out


def check(name, ok, detail=''):
    results.append((name, ok, detail))
    print(('PASS  ' if ok else 'FAIL  ') + name + (' -- ' + str(detail) if detail and not ok else ''))


def attempt(c, method, path, body=None):
    code, payload = c.call(method, path, body, raw=True)
    try:
        data = json.loads(payload) if payload else {}
    except Exception:
        data = {'raw': payload[:200]}
    return code, data, payload.decode('utf-8', 'ignore') if isinstance(payload, bytes) else str(payload)


admin = Client('admin')
approver = Client('approver.test1')
trainee = Client('user.a.test')


def prepare(title, kind='UNPLANNED', reason='OTHER', session=None, designate=True):
    """What the screen does: create the activity, add a session and a person, confirm the list, name who reviews and who approves the content."""
    a = admin.call('POST', '/training/activities', {'kind': kind, 'kindReason': reason, 'trainingTitle': 'E2E-TEST ' + title})
    aid = a['id']
    body = {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'External Trainer', 'scheduledOn': TODAY, 'venue': 'Room 1', 'topics': [{'topicText': 'E2E-TEST topic'}]}
    body.update(session or {})
    a = admin.call('POST', f'/training/activities/{aid}/sessions', body)
    sid = a['sessions'][0]['id']
    admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': [trainee.user['id']], 'reason': 'E2E-TEST'})
    admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'E2E-TEST'})
    if designate:
        admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': approver.user['id']})
        admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': trainee.user['id']})
    return aid


def rules(aid):
    return admin.call('GET', f'/training/activities/{aid}')['contentRules']


def review(aid):
    return attempt(approver, 'POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(approver)})


# ---------------------------------------------------------------------------------------------------------------- 1. a classroom training on a standard topic
print('\n== 1. Training Activities screen: classroom session with a Test, no document')
aid = prepare('classroom test')
a = admin.call('GET', f'/training/activities/{aid}')
check('1.1 missing: materials and test', a['contentRules']['missing'] == [MATERIALS, TEST], a['contentRules'])
check('1.2 Notify lists the same blockers', MATERIALS in a['capabilities']['notifyBlockers'] and TEST in a['capabilities']['notifyBlockers'], a['capabilities']['notifyBlockers'])
code, data, text = review(aid)
check('1.3 the review is refused for the materials', code == 409 and MATERIALS in text, (code, text[:160]))
admin.call('POST', f'/training/activities/{aid}/material-links', {'title': 'E2E-TEST video', 'url': 'https://example.com/e2e-training'})
check('1.4 a link satisfies the materials, the test is still missing', rules(aid)['missing'] == [TEST], rules(aid))
code, data, text = review(aid)
check('1.5 the review is refused for the test', code == 409 and TEST in text, (code, text[:160]))
admin.upload(f'/training/activities/{aid}/materials', 'file', 'e2e-test-exam.pdf', mini_pdf('E2E-TEST exam APD.0009'), 'application/pdf', '?purpose=EXAM&title=E2E-TEST%20exam')
check('1.6 nothing missing after the test is uploaded', rules(aid)['missing'] == [], rules(aid))
code, data, text = review(aid)
check('1.7 the content can be reviewed', code == 200, (code, text[:200]))
code, data, text = attempt(trainee, 'POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(trainee)})
check('1.8 the content can be approved', code == 200, (code, text[:200]))
a = admin.call('GET', f'/training/activities/{aid}')
code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/content-exemptions', {'materialsExempt': True, 'reason': 'too late'})
check('1.9 an exemption is refused once the content is reviewed', code == 409, (code, text[:160]))
code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/notify', {'version': a['version'], 'signatureToken': sign(admin)})
check('1.10 the activity can be notified', code == 200 and data.get('status') == 'NOTIFIED', (code, text[:200]))
print('   activity', a['trainingNumber'])

# ---------------------------------------------------------------------------------------------------------------- 2. exemption with a reason
print('\n== 2. exemption of the organizer')
aid = prepare('exemption')
code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/content-exemptions', {'materialsExempt': True})
check('2.1 an exemption without a reason is refused', code == 400, (code, text[:160]))
a = admin.call('POST', f'/training/activities/{aid}/content-exemptions', {'materialsExempt': True, 'assessmentExempt': True, 'reason': 'E2E-TEST short briefing, no test'})
check('2.2 both exempted, nothing missing', a['contentRules']['missing'] == [] and a['materialsExempt'] and a['assessmentExempt'], a['contentRules'])
check('2.3 the reason is kept', 'short briefing' in (a.get('materialsExemptReason') or ''), a.get('materialsExemptReason'))
a = admin.call('POST', f'/training/activities/{aid}/content-exemptions', {'assessmentExempt': False})
check('2.4 taking back the exemption of the test makes it required again', a['contentRules']['missing'] == [TEST], a['contentRules'])
a = admin.call('POST', f'/training/activities/{aid}/content-exemptions', {'assessmentExempt': True, 'reason': 'E2E-TEST again'})
code, data, text = review(aid)
check('2.5 the content can be reviewed with the exemptions', code == 200, (code, text[:200]))

# ---------------------------------------------------------------------------------------------------------------- 3. self-reading
print('\n== 3. self-reading: a document to read, no test')
aid = prepare('self reading', session={'method': 'SELF_READING', 'assessmentMethod': 'SELF_READING_CONFIRMATION'})
check('3.1 only the materials are missing', rules(aid)['missing'] == [MATERIALS] and not rules(aid)['testRequired'], rules(aid))
admin.call('POST', f'/training/activities/{aid}/material-links', {'title': 'E2E-TEST SOP to read', 'url': 'https://example.com/e2e-sop'})
check('3.2 a link is enough', rules(aid)['missing'] == [], rules(aid))
code, data, text = review(aid)
check('3.3 the content can be reviewed', code == 200, (code, text[:200]))

# ---------------------------------------------------------------------------------------------------------------- 4. practical + checklist
print('\n== 4. practical session with a checklist')
aid = prepare('practical checklist', session={'method': 'PRACTICAL', 'assessmentMethod': 'CHECKLIST'})
check('4.1 materials and the checklist form are missing', rules(aid)['missing'] == [MATERIALS, CHECKLIST], rules(aid))
admin.call('POST', f'/training/activities/{aid}/material-links', {'title': 'E2E-TEST work instruction', 'url': 'https://example.com/e2e-wi'})
admin.upload(f'/training/activities/{aid}/materials', 'file', 'e2e-test-checklist.pdf', mini_pdf('E2E-TEST checklist APD.0009'), 'application/pdf', '?purpose=EXAM&title=E2E-TEST%20checklist')
check('4.2 nothing missing after the checklist form', rules(aid)['missing'] == [], rules(aid))

# ---------------------------------------------------------------------------------------------------------------- 5. observation
print('\n== 5. practical session with an observation: no file')
aid = prepare('practical observation', session={'method': 'PRACTICAL', 'assessmentMethod': 'OBSERVATION'})
check('5.1 only the materials are missing', rules(aid)['missing'] == [MATERIALS], rules(aid))

# ---------------------------------------------------------------------------------------------------------------- 6. visitor
print('\n== 6. visitor: nothing required')
aid = prepare('visitor', reason='VISITOR')
check('6.1 nothing missing with a Test session', rules(aid)['missing'] == [], rules(aid))

# ---------------------------------------------------------------------------------------------------------------- 7. a test written in the system
print(chr(10) + '== 7. the test is written in the system: no file is needed for it')
aid = prepare('online test')
admin.call('POST', f'/training/activities/{aid}/material-links', {'title': 'E2E-TEST video', 'url': 'https://example.com/e2e-online'})
check('7.1 the test is still missing', rules(aid)['missing'] == [TEST], rules(aid))
admin.call('PUT', f'/training/activities/{aid}/exam', {'minutes': 10, 'questions': [
    {'kind': 'SINGLE', 'prompt': 'E2E-TEST question?', 'options': [{'id': 'A', 'text': 'Yes'}, {'id': 'B', 'text': 'No'}], 'correct': ['A'], 'points': 1}]})
r = rules(aid)
check('7.2 the questions are the test: nothing is missing and no file', r['missing'] == [] and r['onlineTest'] and not r['assessmentFormSatisfied'], r)
code, data, text = review(aid)
check('7.3 the content can be reviewed with a test written in the system', code == 200, (code, text[:200]))

failed = [r for r in results if not r[1]]
print(f'\n{len(results) - len(failed)} of {len(results)} checks passed')
sys.exit(1 if failed else 0)
