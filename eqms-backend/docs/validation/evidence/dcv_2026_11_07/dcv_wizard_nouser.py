"""DEV only: (3) New Access Profile button by permission, (4) wizard without settings.user.view, wizard shows the server's real reason (SoD)."""
import os, sys, re
sys.path.insert(0, os.path.dirname(__file__))
import dcv_lib
dcv_lib.ROLES.update({'SEC': 'dcv.secadmin', 'UPD': 'dcv.sec.upd', 'NOU': 'dcv.sec.nouser'})
from dcv_lib import *
b = Browser()
def body(pg): return pg.locator('body').inner_text()
# B: no user list permission
pg = b.page('NOU'); pg.set_default_timeout(15000)
pg.goto(BASE + '/security/access-profiles', wait_until='domcontentloaded'); pg.wait_for_timeout(4000)
check('B1', 'update+assign account sees the New Access Profile button', pg.get_by_role('button', name=re.compile('New Access Profile')).count() >= 1, '')
pg.goto(BASE + '/security/access-profiles/wizard', wait_until='domcontentloaded'); pg.wait_for_timeout(3500)
pg.get_by_placeholder('e.g. Document Reviewer').fill('DCV-TEST no user list')
for _ in range(1): pg.get_by_role('button', name='Next').click(); pg.wait_for_timeout(1500)
pg.get_by_text('Pick individual permissions').click(); pg.wait_for_timeout(2500)
sr = pg.get_by_placeholder('Search permissions by name'); sr.fill('dashboard.module.view'); pg.wait_for_timeout(900)
pg.locator('div.group', has=pg.get_by_text('dashboard.module.view', exact=True)).first.locator('label').first.click(); pg.wait_for_timeout(300)
for _ in range(3): pg.get_by_role('button', name='Next').click(); pg.wait_for_timeout(2000)
txt = body(pg); b.shot('NOU', None, 'BW', 'B2-users-step', 'no user-list permission: Users step')
check('B2', 'Users step explains instead of failing', 'do not have permission to list users' in txt and 'Failed to load users' not in txt, txt[-300:])
b.close()
