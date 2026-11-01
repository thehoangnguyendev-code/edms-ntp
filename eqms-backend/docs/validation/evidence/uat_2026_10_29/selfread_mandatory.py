"""DEV check, 2026-10-31, of the self-reading that every invited person must read (owner decisions TRAINING-SELFREAD-MANDATORY-2026-10-31 and TRAINING-PAPER-PRINT-MERGED-2026-10-31):
 - "Did Not Read" is gone: the trainer cannot record attendance, absence or a correction for a person of a self-reading;
 - the trainer reminds one person who has not signed (button Send Reminder of the Reading step): a notice and an e-mail are logged, the time is kept, a second reminder within the hour is refused,
   a person who signed cannot be reminded, a person without the right to conduct cannot remind;
 - the two reminder days before the due date are in Training Properties (default 3 and 1), are validated, and the daily reminder sends to a person who has not signed on those days only;
 - Finish Training waits until everybody signed and the head confirmed;
 - the permission training.paper.print no longer exists and the paper packs are printed by the right to conduct or organize.
A new UAT activity is made on DEV (not removable). Training Properties are changed for the run and put back. Password from DEVPW, never written. Plain `python` (needs Playwright). Output: OUT directory."""
import os, sys, json, datetime, calendar, subprocess
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
def run_sql(q):
    subprocess.run(['docker', 'exec', '-i', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-q', '-v', 'ON_ERROR_STOP=1', '-c', q], check=True, capture_output=True)

admin = Client('admin'); approver = Client('approver.test1'); t1 = Client('trainee.test1'); t2 = Client('trainee.test2'); approve2 = Client('user.a.test'); head = Client('trainer.test1')
os.makedirs(OUT, exist_ok=True)

def shots(aid, sid, name, steps, props=False):
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge', headless=True)
        pg = b.new_context(viewport={'width': 1500, 'height': 1000}).new_page()
        pg.goto(BASE + '/login', wait_until='domcontentloaded'); pg.fill('input[name=username]', 'admin'); pg.fill('input[name=password]', PW)
        pg.get_by_role('button', name='Sign In').click(); pg.wait_for_timeout(3500)
        if props:
            pg.goto(BASE + '/settings/administration/training/properties?tab=reminders', wait_until='domcontentloaded'); pg.wait_for_timeout(3500)
            pg.screenshot(path=os.path.join(OUT, f'{name}_properties.png'), full_page=True)
        else:
            pg.goto(BASE + f'/training-management/activities/{aid}/sessions/{sid}/workspace', wait_until='domcontentloaded'); pg.wait_for_timeout(3500)
            for label, file in steps:
                for el in pg.get_by_text(label, exact=True).all():
                    if el.is_visible():
                        el.click(); break
                pg.wait_for_timeout(1800)
                pg.screenshot(path=os.path.join(OUT, f'{name}_{file}.png'), full_page=True)
        b.close()

orig = None
try:
    props = admin.call('GET', '/training/settings')
    orig = (props['selfReadingReminderFirstDays'], props['selfReadingReminderSecondDays'])
    check('MR1 Training Properties hold the two reminder days, 3 and 1 by default', orig == (3, 1), orig)
    code, d, t = attempt(admin, 'PUT', '/training/settings', {'version': props['version'], 'selfReadingReminderFirstDays': 2, 'selfReadingReminderSecondDays': 2})
    check('MR2 two equal reminder days are refused', code in (400, 422) and 'TRAINING_SETTINGS_INVALID' in t, (code, t))
    code, d, t = attempt(admin, 'PUT', '/training/settings', {'version': props['version'], 'selfReadingReminderFirstDays': 1, 'selfReadingReminderSecondDays': 3})
    check('MR3 a first reminder that is later than the second is refused', code in (400, 422) and 'TRAINING_SETTINGS_INVALID' in t, (code, t))

    # a new self-reading activity due in exactly 2 days, so that a reminder set to 2 days fires today
    due = TODAY + datetime.timedelta(days=2)
    a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'dueDate': due.isoformat()}); aid = a['id']
    get = lambda: admin.call('GET', f'/training/activities/{aid}')
    a = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'SELF_READING', 'assessmentMethod': 'SELF_READING_CONFIRMATION', 'externalTrainerName': 'External Trainer', 'scheduledOn': TODAY.isoformat(), 'venue': 'Room 1', 'topics': [{'topicText': 'UAT-2026 SOP self-reading, everybody reads'}]})
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

    # no Did Not Read, no attendance of any kind
    for state in ('ABSENT', 'ATTENDED', 'ONLINE'):
        code, d, t = attempt(admin, 'POST', f'/training/participants/{p1}/attendance', {'state': state, 'absenceReason': 'UAT-2026 test'})
        check(f'MR4 the trainer cannot record {state} for a self-reader', code == 409 and 'TRAINING_SELF_READING_ELECTRONIC_ONLY' in t, (code, t))
    check('MR5 the person is still Invited', sql(f"select state from training_participants where id='{p1}'") == [['INVITED']])
    caps = get()['capabilities']
    check('MR6 the trainer is offered the reminder', caps.get('remindToRead') is True, caps.get('remindToRead'))

    # the reminder by hand
    code, d, t = attempt(t1, 'POST', f'/training/participants/{p2}/remind-read')
    check('MR7 a person without the right to conduct cannot remind', code == 403, (code, t))
    code, d, t = attempt(admin, 'POST', f'/training/participants/{p1}/remind-read')
    check('MR8 the trainer reminds an invited person', code == 200, (code, t))
    sent = sql(f"select channel, status from training_notification_log where event_code='TRAINING_READ_REMINDER' and recipient_user_id='{t1.user['id']}' and object_id='{aid}' order by channel")
    check('MR9 a notice in the application and an e-mail are logged for that person', {r[0] for r in sent} == {'IN_APP', 'EMAIL'}, sent)
    check('MR10 the time of the reminder is kept on the person', sql(f"select last_read_reminder_at is not null from training_participants where id='{p1}'") == [['t']])
    code, d, t = attempt(admin, 'POST', f'/training/participants/{p1}/remind-read')
    check('MR11 a second reminder within the hour is refused', code == 409 and 'TRAINING_READ_REMINDER_TOO_SOON' in t, (code, t))
    check('MR12 the Audit Trail names the person reminded', sql(f"select count(*) from audit_logs where action_type='TRAINING_READ_REMINDED' and comment like '%Trainee Test 1%'")[0][0] != '0')
    shots(aid, sid, 'mr_A', [('Reading', 'reading')])

    # the reminder button disappears once the person signs
    code, d, t = attempt(t1, 'POST', f'/training/me/participations/{p1}/confirm-read', {'signatureToken': sign(t1), 'reason': 'UAT-2026 I read it'})
    check('MR13 the person signs the reading', code == 200, (code, t))
    code, d, t = attempt(admin, 'POST', f'/training/participants/{p1}/remind-read')
    check('MR14 a person who signed cannot be reminded', code == 409 and 'TRAINING_READ_REMINDER_NOT_NEEDED' in t, (code, t))
    shots(aid, sid, 'mr_B', [('Reading', 'reading_one_signed')])

    # the daily reminder, on the days of Training Properties
    props = admin.call('GET', '/training/settings')
    code, d, t = attempt(admin, 'PUT', '/training/settings', {'version': props['version'], 'selfReadingReminderFirstDays': 2, 'selfReadingReminderSecondDays': 1, 'reason': 'UAT-2026 reminder test'})
    check('MR15 the reminder days are saved in Training Properties (2 and 1)', code == 200 and d.get('selfReadingReminderFirstDays') == 2 and d.get('selfReadingReminderSecondDays') == 1, (code, t))
    shots(aid, sid, 'mr_C', [], props=True)
    before = sql(f"select count(*) from training_notification_log where event_code='TRAINING_READ_DUE_SOON' and object_id='{aid}'")[0][0]
    code, d, t = attempt(admin, 'POST', '/training/notifications/run-reminders')
    check('MR16 the reminders run by hand', code == 200, (code, t))
    rows = sql(f"select recipient_user_id, channel from training_notification_log where event_code='TRAINING_READ_DUE_SOON' and object_id='{aid}'")
    check('MR17 the person who did not sign (and only that person) gets the reminder, as a notice and an e-mail', {r[0] for r in rows} == {t2.user['id']} and {r[1] for r in rows} == {'IN_APP', 'EMAIL'}, rows)
    code, d, t = attempt(admin, 'POST', '/training/notifications/run-reminders')
    after = sql(f"select count(*) from training_notification_log where event_code='TRAINING_READ_DUE_SOON' and object_id='{aid}' and status='SENT'")[0][0]
    check('MR18 a second run the same day sends nothing new', len(sql(f"select 1 from training_notification_log where event_code='TRAINING_READ_DUE_SOON' and object_id='{aid}'")) == len(rows), (before, after))
    # a day that is not one of the two days sends nothing: move the due date to 5 days away and run again
    run_sql(f"update training_activities set due_date = current_date + 5 where id='{aid}'")
    attempt(admin, 'POST', '/training/notifications/run-reminders')
    check('MR19 on a day that is not one of the two days nothing is sent', len(sql(f"select 1 from training_notification_log where event_code='TRAINING_READ_DUE_SOON' and object_id='{aid}'")) == len(rows))
    run_sql(f"update training_activities set due_date = current_date + 2 where id='{aid}'")

    # Finish Training waits for everybody
    code, d, t = attempt(head, 'POST', f'/training/activities/{aid}/verify-self-reading', {'signatureToken': sign(head), 'reason': 'UAT-2026 head'})
    check('MR20 the head cannot confirm while a person has not signed', code in (403, 409), (code, t))
    check('MR21 Finish Training is not offered while a person has not signed', get()['capabilities']['finishTraining'] is False)

    # paper print rights
    check('MR22 the permission training.paper.print no longer exists', sql("select count(*) from permissions where code='training.paper.print'") == [['0']])
    caps = get()['capabilities']
    check('MR23 the capability printPaper follows the right to conduct', caps.get('printPaper') is True, caps.get('printPaper'))
finally:
    if orig:
        try:
            cur = admin.call('GET', '/training/settings')
            if (cur['selfReadingReminderFirstDays'], cur['selfReadingReminderSecondDays']) != orig:
                admin.call('PUT', '/training/settings', {'version': cur['version'], 'selfReadingReminderFirstDays': orig[0], 'selfReadingReminderSecondDays': orig[1], 'reason': 'UAT-2026 put back after the test'})
        except Exception as failure:
            print('COULD NOT PUT BACK THE TRAINING PROPERTIES', failure)

print('%d passed, %d failed' % (sum(results), len(results) - sum(results))); sys.exit(0 if all(results) else 1)
