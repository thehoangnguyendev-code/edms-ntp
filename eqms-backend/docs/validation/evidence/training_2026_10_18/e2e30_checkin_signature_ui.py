"""DEV, in Edge: the trainee opens the check-in with the code, is asked to sign, and the attendance is recorded with the signature. Password from DEVPW (never written)."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from playwright.sync_api import sync_playwright
from api import Client, tick_all
from e2e21_matrix import mini_pdf, sign, admin, qa, trainee, get, TODAY

PW = os.environ['DEVPW']
BASE = 'http://localhost:3000'
t1 = Client('trainee.test1')
a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'trainingTitle': 'E2E-TEST check-in signature'})
aid = a['id']
a = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'External Trainer', 'scheduledOn': TODAY, 'venue': 'Room 1', 'topics': [{'topicText': 'E2E-TEST'}]})
sid = a['sessions'][0]['id']
admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': [t1.user['id']], 'reason': 'E2E-TEST'})
admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'E2E-TEST'})
admin.call('POST', f'/training/activities/{aid}/material-links', {'title': 'E2E-TEST', 'url': 'https://example.com/e2e'})
admin.upload(f'/training/activities/{aid}/materials', 'file', 'e2e.pdf', mini_pdf('E2E-TEST'), 'application/pdf', '?purpose=EXAM&title=E2E-TEST%20test')
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': qa.user['id']})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': trainee.user['id']})
qa.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(qa)})
trainee.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(trainee)})
admin.call('POST', f'/training/activities/{aid}/notify', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
tick_all(admin, sid)
admin.call('POST', f'/training/sessions/{sid}/hold', {'signatureToken': sign(admin)})
code = admin.call('POST', f'/training/sessions/{sid}/check-in/open', {})['code']
ok = True
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    pg = b.new_page(viewport={'width': 1300, 'height': 900})
    pg.goto(BASE + '/login', wait_until='domcontentloaded')
    pg.fill('input[name=username]', 'trainee.test1')
    pg.fill('input[name=password]', PW)
    pg.get_by_role('button', name='Sign In').click()
    pg.wait_for_timeout(4000)
    pg.goto(f'{BASE}/training-management/check-in?code={code}', wait_until='domcontentloaded')
    pg.wait_for_timeout(3500)
    pg.get_by_role('button', name='Confirm', exact=True).click()
    pg.wait_for_timeout(2000)
    body = pg.inner_text('body')
    asked = 'Training Attended' in body and 'Sign & Confirm' in body
    print(('PASS' if asked else 'FAIL'), 'Confirm asks the trainee to sign the attendance')
    ok &= asked
    pg.screenshot(path=os.path.join(os.path.dirname(__file__), 'shots', 'e30_sign.png'))
    pg.locator('textarea[placeholder="Enter your reason..."]').fill('E2E-TEST attendance')
    pg.locator('input[placeholder="Enter your username"]').fill('trainee.test1')
    pg.locator('input[type=password]').last.fill(PW)
    pg.get_by_role('button', name='Sign & Confirm').click()
    pg.wait_for_timeout(3500)
    mine = [x for x in get(aid)['participants'] if x['personUserId'] == t1.user['id']][0]
    done = mine['state'] == 'ATTENDED' and mine.get('signMode') == 'SELF'
    print(('PASS' if done else 'FAIL'), 'the attendance is recorded after the signature', mine['state'], mine.get('signMode'))
    ok &= done
    b.close()
sys.exit(0 if ok else 1)
