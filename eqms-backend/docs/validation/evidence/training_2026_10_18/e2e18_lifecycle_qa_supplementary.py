"""DEV: the whole life of a training (content, notify, hold, attendance, results, Send to QA, QA confirms), the notice to QA, the days to send the results, a supplementary training
for the person who was absent (it keeps the content of the training it supplements) and an external training. The password comes from DEVPW; records are titled "E2E-TEST ..."."""
import os, sys, json, datetime
sys.path.insert(0, os.path.dirname(__file__))
from api import Client, tick_all, finish_for_qa

PW = os.environ['DEVPW']
TODAY = datetime.date.today().isoformat()
results = []


def sign(c):
    return c.call('POST', '/auth/verify-signature', {'username': c.user['username'], 'password': PW})['signatureToken']


def check(name, ok, detail=''):
    results.append((name, ok, detail))
    print(('PASS  ' if ok else 'FAIL  ') + name + (' -- ' + str(detail)[:300] if detail and not ok else ''))


def attempt(c, method, path, body=None):
    code, payload = c.call(method, path, body, raw=True)
    try:
        data = json.loads(payload) if payload else {}
    except Exception:
        data = {}
    return code, data, payload[:300].decode('utf-8', 'ignore')


def mini_pdf(text):
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


admin = Client('admin')
qa = Client('approver.test1')          # holds training.activity.close: the QA of this test
reviewer = Client('approver.test1')
trainee = Client('user.a.test')
absentee = Client('dco.test1')


def get(aid):
    return admin.call('GET', f'/training/activities/{aid}')


