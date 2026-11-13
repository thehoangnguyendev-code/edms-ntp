"""DEV only: New Access Profile goes straight to the wizard; old /new link redirects; detail page still opens/edits. Usage: DEVPW=... python dcv_wizard_only.py"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import dcv_lib
dcv_lib.ROLES['SEC'] = 'dcv.secadmin'
from dcv_lib import *
b = Browser(); pg = b.page('SEC'); pg.set_default_timeout(20000)
R = []
def chk(n, ok, d=''):
    R.append(ok); print(('PASS ' if ok else 'FAIL ') + n, d, flush=True)
pg.goto(BASE + '/security/access-profiles', wait_until='domcontentloaded'); pg.wait_for_timeout(4500)
pg.get_by_role('button', name='New Access Profile').click(); pg.wait_for_timeout(2500)
chk('W1 button opens the wizard directly', pg.url.endswith('/security/access-profiles/wizard'), pg.url)
chk('W2 no choice dialog', pg.get_by_text('Advanced setup').count() == 0 and pg.get_by_text('Guided setup').count() == 0)
chk('W3 wizard shows step 1', pg.get_by_text('Basic Information').count() > 0)
b.shot('SEC', None, 'WO', 'wizard-direct', 'New Access Profile opens the wizard')
pg.goto(BASE + '/security/access-profiles/new', wait_until='domcontentloaded'); pg.wait_for_timeout(3500)
chk('W4 old /new link redirects to the wizard', pg.url.endswith('/security/access-profiles/wizard'), pg.url)
pg.goto(BASE + '/security/access-profiles/9b1b5bb3-e254-4d09-ad2d-aee496022a92', wait_until='domcontentloaded'); pg.wait_for_timeout(4500)
chk('W5 detail opens', 'Access Profile Details' in pg.content(), pg.url)
for t in ['Effective Access', 'Assigned Users', 'Permissions', 'Audit Trail']:
    pg.get_by_text(t, exact=True).first.click(); pg.wait_for_timeout(1500)
chk('W6 tabs switch without error', 'Something went wrong' not in pg.content())
pg.get_by_role('button', name='Edit').first.click(); pg.wait_for_timeout(1500)
chk('W7 Edit mode shows Cancel + disabled Save', pg.get_by_role('button', name='Cancel').count() > 0 and pg.get_by_role('button', name='Save').first.is_disabled())
b.shot('SEC', None, 'WO', 'detail-edit', 'profile detail in edit mode')
b.close(); print('ALL PASS' if all(R) else 'SOME FAIL')
