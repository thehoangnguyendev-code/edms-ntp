"""DEV, in a real browser (Edge): the screens changed on 2026-10-23. The password comes from DEVPW (typed into the login form, never written to disk).
Records made here are titled "E2E-TEST ...". Screenshots go to ./shots."""
import os, sys, re, json, datetime
sys.path.insert(0, os.path.dirname(__file__))
from playwright.sync_api import sync_playwright
from api import Client, tick_all

PW = os.environ['DEVPW']
BASE = 'http://localhost:3000'
TODAY = datetime.date.today().isoformat()
results = []
os.makedirs(os.path.join(os.path.dirname(__file__), 'shots'), exist_ok=True)


def shot(pg, name):
    pg.screenshot(path=os.path.join(os.path.dirname(__file__), 'shots', name + '.png'), full_page=False)


def check(name, ok, detail=''):
    results.append((name, ok, detail))
    print(('PASS  ' if ok else 'FAIL  ') + name + (' -- ' + str(detail)[:300] if detail and not ok else ''))


def login(p, username):
    b = p.chromium.launch(channel='msedge', headless=True)
    pg = b.new_page(viewport={'width': 1500, 'height': 1000})
    pg.goto(BASE + '/login', wait_until='domcontentloaded')
    pg.fill('input[name=username]', username)
    pg.fill('input[name=password]', PW)
    pg.get_by_role('button', name='Sign In').click()
    pg.wait_for_timeout(5000)
    return b, pg


# ---- data the screens need (made through the API, like the screen does)
admin = Client('admin')
approver = Client('approver.test1')
trainee = Client('user.a.test')


def sign(c):
    return c.call('POST', '/auth/verify-signature', {'username': c.user['username'], 'password': PW})['signatureToken']


def planned(title, session=None):
    a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'trainingTitle': 'E2E-TEST ' + title})
    body = {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'External Trainer', 'scheduledOn': TODAY, 'venue': 'Room 1', 'topics': [{'topicText': 'E2E-TEST topic'}]}
    body.update(session or {})
    a = admin.call('POST', f"/training/activities/{a['id']}/sessions", body)
    return a['id'], a['sessions'][0]['id'], a['trainingNumber']


