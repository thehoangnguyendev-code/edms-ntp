"""DEV check, 2026-10-31, of a person who cannot sign because they LEFT the company or are on a LONG leave (suspended account) (D-SRM-6):
 - the person is not reminded (no e-mail to a closed account), the trainer records them with Cannot Read, and the Audit Trail keeps the state of their account;
 - APD.0108 keeps them on the list marked "Vắng mặt" in the signature column (SOP.0003 5.3.7);
 - while the account is not Active the person cannot be put on a supplementary training and the organizer is not chased about them;
 - when the account is Active again they can: the make-up is made with the person proposed on it, they are not listed twice, and the organizer is reminded only until a make-up lists them.
Account states are set by SQL on DEV for the test user and always put back (the test user is made Active again at the end). A new UAT activity is made on DEV (not removable).
Password from DEVPW, never written. Plain `python`. Output: only text."""
import os, sys, json, datetime, subprocess, zipfile, io, re
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'training_2026_10_18'))
from api import Client, tick_all

PW = os.environ['DEVPW']
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


admin = Client('admin'); approver = Client('approver.test1'); t1 = Client('trainee.test1'); t2 = Client('trainee.test2'); approve2 = Client('user.a.test')
t2id = t2.user['id']
original = sql(f"select status from app_users where id='{t2id}'")[0][0]
setstatus = lambda v: sql(f"update app_users set status='{v}' where id='{t2id}'")

