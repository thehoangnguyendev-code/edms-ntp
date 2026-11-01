"""DEV check, 2026-10-31, of the person who cannot read a self-reading (owner decision TRAINING-SELFREAD-MANDATORY-2026-10-31, D-SRM-5):
 - the person is not taken off the list; the trainer records them as unable to read (button Cannot Read of the Reading step), with a reason and an electronic signature;
 - the person becomes Absent with the reason, is offered the supplementary training (make-up, SOP.0003 5.3.7) and no longer blocks Finish Training;
 - a person who signed, or who is already recorded, cannot be recorded again; a person without the right to conduct cannot do it; no signature or no reason is refused.
A new UAT activity is made on DEV (not removable). Password from DEVPW, never written. Plain `python` (needs Playwright). Output: OUT directory."""
import os, sys, json, datetime, subprocess
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'training_2026_10_18'))
from api import Client, tick_all
from playwright.sync_api import sync_playwright

PW = os.environ['DEVPW']
OUT = os.environ.get('OUT', os.path.join(os.path.dirname(__file__), 'ui_shots'))
BASE = 'http://localhost:3000'
TODAY = datetime.date.today()
results = []

def check(name, ok, detail=''):
    results.append(bool(ok)); print(('PASS  ' if ok else 'FAIL  ') + name + ((' -- ' + str(detail)[:400]) if (detail and not ok) else ''))
def sign(c):
    return c.call('POST', '/auth/verify-signature', {'username': c.user['username'], 'password': PW})['signatureToken']
def attempt(c, method, path, body=None):
    code, payload = c.call(method, path, body, raw=True)
    try: data = json.loads(payload) if payload else {}
    except Exception: data = {}
    return code, data, payload[:400].decode('utf-8', 'ignore')
def sql(q):
    out = subprocess.run(['docker', 'exec', '-i', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-t', '-A', '-F', '|', '-c', q], capture_output=True, text=True).stdout
    return [r.split('|') for r in out.strip().splitlines() if r.strip()]

admin = Client('admin'); approver = Client('approver.test1'); t1 = Client('trainee.test1'); t2 = Client('trainee.test2'); t3 = Client('user.a.test'); approve2 = Client('user.a.test')
os.makedirs(OUT, exist_ok=True)

def shot(aid, sid, name):
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge', headless=True)
        pg = b.new_context(viewport={'width': 1500, 'height': 1000}).new_page()
        pg.goto(BASE + '/login', wait_until='domcontentloaded'); pg.fill('input[name=username]', 'admin'); pg.fill('input[name=password]', PW)
        pg.get_by_role('button', name='Sign In').click(); pg.wait_for_timeout(3500)
        pg.goto(BASE + f'/training-management/activities/{aid}/sessions/{sid}/workspace', wait_until='domcontentloaded'); pg.wait_for_timeout(3500)
        for el in pg.get_by_text('Reading', exact=True).all():
            if el.is_visible():
                el.click(); break
        pg.wait_for_timeout(1800)
        pg.screenshot(path=os.path.join(OUT, f'{name}.png'), full_page=True)
        b.close()

due = TODAY + datetime.timedelta(days=20)
a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'dueDate': due.isoformat()}); aid = a['id']
get = lambda: admin.call('GET', f'/training/activities/{aid}')
a = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'SELF_READING', 'assessmentMethod': 'SELF_READING_CONFIRMATION', 'externalTrainerName': 'External Trainer', 'scheduledOn': TODAY.isoformat(), 'venue': 'Room 1', 'topics': [{'topicText': 'UAT-2026 SOP self-reading, a person who cannot read'}]})
sid = a['sessions'][0]['id']
admin.call('POST', f'/training/activities/{aid}/material-links', {'title': 'UAT-2026 material', 'url': 'https://example.com/uat'})
a = admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': [t1.user['id'], t2.user['id']], 'reason': 'UAT-2026'})
pid = {x['fullName']: x['id'] for x in a['participants']}
admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'UAT-2026'})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': approver.user['id']})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': approve2.user['id']})
approver.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(approver)})
approve2.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(approve2)})
admin.call('POST', f'/training/activities/{aid}/notify', {'version': get()['version'], 'signatureToken': sign(admin)})
tick_all(admin, sid)
admin.call('POST', f'/training/sessions/{sid}/hold', {'signatureToken': sign(admin)})
number = get()['trainingNumber']
print('activity', number, aid)
p1, p2 = pid['Trainee Test 1'], pid['Trainee Test 2']