aid_plan, _, num_plan = planned('ui planned')
aid_prog, sid_prog, num_prog = planned('ui in progress')
admin.call('POST', f'/training/activities/{aid_prog}/participants', {'sessionId': sid_prog, 'personUserIds': [trainee.user['id']], 'reason': 'E2E-TEST'})
admin.call('POST', f'/training/activities/{aid_prog}/confirm-list', {'signatureToken': sign(admin), 'reason': 'E2E-TEST'})
admin.call('POST', f'/training/activities/{aid_prog}/material-links', {'title': 'E2E-TEST link', 'url': 'https://example.com/ui'})
admin.call('POST', f'/training/activities/{aid_prog}/content-exemptions', {'assessmentExempt': True, 'reason': 'E2E-TEST no test needed'})
admin.call('PUT', f'/training/activities/{aid_prog}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': approver.user['id']})
admin.call('PUT', f'/training/activities/{aid_prog}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': trainee.user['id']})
approver.call('POST', f'/training/activities/{aid_prog}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(approver)})
trainee.call('POST', f'/training/activities/{aid_prog}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(trainee)})
admin.call('POST', f'/training/activities/{aid_prog}/notify', {'version': admin.call('GET', f'/training/activities/{aid_prog}')['version'], 'signatureToken': sign(admin)})
tick_all(admin, sid_prog)
admin.call('POST', f'/training/sessions/{sid_prog}/hold', {'signatureToken': sign(admin)})
print('activities:', num_plan, 'planned;', num_prog, 'in progress')

with sync_playwright() as p:
    b, pg = login(p, 'admin')
    bad = []
    pg.on('response', lambda x: bad.append(f'{x.status} {x.url.split("/api")[-1][:90]}') if x.status >= 400 and '/api/' in x.url and 'branding' not in x.url else None)
    pg.on('pageerror', lambda e: bad.append('pageerror ' + str(e)[:160]))
    check('0 logged in', '/login' not in pg.url, pg.url)

    print('\n== Training Activities list and Custom Column')
    pg.goto(BASE + '/training-management/activities'); pg.wait_for_timeout(3500)
    headers = [h.inner_text().strip() for h in pg.locator('th').all()]
    check('1.1 the list shows columns', len(headers) > 6, headers)
    pg.get_by_role('button', name=re.compile('Custom Column')).click(); pg.wait_for_timeout(800)
    drawer = pg.locator('[role=dialog]').inner_text()
    check('1.2 the drawer lists No. and does not list Expand', 'No.' in drawer and 'Expand' not in drawer, drawer[:200])
    shot(pg, 'u1_custom_column')
    pg.get_by_role('button', name='Cancel').click(); pg.wait_for_timeout(500)

    print('\n== Training Activity in Planned: the Sessions tab as a form, Materials and Assessment tabs')
    pg.goto(f'{BASE}/training-management/activities/{aid_plan}/edit'); pg.wait_for_timeout(3500)
    pg.get_by_role('tab', name=re.compile('^Sessions')).click(); pg.wait_for_timeout(1000)
    txt = pg.locator('main, body').first.inner_text()
    check('2.1 the session is a form (Topic, Instructor, Location Type)', all(w in txt for w in ['Topic', 'Instructor', 'Location Type', 'Physical Location']), txt[:200])
    check('2.2 no table of sessions', pg.locator('th:has-text("Trainer check")').count() == 0)
    shot(pg, 'u2_sessions_form')
    pg.get_by_role('tab', name='Training Materials').click(); pg.wait_for_timeout(1200)
    txt = pg.locator('body').inner_text()
    check('2.3 materials: says what is missing', 'Training Materials are required before the content can be reviewed' in txt, txt[:300])
    check('2.4 materials: the exemption button', 'Training Materials are not required' in txt)
    shot(pg, 'u3_materials')
    pg.get_by_role('tab', name='Assessment').click(); pg.wait_for_timeout(1200)
    txt = pg.locator('body').inner_text()
    check('2.5 assessment: asks for the test', 'is required before the content can be reviewed' in txt and 'test' in txt.lower(), txt[:300])
    shot(pg, 'u4_assessment')
    pg.get_by_role('button', name=re.compile('An assessment form is not required')).click(); pg.wait_for_timeout(600)
    save = pg.get_by_role('button', name='Save')
    check('2.6 the exemption dialog needs a reason', save.is_disabled())
    pg.get_by_role('dialog').get_by_role('textbox').fill('E2E-TEST briefing'); pg.wait_for_timeout(300)
    check('2.7 with a reason the button is enabled', save.is_enabled())
    pg.get_by_role('button', name='Cancel').last.click(); pg.wait_for_timeout(500)

    print(chr(10) + '== What is not required shows no upload')
    aid_ex, _, _ = planned('ui exempt')
    pg.goto(f'{BASE}/training-management/activities/{aid_ex}/edit'); pg.wait_for_timeout(3000)
    pg.get_by_role('tab', name='Training Materials').click(); pg.wait_for_timeout(1000)
    check('2.8 required: the upload is offered', pg.get_by_text('Upload file').count() >= 1)
    pg.get_by_role('tab', name='Assessment').click(); pg.wait_for_timeout(1000)
    check('2.9 a Test session: the exam template is offered', 'Exam Template' in pg.locator('body').inner_text())
    admin.call('POST', f'/training/activities/{aid_ex}/content-exemptions', {'materialsExempt': True, 'assessmentExempt': True, 'reason': 'E2E-TEST'})
    pg.reload(); pg.wait_for_timeout(3000)
    pg.get_by_role('tab', name='Training Materials').click(); pg.wait_for_timeout(1000)
    txt = pg.locator('body').inner_text()
    check('2.10 exempted: no upload, and it says in the table that materials are not required, with the reason', pg.get_by_text('Upload file').count() == 0 and 'Training Materials are not required for this training' in txt and 'Reason:' in txt, txt[:300])
    check('2.11 the exemption can be taken back', pg.get_by_role('button', name='Require materials again').count() == 1)
    shot(pg, 'u3b_materials_exempt')
    pg.get_by_role('tab', name='Assessment').click(); pg.wait_for_timeout(1000)
    check('2.12 exempted: no exam template slot', 'Exam Template' not in pg.locator('body').inner_text())

    print('\n== Conduct Training of a training in progress')
    pg.goto(f'{BASE}/training-management/activities/{aid_prog}/conduct'); pg.wait_for_timeout(3500)
    pg.get_by_role('tab', name=re.compile('^Sessions')).click(); pg.wait_for_timeout(1000)
    txt = pg.locator('body').inner_text()
    check('3.1 sessions as a form, no paper pack or preparation', 'Physical Location' in txt and 'Printed packs' not in txt and 'Preparation' not in txt, txt[:200])
    check('3.2 no status badge for a single session, no extra sentence', 'The work of a session is done' not in txt)
    check('3.3 an Open workspace button', pg.get_by_role('button', name=re.compile('Open [Ww]orkspace')).count() >= 1)
    shot(pg, 'u5_conduct_sessions')
    pg.get_by_role('tab', name=re.compile('^Participants')).click(); pg.wait_for_timeout(1000)
    txt = pg.locator('body').inner_text()
    check('3.4 participants: no choice of session, no paper results, no result buttons', 'Results from paper' not in txt and 'Record result' not in txt and 'Session\nAll' not in txt, txt[:300])
    shot(pg, 'u6_conduct_participants')
    pg.get_by_role('tab', name='General Information').click(); pg.wait_for_timeout(800)
    txt = pg.locator('body').inner_text()
    check('3.5 the days to send the results to QA are shown once', txt.count('Send the results to QA by') == 1, txt.count('Send the results to QA by'))
    values = pg.eval_on_selector_all('input', 'els => els.map(e => e.value)')
    check('3.6 dates are dd/MM/yyyy HH:mm:ss', any(re.fullmatch(r'[0-9]{2}/[0-9]{2}/[0-9]{4} [0-9]{2}:[0-9]{2}:[0-9]{2}', v or '') for v in values), values)
    check('3.7 the renamed date fields', 'Document Approved On' in txt and 'Training Completed On' in txt)
    shot(pg, 'u7_conduct_general')

    print('\n== Session Workspace')
    pg.goto(f'{BASE}/training-management/activities/{aid_prog}/sessions/{sid_prog}/workspace'); pg.wait_for_timeout(4000)
    txt = pg.locator('body').inner_text()
    check('4.1 the workspace opens with its five steps', all(w in txt for w in ['Prepare', 'Attendance', 'Training', 'Assessment', 'Results']), txt[:200])
    check('4.2 the results notice is not on the Prepare step', 'Send the results to QA by' not in txt)
    pg.goto(f'{BASE}/training-management/activities/{aid_prog}/sessions/{sid_prog}/workspace?step=ws-results'); pg.wait_for_timeout(3500)
    txt = pg.locator('body').inner_text()
    check('4.3 the results notice is on the Results step', 'Send the results to QA by' in txt, txt[:200])
    shot(pg, 'u8_workspace_results')

    print('\n== Training Properties')
    pg.goto(BASE + '/settings/administration/training/properties'); pg.wait_for_timeout(3500)
    tabs = [t.inner_text().strip() for t in pg.get_by_role('tab').all()]
    check('5.1 one subject for each tab', all(w in tabs for w in ['Assessment', 'Document Training', 'Annual & Retraining', 'Review Reminders', 'Records Retention']), tabs)
    txt = pg.locator('body').inner_text()
    check('5.2 the days to send the results to QA are in the Assessment tab', 'Days to send the results to QA' in txt, txt[:300])
    shot(pg, 'u9_properties')

    print('\n== Settings: no choice of date format or time zone')
    pg.goto(BASE + '/settings/configuration'); pg.wait_for_timeout(3500)
    txt = pg.locator('body').inner_text()
    check('6.1 the date format and the zone are shown, not chosen', 'DD/MM/YYYY HH:mm:ss' in txt and 'Asia/Ho_Chi_Minh' in txt, txt[:300])
    check('6.2 no MM/DD/YYYY option', 'MM/DD/YYYY' not in txt)
    shot(pg, 'u10_configuration')

    print('\nHTTP errors and page errors during the run:', bad[:10])
    b.close()

failed = [r for r in results if not r[1]]
print(f'\n{len(results) - len(failed)} of {len(results)} checks passed')
sys.exit(1 if failed else 0)
