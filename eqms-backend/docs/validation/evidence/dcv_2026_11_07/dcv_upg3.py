import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dcv_lib import *
DOC = 'a09c5b96-2b83-48d8-95ce-3e97134ae630'
b = Browser(); pg = b.page('DCO'); pg.set_default_timeout(20000)
pg.goto(f'{BASE}/documents/{DOC}', wait_until='domcontentloaded'); pg.wait_for_timeout(5000)
pg.get_by_role('button', name='Edit Revision for Upgrade').click(); pg.wait_for_timeout(1200)
pg.get_by_role('button', name='Confirm').click(); pg.wait_for_timeout(2500)
pg.evaluate('window.scrollTo(0,0)'); pg.wait_for_timeout(500)
b.shot('DCO', None, 'UP3', '1-top', 'edit mode top')
pg.get_by_text('Nguyen The Hoang').first.click(); pg.wait_for_timeout(1200)
pg.get_by_placeholder('Search...').first.fill('DCV'); pg.wait_for_timeout(2000)
b.shot('DCO', None, 'UP3', '2-author-search-dcv', 'author picker searched DCV')
print(pg.locator('body').inner_text()[:0])
b.close()