# who may do it, and what is needed
check('CR1 the trainer is offered Cannot Read', get()['capabilities'].get('excuseReader') is True)
code, d, t = attempt(t1, 'POST', f'/training/participants/{p2}/cannot-read', {'signatureToken': sign(t1), 'reason': 'UAT-2026 no right'})
check('CR2 a person without the right to conduct cannot record it', code == 403, (code, t))
code, d, t = attempt(admin, 'POST', f'/training/participants/{p2}/cannot-read', {'reason': 'UAT-2026 no signature'})
check('CR3 no signature is refused', code == 400 and 'TRAINING_SIGNATURE_REQUIRED' in t, (code, t))
code, d, t = attempt(admin, 'POST', f'/training/participants/{p2}/cannot-read', {'signatureToken': sign(admin), 'reason': '  '})
check('CR4 no reason is refused', code == 400 and 'TRAINING_REASON_REQUIRED' in t, (code, t))
check('CR5 nothing changed by the refusals', sql(f"select state from training_participants where id='{p2}'") == [['INVITED']])
shot(aid, sid, 'cr_A_reading')

code, d, t = attempt(admin, 'POST', f'/training/participants/{p2}/cannot-read', {'signatureToken': sign(admin), 'reason': 'UAT-2026 on long leave until next quarter'})
check('CR6 the trainer records the person as unable to read', code == 200, (code, t))
row = sql(f"select state, absence_reason, result, attend_signature_id is not null from training_participants where id='{p2}'")
check('CR7 the person is Absent with the reason, no result yet, and the signature is kept', row == [['ABSENT', 'UAT-2026 on long leave until next quarter', 'PENDING', 't']], row)
check('CR8 the signature has the meaning Reader Excused', sql(f"select count(*) from electronic_signatures s join electronic_signature_meanings m on m.id = s.meaning_id where s.id=(select attend_signature_id from training_participants where id='{p2}') and m.code='TRAINING_READER_EXCUSED'") == [['1']] or
      sql(f"select count(*) from electronic_signatures where id=(select attend_signature_id from training_participants where id='{p2}') and meaning = 'TRAINING_READER_EXCUSED'") == [['1']])
check('CR9 the Audit Trail names the person and the reason', sql("select count(*) from audit_logs where action_type='TRAINING_READER_EXCUSED' and comment like '%Trainee Test 2%long leave%'")[0][0] != '0')
check('CR10 the person is still on the list of the activity', any(x['id'] == p2 for x in get()['participants']))
code, d, t = attempt(admin, 'POST', f'/training/participants/{p2}/cannot-read', {'signatureToken': sign(admin), 'reason': 'UAT-2026 twice'})
check('CR11 a person already recorded cannot be recorded again', code == 409 and 'TRAINING_CANNOT_READ_NOT_APPLICABLE' in t, (code, t))
code, d, t = attempt(admin, 'POST', f'/training/participants/{p2}/attendance', {'state': 'ATTENDED'})
check('CR12 the trainer still cannot record attendance for a self-reader', code == 409, (code, t))
check('CR13 Finish Training is not offered yet: the other person has not signed', get()['capabilities']['finishTraining'] is False)

# the other person reads; the department is confirmed; the absent person no longer blocks
code, d, t = attempt(t1, 'POST', f'/training/me/participations/{p1}/confirm-read', {'signatureToken': sign(t1), 'reason': 'UAT-2026 I read it'})
check('CR14 the other person reads and signs', code == 200, (code, t))
code, d, t = attempt(admin, 'POST', f'/training/participants/{p1}/cannot-read', {'signatureToken': sign(admin), 'reason': 'UAT-2026 signed already'})
check('CR15 a person who already signed cannot be recorded as unable to read', code == 409 and 'TRAINING_CANNOT_READ_NOT_APPLICABLE' in t, (code, t))
code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/verify-self-reading', {'signatureToken': sign(admin), 'reason': 'UAT-2026 the department has no head: confirmed in place of the head'})
check('CR16 the department is confirmed although one person is Absent', code == 200, (code, t))
caps = get()['capabilities']
check('CR17 Finish Training is offered', caps['finishTraining'] is True, caps.get('finishTraining'))
cands = admin.call('GET', f'/training/activities/{aid}/overview').get('supplementaryCandidates', [])
check('CR18 the absent person is a candidate of the supplementary training', [x['fullName'] for x in cands] == ['Trainee Test 2'], [x.get('fullName') for x in cands])
code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/finish-training', {'version': get()['version'], 'signatureToken': sign(admin)})
check('CR19 the trainer finishes the training', code == 200, (code, t))
check('CR20 the absent person stays Absent and not trained', sql(f"select state, result from training_participants where id='{p2}'") == [['ABSENT', 'PENDING']])
caps = get()['capabilities']
check('CR21 the supplementary training is offered', caps.get('addSupplementary') is True, caps.get('addSupplementary'))
code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/supplementary', {'participantIds': [p2], 'reason': 'UAT-2026 back from leave'})
check('CR22 the supplementary training (make-up) is made for that person', code == 200, (code, t))
if code == 200:
    print('supplementary', d.get('trainingNumber'))
    # the supplementary activity is made empty of people by the existing design (the organizer adds them); only the number is checked here
    check('CR23 it carries the number of the original with the next letter', str(d.get('trainingNumber', '')) == number + 'a', (d.get('trainingNumber'), number))
shot(aid, sid, 'cr_B_after')

print(f'\n{sum(results)}/{len(results)} checks passed')
sys.exit(0 if all(results) else 1)