print('== 1. the whole life of a classroom training')
a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'trainingTitle': 'E2E-TEST lifecycle'})
aid = a['id']
a = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'External Trainer', 'scheduledOn': TODAY, 'venue': 'Room 1', 'topics': [{'topicText': 'E2E-TEST topic'}]})
sid = a['sessions'][0]['id']
a = admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': [trainee.user['id'], absentee.user['id']], 'reason': 'E2E-TEST'})
pid = {p['personUserId']: p['id'] for p in a['participants']}
admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'E2E-TEST'})
admin.call('POST', f'/training/activities/{aid}/material-links', {'title': 'E2E-TEST video', 'url': 'https://example.com/e2e'})
admin.upload(f'/training/activities/{aid}/materials', 'file', 'e2e-exam.pdf', mini_pdf('E2E-TEST exam'), 'application/pdf', '?purpose=EXAM&title=E2E-TEST%20exam')
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': reviewer.user['id']})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': trainee.user['id']})
reviewer.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(reviewer)})
trainee.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(trainee)})
a = admin.call('POST', f'/training/activities/{aid}/notify', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
check('1.1 notified', a['status'] == 'NOTIFIED', a['status'])
tick_all(admin, sid)
a = admin.call('POST', f'/training/sessions/{sid}/hold', {'signatureToken': sign(admin)})
check('1.2 the first session held: In progress', a['status'] == 'IN_PROGRESS', a['status'])
check('1.3 the days to send the results to QA are counted from the day held', a['resultsToQa']['state'] in ('DUE', 'DUE_TODAY') and a['resultsToQa']['dueOn'] > TODAY, a['resultsToQa'])
admin.call('POST', f"/training/participants/{pid[trainee.user['id']]}/attendance", {'state': 'ATTENDED'})
admin.call('POST', f"/training/participants/{pid[absentee.user['id']]}/attendance", {'state': 'ABSENT', 'absenceReason': 'E2E-TEST on leave'})
a = admin.call('POST', f"/training/participants/{pid[trainee.user['id']]}/assessments", {'scoreObtained': 9, 'scoreMax': 10, 'remarks': 'E2E-TEST'})
check('1.4 a result of 90% passes (pass mark 70%)', [p for p in a['participants'] if p['id'] == pid[trainee.user['id']]][0]['result'] == 'PASSED', a['participants'])
before = admin.call('GET', '/notifications?limit=50&page=1')
before_n = len([n for n in (before.get('data') or before.get('items') or []) if 'waiting for QA' in (n.get('title') or '')])
finish_for_qa(admin, aid, lambda: sign(admin))
a = admin.call('POST', f'/training/activities/{aid}/submit-for-confirmation', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
check('1.5 sent to QA', a['status'] == 'PENDING_QA_CONFIRMATION', a['status'])
after = qa.call('GET', '/notifications?limit=50&page=1')
rows = after.get('data') or after.get('items') or []
mine = [n for n in rows if 'waiting for QA' in (n.get('title') or '')]
check('1.6 the QA person is told at once', len(mine) >= 1, [n.get('title') for n in rows][:6])
check('1.7 the sender is not told', len([n for n in (admin.call('GET', '/notifications?limit=50&page=1').get('data') or []) if 'waiting for QA' in (n.get('title') or '')]) == before_n, 'sender got a notice')
check('1.8 the results are marked as sent', get(aid)['resultsToQa']['state'] == 'SENT', get(aid)['resultsToQa'])
code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/confirm-completion', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
check('1.9 the person who prepared the list cannot confirm (segregation of duties)', 'TRAINING_SEGREGATION_OF_DUTIES' in text, (code, text))
a = qa.call('POST', f'/training/activities/{aid}/confirm-completion', {'version': get(aid)['version'], 'signatureToken': sign(qa)})
check('1.10 QA confirms: Completed', a['status'] == 'COMPLETED', a['status'])
print('   activity', a['trainingNumber'], 'completed on', a.get('completedOn'))

print('\n== 2. supplementary training for the person who was absent')
a = admin.call('POST', f'/training/activities/{aid}/supplementary', {'participantIds': [pid[absentee.user['id']]], 'reason': 'E2E-TEST make-up'})
child = a['id']
print('   child', a['trainingNumber'], a['status'], a['kind'])
check('2.1 the number of the activity with the next letter', a['trainingNumber'].startswith(get(aid)['trainingNumber']) and a['trainingNumber'] != get(aid)['trainingNumber'], a['trainingNumber'])
check('2.2 it keeps the content of the training it supplements: nothing is missing', a['contentRules']['inherited'] and a['contentRules']['missing'] == [], a['contentRules'])
a = admin.call('POST', f'/training/activities/{child}/sessions', {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'External Trainer', 'scheduledOn': TODAY, 'venue': 'Room 1', 'topics': [{'topicText': 'E2E-TEST make-up'}]})
check('2.3 a session with a Test still needs no file', a['contentRules']['missing'] == [], a['contentRules'])
sid2 = a['sessions'][0]['id']
a = admin.call('POST', f'/training/activities/{child}/participants', {'sessionId': sid2, 'personUserIds': [absentee.user['id']], 'reason': 'E2E-TEST make-up'})
admin.call('POST', f'/training/activities/{child}/confirm-list', {'signatureToken': sign(admin), 'reason': 'E2E-TEST'})
admin.call('PUT', f'/training/activities/{child}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': reviewer.user['id']})
admin.call('PUT', f'/training/activities/{child}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': trainee.user['id']})
code, data, text = attempt(reviewer, 'POST', f'/training/activities/{child}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(reviewer)})
check('2.4 its content can be reviewed without a file', code == 200, (code, text))

print('\n== 3. an external training')
a = admin.call('POST', '/training/activities', {'kind': 'EXTERNAL', 'externalType': 'ACTIVE', 'kindReason': 'OTHER', 'trainingTitle': 'E2E-TEST external', 'trainingUnitName': 'E2E-TEST Training Unit'})
ext = a['id']
check('3.1 an external training needs no material and no test', a['contentRules']['missing'] == [], a['contentRules'])
a = admin.call('POST', f'/training/activities/{ext}/sessions', {'externalTrainerName': 'E2E Consultant', 'scheduledOn': TODAY, 'venue': 'Hotel', 'topics': [{'topicText': 'E2E-TEST external topic'}]})
check('3.2 still nothing missing with a session', a['contentRules']['missing'] == [], a['contentRules'])

failed = [r for r in results if not r[1]]
print(f'\n{len(results) - len(failed)} of {len(results)} checks passed')
sys.exit(1 if failed else 0)