try:
    due = TODAY + datetime.timedelta(days=20)
    a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'dueDate': due.isoformat()}); aid = a['id']
    get = lambda: admin.call('GET', f'/training/activities/{aid}')
    overview = lambda: admin.call('GET', f'/training/activities/{aid}/overview')
    a = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'SELF_READING', 'assessmentMethod': 'SELF_READING_CONFIRMATION', 'externalTrainerName': 'External Trainer', 'scheduledOn': TODAY.isoformat(), 'venue': 'Room 1', 'topics': [{'topicText': 'UAT-2026 SOP self-reading, a person who left'}]})
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

    # the person leaves the company
    setstatus('Terminated')
    cand = {x['id']: x for x in get()['participants']}
    check('UP1 the line of the person shows the state of the account', cand[p2].get('accountStatus') == 'Terminated', cand[p2].get('accountStatus'))
    code, d, t = attempt(admin, 'POST', f'/training/participants/{p2}/remind-read', {})
    if code == 404:
        code, d, t = attempt(admin, 'POST', f'/training/participants/{p2}/remind', {})
    check('UP2 a person whose account is closed is not reminded', code == 409 and 'TRAINING_READER_ACCOUNT_NOT_ACTIVE' in t, (code, t))
    code, d, t = attempt(admin, 'POST', f'/training/participants/{p2}/cannot-read', {'signatureToken': sign(admin), 'reason': 'UAT-2026 left the company on ' + TODAY.isoformat()})
    check('UP3 the trainer records them with Cannot Read', code == 200, (code, t))
    check('UP4 the Audit Trail keeps the state of the account', sql("select count(*) from audit_logs where action_type='TRAINING_READER_EXCUSED' and comment like '%Trainee Test 2 (account Terminated)%left the company%'")[0][0] != '0')

    # the other person reads, the activity finishes
    attempt(t1, 'POST', f'/training/me/participations/{p1}/confirm-read', {'signatureToken': sign(t1), 'reason': 'UAT-2026 I read it'})
    code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/verify-self-reading', {'signatureToken': sign(admin), 'reason': 'UAT-2026 the department has no head: confirmed in place of the head'})
    check('UP5 the department is confirmed although one person left', code == 200, (code, t))
    code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/finish-training', {'version': get()['version'], 'signatureToken': sign(admin)})
    check('UP6 the trainer finishes the training', code == 200, (code, t))

    # APD.0108 keeps the person, marked Vắng mặt
    code, b = admin.call('GET', f'/training/sessions/{sid}/self-reading-list?format=docx', None, raw=True)
    text = ''
    if code == 200 and b[:2] == b'PK':
        with zipfile.ZipFile(io.BytesIO(b)) as z:
            text = re.sub(r'<[^>]+>', ' ', z.read('word/document.xml').decode('utf-8', 'ignore'))
    check('UP7 APD.0108 keeps the absent person on the list', 'Trainee Test 2' in text, code)
    check('UP8 APD.0108 marks the person "Vắng mặt" in the signature column', 'Vắng mặt' in text, text[:200])

    # the account is closed: no make-up for them, and nobody is chased
    ov = overview()
    cands = ov['supplementaryCandidates']
    check('UP9 the person is a candidate that cannot be offered a make-up now', [(x['fullName'], x['canOfferSupplementary']) for x in cands] == [('Trainee Test 2', False)], [(x['fullName'], x.get('canOfferSupplementary')) for x in cands])
    check('UP10 the counts say one blocked and none pending', (ov['supplementaryBlocked'], ov['supplementaryPending']) == (1, 0), (ov.get('supplementaryBlocked'), ov.get('supplementaryPending')))
    code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/supplementary', {'participantIds': [p2], 'reason': 'UAT-2026 while the account is closed'})
    check('UP11 a make-up for a closed account is refused', code == 409 and 'TRAINING_SUPPLEMENTARY_PERSON_NOT_ACTIVE' in t, (code, t))
    check('UP12 nothing was created by the refusal', sql(f"select count(*) from training_activities where parent_activity_id='{aid}'") == [['0']])

    # make the due date old so that the make-up reminder is due (test data on DEV only)
    sql(f"update training_activities set due_date = current_date - 30 where id='{aid}'")
    admin.call('POST', '/training/notifications/run-reminders')
    n = lambda: int(sql(f"select count(*) from training_notification_log where event_code='TRAINING_MAKEUP_PENDING' and object_id='{aid}'")[0][0])
    check('UP13 nobody is chased about a person whose account is closed', n() == 0, n())

    # long leave ends / the account is Active again
    setstatus(original)
    ov = overview()
    check('UP14 with an Active account the person can be offered a make-up', ov['supplementaryCandidates'][0]['canOfferSupplementary'] is True and ov['supplementaryPending'] == 1, (ov['supplementaryCandidates'][0].get('canOfferSupplementary'), ov.get('supplementaryPending')))
    admin.call('POST', '/training/notifications/run-reminders')
    check('UP15 the organizer is reminded of the person without a make-up', n() >= 1, n())
    code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/supplementary', {'participantIds': [p2], 'reason': 'UAT-2026 back from long leave'})
    check('UP16 the make-up is made', code == 200 and str(d.get('trainingNumber')) == number + 'a', (code, t))
    if code == 200:
        child = d['id']
        check('UP17 the person is proposed on the make-up', sql(f"select count(*) from training_proposed_participants where activity_id='{child}' and person_user_id='{t2id}'") == [['1']])
        ov = overview()
        check('UP18 the person now counts as having a make-up and nothing is pending', ov['supplementaryCandidates'][0]['hasSupplementary'] is True and ov['supplementaryPending'] == 0, ov.get('supplementaryPending'))
        before = n()
        sql("delete from training_notification_log where event_code='TRAINING_MAKEUP_PENDING' and false")
        admin.call('POST', '/training/notifications/run-reminders')
        check('UP19 the reminder stops once a make-up lists the person', n() == before, (before, n()))
        c = admin.call('POST', f'/training/activities/{child}/sessions', {'method': 'SELF_READING', 'assessmentMethod': 'SELF_READING_CONFIRMATION', 'externalTrainerName': 'External Trainer', 'scheduledOn': TODAY.isoformat(), 'venue': 'Room 1', 'topics': [{'topicText': 'UAT-2026 make-up'}]})
        names = [x['fullName'] for x in admin.call('GET', f'/training/activities/{child}/overview')['participants']] if False else [x['fullName'] for x in admin.call('GET', f'/training/activities/{child}')['participants']]
        check('UP20 the person is on the list of the make-up when its first session is made, for the organizer to confirm', names == ['Trainee Test 2'], names)
        check('UP21 the list of the make-up is not confirmed for the organizer', admin.call('GET', f'/training/activities/{child}').get('listPreparedBy') in (None, ''), admin.call('GET', f'/training/activities/{child}').get('listPreparedBy'))
    st = admin.call('GET', '/training/settings')
    check('UP22 the days of the make-up reminder are a setting, 14 by default', st.get('makeupReminderDays') == 14, st.get('makeupReminderDays'))
finally:
    setstatus(original)
    print('account of trainee.test2 put back to', sql(f"select status from app_users where id='{t2id}'")[0][0])

print(f'\n{sum(results)}/{len(results)} checks passed')
sys.exit(0 if all(results) else 1)
