import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dcv_lib import *
DOC = 'a09c5b96-2b83-48d8-95ce-3e97134ae630'
b = Browser(); pg = b.page('DCO'); pg.set_default_timeout(20000)
pg.goto(f'{BASE}/documents/{DOC}', wait_until='domcontentloaded'); pg.wait_for_timeout(5000)
pg.get_by_role('button', name='Edit Revision for Upgrade').click(); pg.wait_for_timeout(1500)
b.shot('DCO', None, 'UP2', '1-confirm', 'confirm Edit Revision for Upgrade')
pg.get_by_role('button', name='Confirm').click(); pg.wait_for_timeout(2500)
pg.screenshot(path=os.path.join(SHOTS, 'UP2__2-edit-mode-full.png'), full_page=True)
pg.mouse.wheel(0, 900); pg.wait_for_timeout(800)
b.shot('DCO', None, 'UP2', '3-scrolled', 'edit mode scrolled')
print([x.inner_text() for x in pg.get_by_role('button').all()][-25:])
b.close()
