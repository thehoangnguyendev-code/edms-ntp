"""DEV, in Edge: a completed training that comes from a document shows "Complete Training (Revision)"; the button opens the Training Revision, where "Complete Training" waits.
Usage: python e2e24_document_to_completion.py keep   (prints KEEP <activity> <revision>)  then  python e2e25_complete_training_button_ui.py <activity> <revision>"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from playwright.sync_api import sync_playwright

PW = os.environ['DEVPW']
BASE = 'http://localhost:3000'
aid, rid = sys.argv[1], sys.argv[2]
ok = True


def check(name, cond, detail=''):
    global ok
    ok &= bool(cond)
    print(('PASS  ' if cond else 'FAIL  ') + name + ('' if cond else ' -- ' + str(detail)[:300]))


with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    pg = b.new_page(viewport={'width': 1500, 'height': 1000})
    pg.goto(BASE + '/login', wait_until='domcontentloaded')
    pg.fill('input[name=username]', 'admin')
    pg.fill('input[name=password]', PW)
    pg.get_by_role('button', name='Sign In').click()
    pg.wait_for_timeout(4000)
    pg.goto(f'{BASE}/training-management/activities/{aid}', wait_until='domcontentloaded')
    pg.wait_for_timeout(3500)
    btn = pg.get_by_role('button', name='Complete Training (Revision)')
    check('1 the completed activity shows "Complete Training (Revision)"', btn.count() >= 1, pg.inner_text('body')[:300])
    pg.screenshot(path=os.path.join(os.path.dirname(__file__), 'shots', 'e25_activity.png'))
    btn.first.click()
    pg.wait_for_timeout(3500)
    check('2 it opens the Training Revision of the same revision', pg.url.endswith(f'/documents/revisions/training/{rid}'), pg.url)
    body = pg.inner_text('body')
    check('3 the revision page has the button "Complete Training"', pg.get_by_role('button', name='Complete Training').count() >= 1, body[:300])
    pg.get_by_role('tab', name='Training Information').click() if pg.get_by_role('tab', name='Training Information').count() else pg.get_by_text('Training Information', exact=True).first.click()
    pg.wait_for_timeout(2500)
    body = pg.inner_text('body')
    values = pg.evaluate("Array.from(document.querySelectorAll('input')).map(i => i.value)")
    check('4 the Training Information tab shows the status with a capital letter: "Completed"', 'Completed' in values, values)
    pg.screenshot(path=os.path.join(os.path.dirname(__file__), 'shots', 'e25_revision_training_tab.png'))
    b.close()
sys.exit(0 if ok else 1)
