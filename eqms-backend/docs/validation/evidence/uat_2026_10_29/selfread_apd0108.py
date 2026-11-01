"""DEV check, 2026-10-31, of the self-reading with the form APD.0108 filled as the owner asked (TRAINING-SELFREAD-RESULTS-2026-10-31):
 - the signature of each employee in the list is the real electronic signature block (name, meaning, time), not a sentence;
 - the box Remarks of the head's confirmation is the reason typed in the electronic signature window;
 - the head confirms a department only when every person of it signed or was recorded as not having read;
 - Finish Training is offered only when every department that has readers is confirmed; the list is downloaded as one file for each department.
Every person signs the reading (nobody is recorded as not having read: owner decision TRAINING-SELFREAD-MANDATORY-2026-10-31). A new UAT activity is made on DEV (two departments: Quality Assurance, with a head, and Quality, not in the master data, confirmed in place of a head). Browser shots of the Reading and Results steps are taken at three moments.
Password from DEVPW, never written. Plain `python` (needs Playwright and PyMuPDF). The Department Head of Quality Assurance is set for the run and put back at the end. Output: OUT directory."""
import os, sys, json, datetime, calendar, subprocess, zipfile
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'training_2026_10_18'))
from api import Client, tick_all
import fitz
from playwright.sync_api import sync_playwright

PW = os.environ['DEVPW']
OUT = os.environ.get('OUT', os.path.join(os.path.dirname(__file__), 'ui_shots'))
BASE = 'http://localhost:3000'
TODAY = datetime.date.today()
results = []

def check(name, ok, detail=''):
    results.append(bool(ok)); print(('PASS  ' if ok else 'FAIL  ') + name + ((' -- ' + str(detail)[:400]) if (detail and not ok) else ''))
