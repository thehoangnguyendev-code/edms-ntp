import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dcv_lib import *
DOC = 'a09c5b96-2b83-48d8-95ce-3e97134ae630'
b = Browser(); pg = b.page('DCO'); pg.set_default_timeout(20000)
pg.goto(f'{BASE}/documents/{DOC}', wait_until='domcontentloaded'); pg.wait_for_timeout(5000)
pg.get_by_role('button', name='Edit Revision for Upgrade').click(); pg.wait_for_timeout(1200)
pg.get_by_role('button', name='Confirm').click(); pg.wait_for_timeout(2500)
pg.evaluate('window.scrollTo(0,0)')
# Author -> DCV Contributor 1
pg.get_by_text('Nguyen The Hoang').first.click(); pg.wait_for_timeout(1000)
pg.get_by_placeholder('Search...').first.fill('TEST-DCV-01'); pg.wait_for_timeout(1500)
pg.get_by_text('TEST-DCV-01 - DCV Contributor 1').first.click(); pg.wait_for_timeout(800)
# Co-Author -> DCV Contributor 2
pg.get_by_text('Select Co-Authors').first.click(); pg.wait_for_timeout(1000)
pg.get_by_placeholder('Search...').last.fill('TEST-DCV-02'); pg.wait_for_timeout(1500)
pg.get_by_text('TEST-DCV-02 - DCV Contributor 2').first.click(); pg.wait_for_timeout(500)
pg.keyboard.press('Escape'); pg.mouse.click(700, 100); pg.wait_for_timeout(800)
b.shot('DCO', None, 'UP4', '1-author-coauthor', 'new Author and Co-Author chosen for the upgrade')
pg.get_by_role('button', name='Reviewers', exact=True).click(); pg.wait_for_timeout(1500)
pg.get_by_placeholder('Search by name').fill('DCV Contributor 3'); pg.wait_for_timeout(1200)
pg.locator('div:has(> div:has-text("TEST-DCV-03"))').filter(has_text='DCV Contributor 3').last.click(); pg.wait_for_timeout(600)
b.shot('DCO', None, 'UP4', '2-reviewer-picked', 'Setup Reviewers: DCV Contributor 3 selected')
pg.get_by_role('button', name='Update Reviewers').click(); pg.wait_for_timeout(1500)
pg.get_by_role('button', name='Approvers', exact=True).click(); pg.wait_for_timeout(1500)
pg.get_by_role('button', name='Cancel').click(); pg.wait_for_timeout(800)
b.shot('DCO', None, 'UP4', '3-approver-table', 'Approvers tab with the current approver')
print([x.get_attribute('aria-label') or x.inner_text()[:20] for x in pg.locator('table button, tbody button').all()][:10])
b.close()
