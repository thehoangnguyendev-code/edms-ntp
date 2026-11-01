"""DEV browser check, 2026-10-30: Step 4 Assessment of the Session Workspace has no Paper block, numbers the Printed packs, offers only Lost and Void, and shows the assessment files without any upload box. Password from DEVPW. Plain `python`."""
import os, sys, re
from playwright.sync_api import sync_playwright
PW = os.environ['DEVPW']; BASE = 'http://localhost:3000'
SHOTS = os.path.join(os.path.dirname(__file__), 'ui_shots'); results = []
def check(n, ok, d=''):
    results.append(bool(ok)); print(('PASS  ' if ok else 'FAIL  ') + n + ((' -- ' + str(d)[:200]) if (d and not ok) else ''))
ACT, SES = '6223be9e-cd9a-436c-b3d2-c011833e8781', '3d29ea28-abc7-49a2-a509-3adb73f1df90'   # TRN/QA/26-911, S1 (UAT record)
with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', headless=True)
    pg = b.new_context(viewport={'width': 1500, 'height': 1300}).new_page()
    pg.goto(BASE + '/login', wait_until='domcontentloaded'); pg.fill('input[name=username]', 'admin'); pg.fill('input[name=password]', PW)
    pg.get_by_role('button', name='Sign In').click(); pg.wait_for_timeout(4000)
    pg.goto(f'{BASE}/training-management/activities/{ACT}/sessions/{SES}/workspace', wait_until='domcontentloaded'); pg.wait_for_timeout(4000)
    pg.get_by_text(re.compile('Step 4')).first.click(); pg.wait_for_timeout(2500)
    pg.screenshot(path=os.path.join(SHOTS, 'step4_assessment.png'), full_page=True)
    body = pg.inner_text('body')
    check('S1 no Paper block (Delivery / Copies printed)', 'Copies printed' not in body and 'Print paper pack' not in body)
    check('S2 Printed packs has a No. column', pg.get_by_role('columnheader', name='No.').count() >= 1)
    check('S3 no Returned button', pg.get_by_role('button', name='Returned', exact=True).count() == 0)
    check('S4 Lost and Void are offered', pg.get_by_role('button', name='Lost', exact=True).count() >= 1 and pg.get_by_role('button', name='Void', exact=True).count() >= 1)
    section = body.split('Assessment Materials', 1)[1].split('Scans and filled files', 1)[0] if 'Assessment Materials' in body else ''
    check('S5 Assessment Materials only shows the files (no upload box, no Open to Edit)', section and not re.search('Drag|upload|max 20 MB|Open to Edit|Write it from', section), section[:200])
    check('S6 the scans block has one drop zone and no Type / For one person / Paper copy / Form / Remark fields', pg.get_by_text('Scanned pages').count() >= 1 and pg.get_by_text('Paper copy it is the scan of').count() == 0 and pg.get_by_text('For one person').count() == 0 and pg.get_by_text('Form and version used').count() == 0)
    sticky = pg.evaluate("(() => { const h = [...document.querySelectorAll('th')].find(t => /Where is the copy/i.test(t.textContent)); return h ? getComputedStyle(h).position : 'none'; })()")
    check('S7 Where is the copy is a fixed (sticky) column', sticky == 'sticky', sticky)
    pg.screenshot(path=os.path.join(SHOTS, 'step4_scans.png'), full_page=True)
    b.close()
print(sum(results), 'passed', len(results) - sum(results), 'failed'); sys.exit(0 if all(results) else 1)