def norm(x):
    # the text of this PDF is read back with some letters dropped (o, f); the page itself is drawn right, so both sides are compared without them and without spaces
    return ''.join(ch for ch in x.lower() if ch.isalnum() and ch not in 'of')


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
def set_qa_head(user_id):
    val = "'" + user_id + "'" if user_id else 'null'
    subprocess.run(['docker', 'exec', '-i', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-q', '-v', 'ON_ERROR_STOP=1', '-c', f"update departments set department_head_id = {val} where name = 'Quality Assurance'"], check=True, capture_output=True)

admin = Client('admin'); approver = Client('approver.test1'); t1 = Client('trainee.test1'); t2 = Client('trainee.test2'); dco = Client('approver.test1'); head = Client('trainer.test1'); approve2 = Client('user.a.test')
os.makedirs(OUT, exist_ok=True)

def shots(aid, sid, name, steps):
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge', headless=True)
        pg = b.new_context(viewport={'width': 1500, 'height': 1000}).new_page()
        pg.goto(BASE + '/login', wait_until='domcontentloaded'); pg.fill('input[name=username]', 'admin'); pg.fill('input[name=password]', PW)
        pg.get_by_role('button', name='Sign In').click(); pg.wait_for_timeout(3500)
        pg.goto(BASE + f'/training-management/activities/{aid}/sessions/{sid}/workspace', wait_until='domcontentloaded'); pg.wait_for_timeout(3500)
        for label, file in steps:
            for el in pg.get_by_text(label, exact=True).all():
                if el.is_visible():
                    el.click(); break
            pg.wait_for_timeout(1800)
            pg.screenshot(path=os.path.join(OUT, f'{name}_{file}.png'), full_page=True)
        b.close()

try:
    set_qa_head(head.user['id'])
    due = TODAY.replace(day=calendar.monthrange(TODAY.year, TODAY.month)[1])
    a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'dueDate': due.isoformat()}); aid = a['id']
    get = lambda: admin.call('GET', f'/training/activities/{aid}')
    a = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'SELF_READING', 'assessmentMethod': 'SELF_READING_CONFIRMATION', 'externalTrainerName': 'External Trainer', 'scheduledOn': TODAY.isoformat(), 'venue': 'Room 1', 'topics': [{'topicText': 'UAT-2026 SOP self-reading, two departments'}]})
    sid = a['sessions'][0]['id']
    admin.call('POST', f'/training/activities/{aid}/material-links', {'title': 'UAT-2026 material', 'url': 'https://example.com/uat'})
    a = admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': [t1.user['id'], t2.user['id'], dco.user['id']], 'reason': 'UAT-2026'})
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

    READ_REASON = 'UAT-2026 I read SOP and understood it'
    code, d, t = attempt(t1, 'POST', f'/training/me/participations/{pid["Trainee Test 1"]}/confirm-read', {'signatureToken': sign(t1), 'reason': READ_REASON})
    check('RS1 the first employee of Quality Assurance signs the reading', code == 200, (code, t))
    code, d, t = attempt(dco, 'POST', f'/training/me/participations/{pid[dco.user["fullName"]]}/confirm-read', {'signatureToken': sign(dco), 'reason': READ_REASON})
    check('RS2 the employee of Quality (a department that is not in the master data) signs the reading', code == 200, (code, t))
    dep = {x['departmentName']: x for x in get()['selfReadingDepartments']}
    check('RS3 Quality Assurance shows one person not signed yet', dep['Quality Assurance']['invited'] == 1 and dep['Quality Assurance']['waiting'] == 1, dep.get('Quality Assurance'))
    shots(aid, sid, 'apd_A', [('Reading', 'reading'), ('Results', 'results_waiting')])

    HEAD_REASON = 'UAT-2026 Head: the people of Quality Assurance read the SOP'
    code, d, t = attempt(head, 'POST', f'/training/activities/{aid}/verify-self-reading', {'signatureToken': sign(head), 'reason': HEAD_REASON})
    check('RS4 the head cannot confirm while one person has not signed', code == 409 and 'TRAINING_SELF_READING_NOT_ALL_SIGNED' in t, (code, t))
    code, d, t = attempt(t2, 'POST', f'/training/me/participations/{pid["Trainee Test 2"]}/confirm-read', {'signatureToken': sign(t2), 'reason': READ_REASON})
    check('RS5 the last person of Quality Assurance signs the reading', code == 200, (code, t))
    check('RS6 Finish Training is not offered yet', get()['capabilities']['finishTraining'] is False, get()['capabilities'].get('finishTraining'))
    code, d, t = attempt(head, 'POST', f'/training/activities/{aid}/verify-self-reading', {'signatureToken': sign(head), 'reason': HEAD_REASON})
    check('RS7 the head confirms Quality Assurance once everyone signed or did not read', code == 200, (code, t))
    check('RS8 Finish Training is still not offered: Quality is not confirmed', get()['capabilities']['finishTraining'] is False, get()['capabilities'].get('finishTraining'))
    code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/verify-self-reading', {'signatureToken': sign(admin), 'reason': 'UAT-2026 Quality has no head: confirmed in place of the head'})
    check('RS9 Quality (no head) is confirmed in place of the head by the person who closes trainings', code == 200 and not any(x['waiting'] > 0 for x in get()['selfReadingDepartments']), (code, t))
    check('RS10 Finish Training is offered once every department is confirmed', get()['capabilities']['finishTraining'] is True, get()['capabilities'].get('finishTraining'))
    shots(aid, sid, 'apd_B', [('Results', 'results_ready')])

    # the lists
    code, body = admin.call('GET', f'/training/sessions/{sid}/self-reading-list?format=pdf', raw=True)
    check('RS11 all the lists come in one download', code == 200, (code, body[:100]))
    files = {}
    if body[:2] == b'PK':
        z = zipfile.ZipFile(__import__('io').BytesIO(body))
        for n in z.namelist(): files[n] = z.read(n)
    else:
        files['single.pdf'] = body
    print('lists:', list(files))
    texts = {}
    for n, data in files.items():
        d = fitz.open(stream=data, filetype='pdf'); texts[n] = '\n'.join(pg.get_text() for pg in d)
        d[0].get_pixmap(dpi=110).save(os.path.join(OUT, 'apd0108_' + ''.join(ch if ch.isalnum() else '_' for ch in n[:-4]) + '.png'))
        open(os.path.join(OUT, 'apd0108_' + ''.join(ch if ch.isalnum() else '_' for ch in n[:-4]) + '.pdf'), 'wb').write(data)
    qa = [t for n, t in texts.items() if 'Quality Assurance' in t.split('Department:')[1][:40]] if texts else []
    check('RS12 there is one list for each department that has people', len(files) == 2, list(files))
    if qa:
        q = qa[0]
        check('RS13 the signature of the employee is the electronic signature block, not a sentence', 'Trainee Test 1' in q and 'signed electronically' not in q, q[:600])
        check('RS14 the box Remarks holds the reason typed by the head', norm(HEAD_REASON) in norm(q), q[-500:])
        check('RS15 the head signature block is there', 'Trainer Test 1' in q, q[-500:])
    else:
        check('RS13 list of Quality Assurance found', False, list(texts))
    other = [t for t in texts.values() if t not in qa]
    check('RS16 the list of Quality is made too, with the person and the confirmation', bool(other) and norm('Approver Test 1') in norm(other[0]), other[:1])

    code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/finish-training', {'version': get()['version'], 'signatureToken': sign(admin)})
    check('RS17 Finish Training works', code == 200, (code, t))
    st = sql(f"select status from training_activities where id='{aid}'")
    check('RS18 the activity is Pending QA Confirmation', st == [['PENDING_QA_CONFIRMATION']], st)
    mail = sql(f"select count(*) from notifications where object_id::text='{aid}' and event_type='TRAINING_SUBMITTED_TO_QA'") if False else None
    shots(aid, sid, 'apd_C', [('Results', 'results_finished')])
    # the button of the header: one click, one file for each department, named by the department
    with sync_playwright() as p:
        b = p.chromium.launch(channel='msedge', headless=True)
        ctx = b.new_context(viewport={'width': 1500, 'height': 1000}, accept_downloads=True); pg = ctx.new_page()
        pg.goto(BASE + '/login', wait_until='domcontentloaded'); pg.fill('input[name=username]', 'admin'); pg.fill('input[name=password]', PW)
        pg.get_by_role('button', name='Sign In').click(); pg.wait_for_timeout(3500)
        pg.goto(BASE + f'/training-management/activities/{aid}/sessions/{sid}/workspace', wait_until='domcontentloaded'); pg.wait_for_timeout(3500)
        names = []
        pg.on('download', lambda d: (names.append(d.suggested_filename), d.save_as(os.path.join(OUT, 'dl_' + ''.join(ch if ch.isalnum() or ch in '.-' else '_' for ch in d.suggested_filename)))))
        pg.get_by_role('button', name='Self-reading List').click(); pg.wait_for_timeout(500)
        pg.get_by_text('PDF File (.pdf)').click(); pg.wait_for_timeout(6000)
        b.close()
    print('downloaded:', names)
    check('RS19 one click on the header button saves one file for each department, named by the department', len(names) == 2 and any('Quality Assurance' in n for n in names) and any('-Quality-' in n or '-Quality.' in n for n in names) and not any(n.endswith('.zip') for n in names), names)
finally:
    set_qa_head(None)

print('%d passed, %d failed' % (sum(results), len(results) - sum(results))); sys.exit(0 if all(results) else 1)
