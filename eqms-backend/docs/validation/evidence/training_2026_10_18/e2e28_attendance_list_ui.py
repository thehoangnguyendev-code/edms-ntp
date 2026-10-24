"""DEV, in Edge: the Session Workspace has "Training Attendance List" beside Back (and it is not in Conduct Training any more); the window shows the list in the EmbedPDF viewer, downloads Word and PDF,
and Refresh makes it again. Also the button "Send attendance list to QA" is in the workspace only. Password from DEVPW (never written)."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from playwright.sync_api import sync_playwright
from api import Client

PW = os.environ['DEVPW']
BASE = 'http://localhost:3000'
a = Client('admin')
pick = None
for r in a.call('GET', '/training/activities?limit=40&search=E2E-TEST')['data']:
    d = a.call('GET', '/training/activities/' + r['id'])
    if d['status'] == 'IN_PROGRESS' and d['sessions'] and d['sessions'][0].get('heldOn') and not d.get('attendanceSentAt') and d['capabilities'].get('sendAttendanceList') is True:
        pick = (d['id'], d['sessions'][0]['id'])
        break
ok = True
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    pg = b.new_page(viewport={'width': 1500, 'height': 900}, accept_downloads=True)
    pg.goto(BASE + '/login', wait_until='domcontentloaded')
    pg.fill('input[name=username]', 'admin')
    pg.fill('input[name=password]', PW)
    pg.get_by_role('button', name='Sign In').click()
    pg.wait_for_timeout(4000)
    # Conduct Training: neither button
    pg.goto(f'{BASE}/training-management/activities/{pick[0]}/conduct', wait_until='domcontentloaded')
    pg.wait_for_timeout(3500)
    pg.get_by_text('Participants', exact=False).first.click()
    pg.wait_for_timeout(1500)
    none_here = pg.get_by_role('button', name='Training Attendance List').count() == 0 and pg.get_by_role('button', name='Send attendance list to QA').count() == 0
    print(('PASS' if none_here else 'FAIL'), 'Conduct Training has neither "Training Attendance List" nor "Send attendance list to QA"')
    ok &= none_here
    # Session Workspace: both, right of Back
    pg.goto(f'{BASE}/training-management/activities/{pick[0]}/sessions/{pick[1]}/workspace?step=ws-attendance', wait_until='domcontentloaded')
    pg.wait_for_timeout(4000)
    lst = pg.get_by_role('button', name='Training Attendance List')
    send = pg.get_by_role('button', name='Send attendance list to QA')
    back = pg.get_by_role('button', name='Back', exact=True).first.bounding_box()
    placed = lst.count() == 1 and send.count() >= 1 and lst.bounding_box()['x'] > back['x']
    print(('PASS' if placed else 'FAIL'), 'the Session Workspace has both buttons, right of Back')
    ok &= placed
    lst.click()
    pg.wait_for_timeout(12000)
    own = pg.evaluate("Array.from(document.querySelectorAll('iframe')).filter(f => (f.src || '').startsWith('blob:')).length")
    viewer = pg.evaluate("document.querySelector('[role=dialog]') ? document.querySelector('[role=dialog]').innerHTML.length : 0")
    shown = own == 0 and viewer > 2000
    print(('PASS' if shown else 'FAIL'), 'the window shows the list in the project viewer (EmbedPDF), not the viewer of the browser', own, viewer)
    ok &= shown
    pg.screenshot(path=os.path.join(os.path.dirname(__file__), 'shots', 'e28_modal.png'))
    for label, ext in (('Download Word', '.docx'), ('Download PDF', '.pdf')):
        with pg.expect_download(timeout=60000) as dl:
            pg.get_by_role('button', name=label, exact=True).click()
        name = dl.value.suggested_filename
        good = name.endswith('-APD.0117' + ext)
        print(('PASS' if good else 'FAIL'), label, 'downloads', name)
        ok &= good
    pg.get_by_role('button', name='Refresh', exact=True).click()
    pg.wait_for_timeout(8000)
    kept = pg.evaluate("Array.from(document.querySelectorAll('iframe')).filter(f => (f.src || '').startsWith('blob:')).length") == 0
    print('PASS' if kept else 'FAIL', 'Refresh keeps the project viewer')
    ok &= kept
    b.close()
sys.exit(0 if ok else 1)
