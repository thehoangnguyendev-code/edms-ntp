"""DEV: the start of the training and the signatures of the changes of state. Notify, start (first session) and send to QA are signed; a session has no held state; the server holds the start until
the checklist is ready; logout / login again finds the same state. The password comes from DEVPW; records are titled "E2E-TEST ...", none is deleted."""
import os, sys, json, datetime
sys.path.insert(0, os.path.dirname(__file__))
from playwright.sync_api import sync_playwright
from api import Client, tick_all, finish_for_qa

PW = os.environ['DEVPW']
BASE = 'http://localhost:3000'
TODAY = datetime.date.today().isoformat()
HERE = os.path.dirname(__file__)
results = []
notify_unsigned = []


def check(name, ok, detail=''):
    results.append((name, ok, detail))
    print(('PASS  ' if ok else 'FAIL  ') + name + (' -- ' + str(detail)[:300] if detail and not ok else ''))


def sign(c):
    return c.call('POST', '/auth/verify-signature', {'username': c.user['username'], 'password': PW})['signatureToken']


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
reviewer = Client('approver.test1')
trainee = Client('user.a.test')
absentee = Client('dco.test1')


def get(aid):
    return admin.call('GET', f'/training/activities/{aid}')


def notified(title):
    """A notified activity with one planned session of two people."""
    a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'trainingTitle': title})
    aid = a['id']
    a = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'External Trainer', 'scheduledOn': TODAY, 'venue': 'Room 1', 'topics': [{'topicText': title}]})
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
    code, payload = admin.call('POST', f'/training/activities/{aid}/notify', {'version': get(aid)['version']}, raw=True)
    notify_unsigned.append((code, payload[:200]))
    a = admin.call('POST', f'/training/activities/{aid}/notify', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
    assert a['status'] == 'NOTIFIED', a['status']
    return aid, sid, pid


def session_of(aid, sid):
    return [s for s in get(aid)['sessions'] if s['id'] == sid][0]


print('== 1. the start of the first session')
aid, sid, pid = notified('E2E-TEST start signed')
check('1.0 notify without a signature is refused (TRAINING_SIGNATURE_REQUIRED)', notify_unsigned[-1][0] == 400 and b'TRAINING_SIGNATURE_REQUIRED' in notify_unsigned[-1][1], notify_unsigned[-1])
check('1.1 Notified and the session is planned', get(aid)['status'] == 'NOTIFIED' and session_of(aid, sid)['status'] == 'PLANNED')
code, payload = admin.call('POST', f"/training/participants/{pid[trainee.user['id']]}/attendance", {'state': 'ATTENDED'}, raw=True)
check('1.2 an attendance before the start is refused (TRAINING_SESSION_NOT_HELD or the status)', code == 409, (code, payload[:160]))
code, payload = admin.call('POST', f'/training/sessions/{sid}/check-in/open', {}, raw=True)
check('1.3 the check-in before the start is refused', code == 409, (code, payload[:160]))
code, payload = admin.call('POST', f'/training/sessions/{sid}/hold', {'signatureToken': sign(admin)}, raw=True)
check('1.4 the start with the checklist not ticked is refused (TRAINING_PREPARATION_PENDING)', code == 409 and b'TRAINING_PREPARATION_PENDING' in payload, (code, payload[:160]))
tick_all(admin, sid)
code, payload = admin.call('POST', f'/training/sessions/{sid}/hold', {}, raw=True)
check('1.5 the start without a signature is refused (TRAINING_SIGNATURE_REQUIRED)', code == 400 and b'TRAINING_SIGNATURE_REQUIRED' in payload, (code, payload[:160]))
check('1.6 and nothing started', session_of(aid, sid)['status'] == 'PLANNED' and not session_of(aid, sid).get('heldOn') and get(aid)['status'] == 'NOTIFIED')
a = admin.call('POST', f'/training/sessions/{sid}/hold', {'signatureToken': sign(admin)})
check('1.7 the start with a signature: In progress', a['status'] == 'IN_PROGRESS', a['status'])
s = session_of(aid, sid)
check('1.8 the session has no held state and has its day', s['status'] == 'PLANNED' and s['heldOn'] == TODAY, s)
check('1.9 the days to send the results to QA count from today', get(aid)['resultsToQa']['dueOn'] > TODAY, get(aid)['resultsToQa'])
a = admin.call('POST', f"/training/participants/{pid[trainee.user['id']]}/attendance", {'state': 'ATTENDED'})
check('1.10 the attendance is recorded after the start', [p for p in a['participants'] if p['id'] == pid[trainee.user['id']]][0]['state'] == 'ATTENDED')

print(chr(10) + '== 2. send to QA is signed')
admin.call('POST', f"/training/participants/{pid[absentee.user['id']]}/attendance", {'state': 'ABSENT', 'absenceReason': 'E2E-TEST on leave'})
admin.call('POST', f"/training/participants/{pid[trainee.user['id']]}/assessments", {'scoreObtained': 9, 'scoreMax': 10, 'remarks': 'E2E-TEST'})
finish_for_qa(admin, aid, lambda: sign(admin))
code, payload = admin.call('POST', f'/training/activities/{aid}/submit-for-confirmation', {'version': get(aid)['version']}, raw=True)
check('2.1 send to QA without a signature is refused', code == 400 and b'TRAINING_SIGNATURE_REQUIRED' in payload, (code, payload[:160]))
finish_for_qa(admin, aid, lambda: sign(admin))
a = admin.call('POST', f'/training/activities/{aid}/submit-for-confirmation', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
check('2.2 send to QA with a signature', a['status'] == 'PENDING_QA_CONFIRMATION', a['status'])

print(chr(10) + '== 3. in the browser: Next signs the start; the same state after F5 and after login again')
aid3, sid3, pid3 = notified('E2E-TEST start by Next')
url = f'{BASE}/training-management/activities/{aid3}/sessions/{sid3}/workspace'


def login(p):
    b = p.chromium.launch(channel='msedge', headless=True)
    pg = b.new_page(viewport={'width': 1500, 'height': 1000})
    pg.goto(BASE + '/login', wait_until='domcontentloaded')
    pg.fill('input[name=username]', 'admin')
    pg.fill('input[name=password]', PW)
    pg.get_by_role('button', name='Sign In').click()
    pg.wait_for_timeout(4000)
    return b, pg


with sync_playwright() as p:
    b, pg = login(p)
    pg.goto(url, wait_until='domcontentloaded')
    pg.wait_for_timeout(3500)
    text = pg.inner_text('body')
    check('3.1 no "Mark as held" and no "Session held"', 'Mark as held' not in text and 'Session held' not in text)
    nxt = pg.get_by_role('button', name='Next: Attendance')
    check('3.2 Next waits for the ticks', nxt.is_disabled())
    for cb in pg.locator('input[type=checkbox]').all():
        if not cb.is_disabled() and not cb.is_checked():
            cb.click(force=True)
            pg.wait_for_timeout(700)
    pg.wait_for_timeout(800)
    check('3.3 Next is on after the ticks', nxt.is_enabled())
    nxt.click()
    pg.wait_for_timeout(1500)
    dlg = pg.inner_text('body')
    check('3.4 Next asks for the signature of the start', 'Start the training' in dlg and 'Sign & Confirm' in dlg, dlg[-300:])
    pg.locator('textarea[placeholder="Enter your reason..."]').fill('E2E-TEST start of the training')
    pg.locator('input[placeholder="Enter your username"]').fill('admin')
    pg.locator('input[type=password]').last.fill(PW)
    pg.get_by_role('button', name='Sign & Confirm').click()
    pg.wait_for_timeout(3500)
    check('3.5 started: the session has its day and the activity is in progress', session_of(aid3, sid3).get('heldOn') == TODAY and get(aid3)['status'] == 'IN_PROGRESS', (session_of(aid3, sid3), get(aid3)['status']))
    body = pg.inner_text('body')
    check('3.6 the attendance step shows the check-in and the people', 'Self check-in' in body and 'Employees' in body, body[:300])
    pg.screenshot(path=os.path.join(HERE, 'shots', 'e20_attendance.png'))
    pg.reload(wait_until='domcontentloaded')
    pg.wait_for_timeout(3500)
    body = pg.inner_text('body')
    check('3.7 F5 after Next: still on Attendance', 'Step 2: Attendance' in body, body[:200])
    admin.call('POST', f"/training/participants/{pid3[trainee.user['id']]}/attendance", {'state': 'ATTENDED'})
    b.close()
    b, pg = login(p)
    pg.goto(url, wait_until='domcontentloaded')
    pg.wait_for_timeout(3500)
    body = pg.inner_text('body')
    check('3.8 after login again with no step in the address: the first step not done (Attendance)', 'Step 2: Attendance' in body, body[:200])
    check('3.9 the attendance is still there', 'Attended' in body, body[-400:])
    pg.goto(url + '?step=ws-prepare', wait_until='domcontentloaded')
    pg.wait_for_timeout(3500)
    states = [c.is_checked() for c in pg.locator('input[type=checkbox]').all()]
    check('3.10 the ticks of Prepare are still there', len(states) >= 4 and all(states[:4]), states)
    b.close()

print(chr(10) + '== 4. Document Control reads the status text from the server')
lst = admin.call('GET', '/training/activities?limit=5&search=TRN/QA/26-101')['data']
act = get(lst[0]['id'])
if act.get('revisionId'):
    link = admin.call('GET', '/training/links/revisions/' + act['revisionId'])
    check('4.1 the link gives the code and the text', link.get('status') == act['status'] and link.get('statusLabel') in ('Planned', 'Notified', 'In progress', 'Pending QA Confirmation', 'Completed', 'Pending Document Approval', 'Closed - Cancelled'), link)
    check('4.2 the text starts with a capital letter', link['statusLabel'][0].isupper(), link.get('statusLabel'))

failed = [r for r in results if not r[1]]
print(f'\n{len(results) - len(failed)} of {len(results)} checks passed')
sys.exit(1 if failed else 0)
