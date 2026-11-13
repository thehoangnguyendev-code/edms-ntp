"""DEV only: second upgrade cycle of SOP.7147 entirely through the UI. Step 1: operator prepares the next revision."""
import os, sys, re
sys.path.insert(0, os.path.dirname(__file__))
from dcv_lib import *
DOC = 'a09c5b96-2b83-48d8-95ce-3e97134ae630'
b = Browser(); pg = b.page('DCO'); pg.set_default_timeout(20000)
pg.goto(f'{BASE}/documents/{DOC}', wait_until='domcontentloaded'); pg.wait_for_timeout(5000)
b.shot('DCO', None, 'UI1', '1-document', 'SOP.7147 after the first upgrade')
if pg.get_by_role('button', name='Edit Revision for Upgrade').count():
    pg.get_by_role('button', name='Edit Revision for Upgrade').click(); pg.wait_for_timeout(1200)
    pg.get_by_role('button', name='Confirm').click(); pg.wait_for_timeout(2500)
else:
    print('already in upgrade edit mode', [x.inner_text() for x in pg.get_by_role('button').all() if x.inner_text().strip()][-12:])
pg.evaluate('window.scrollTo(0,0)')
txt = pg.locator('body').inner_text()
i = txt.find('Author'); print(txt[i:i+400])
if pg.get_by_text('Select review date').count():
    pg.get_by_text('Select review date').first.click(); pg.wait_for_timeout(1200)
    pg.get_by_text('30', exact=True).last.click(); pg.wait_for_timeout(500)
    pg.get_by_role('button', name='Apply').click(); pg.wait_for_timeout(800)
else:
    print('review date already filled')
pg.locator('textarea').last.fill('DCV-TEST second upgrade, all steps through the screens.'); pg.wait_for_timeout(500)
b.shot('DCO', None, 'UI1', '2-form', 'operator: review date + description')
pg.get_by_role('button', name='Save', exact=True).click(); pg.wait_for_timeout(4000)
t2 = pg.locator('body').inner_text(); i = t2.find('Review the changes'); print(t2[i:i+500])
b.shot('DCO', None, 'UI1', '3-confirm', 'Save dialog')
pg.locator('div[role=dialog], div.fixed').get_by_role('button', name='Save', exact=True).last.click(); pg.wait_for_timeout(4000)
b.shot('DCO', None, 'UI1', '4-saved', 'after Save')
b.close()
