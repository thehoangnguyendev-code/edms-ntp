"""DEV only (no save): after the fix, the Author/Co-Author names in the Save dialog. the operator configures the next revision (upgrade) of SOP.7147 with new Author / Co-Author / Reviewer / Approver. Screenshots every step."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dcv_lib import *
DOC = 'f10ac366-0809-4a43-86b8-0332d924f6d2'
b = Browser(); pg = b.page('DCO'); pg.set_default_timeout(20000)
pg.goto(f'{BASE}/documents/{DOC}', wait_until='domcontentloaded'); pg.wait_for_timeout(5000)
pg.get_by_role('button', name='Edit Revision for Upgrade').click(); pg.wait_for_timeout(1200)
pg.get_by_role('button', name='Confirm').click(); pg.wait_for_timeout(2500)
pg.evaluate('window.scrollTo(0,0)')
pg.locator('label:text-matches("^Author") + *').first.click(); pg.wait_for_timeout(1000)
pg.get_by_placeholder('Search...').first.fill('TEST-DCV-01'); pg.wait_for_timeout(1500)
pg.get_by_text('TEST-DCV-01 - DCV Contributor 1').first.click(); pg.wait_for_timeout(800)
pg.get_by_text('Select Co-Authors').first.click(); pg.wait_for_timeout(1000)
pg.get_by_placeholder('Search...').last.fill('TEST-DCV-02'); pg.wait_for_timeout(1500)
pg.get_by_text('TEST-DCV-02 - DCV Contributor 2').first.click(); pg.wait_for_timeout(500)
pg.keyboard.press('Escape'); pg.mouse.click(700, 100); pg.wait_for_timeout(800)
b.shot('DCO', None, 'UP5', '1-author-coauthor', 'Author = DCV Contributor 1, Co-Author = DCV Contributor 2')

pg.evaluate('window.scrollTo(0,0)')
pg.get_by_text('Select review date').first.click(); pg.wait_for_timeout(1200)
pg.get_by_text('30', exact=True).last.click(); pg.wait_for_timeout(500)
pg.get_by_role('button', name='Apply').click(); pg.wait_for_timeout(800)

pg.get_by_role('button', name='Save', exact=True).click(); pg.wait_for_timeout(4000)
b.shot('DCO', None, 'FIX3', '1-save-dialog', 'Save dialog: Author/Co-Author by name')
txt = pg.locator('body').inner_text()
import re
print('UUID in page text:', re.findall(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', txt))
i = txt.find('Review the changes'); print(txt[i:i+600])
b.close()
