"""DEV only: Author submits, Reviewer reviews, Approver approves - all through the screens. Usage: python dcv_ui4.py <step 1|2|3>"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dcv_lib import *
RID = '0bd67452-5a7c-412e-8a20-27e163454689'
step = sys.argv[1]
b = Browser()
def esign(pg, who, tag):
    pg.wait_for_timeout(1500)
    b.shot(who, None, 'UI4', f'{tag}-esign', f'{tag}: e-signature dialog')
    for ph, val in (('Enter your reason', 'DEV test: through the screen'), ('Enter your username', ROLES[who]), ('Enter your password', PW)):
        f = pg.get_by_placeholder(ph)
        if f.count(): f.first.fill(val)
    for name in ('Sign & Confirm', 'Sign and Confirm', 'Confirm', 'Sign'):
        bt = pg.get_by_role('button', name=name, exact=True)
        if bt.count() and bt.last.is_visible():
            bt.last.click(); break
    pg.wait_for_timeout(6000)
if step == '1':
    who = 'U1'; pg = b.page(who); pg.set_default_timeout(20000)
    pg.goto(f'{BASE}/documents/revisions/edit/{RID}', wait_until='domcontentloaded'); pg.wait_for_timeout(5000)
    pg.get_by_role('button', name='Submit for Review').first.click(); pg.wait_for_timeout(2000)
    esign(pg, who, 'author-submit')
elif step == '2':
    who = 'U3'; pg = b.page(who); pg.set_default_timeout(20000)
    pg.goto(f'{BASE}/documents/revisions/review/{RID}', wait_until='domcontentloaded'); pg.wait_for_timeout(6000)
    print(pg.url, [x.inner_text() for x in pg.get_by_role('button').all() if x.inner_text().strip()][-10:])
    if pg.get_by_role('button', name='Complete Review').count():
        pg.get_by_role('button', name='Complete Review').first.click(); pg.wait_for_timeout(2000); esign(pg, who, 'reviewer-complete')
else:
    who = 'UCAPP'; pg = b.page(who); pg.set_default_timeout(20000)
    pg.goto(f'{BASE}/documents/revisions/approval/{RID}', wait_until='domcontentloaded'); pg.wait_for_timeout(6000)
    print(pg.url, [x.inner_text() for x in pg.get_by_role('button').all() if x.inner_text().strip()][-10:])
    for nm in ('Approve', 'Complete Approval'):
        if pg.get_by_role('button', name=nm, exact=True).count():
            pg.get_by_role('button', name=nm, exact=True).first.click(); pg.wait_for_timeout(2000); esign(pg, who, 'approver-approve'); break
b.shot(who, None, 'UI4', f'step{step}-after', f'after step {step}')
print('URL', pg.url, '| status', status_of(RID))
b.close()
