"""DEV only: the operator configures the next revision (upgrade) of SOP.7147 with new Author / Co-Author / Reviewer / Approver. Screenshots every step."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dcv_lib import *
DOC = 'a09c5b96-2b83-48d8-95ce-3e97134ae630'
b = Browser(); pg = b.page('DCO'); pg.set_default_timeout(20000)
pg.goto(f'{BASE}/documents/{DOC}', wait_until='domcontentloaded'); pg.wait_for_timeout(5000)
pg.get_by_role('button', name='Edit Revision for Upgrade').click(); pg.wait_for_timeout(1200)
pg.get_by_role('button', name='Confirm').click(); pg.wait_for_timeout(2500)
pg.evaluate('window.scrollTo(0,0)')
pg.get_by_text('Nguyen The Hoang').first.click(); pg.wait_for_timeout(1000)
pg.get_by_placeholder('Search...').first.fill('TEST-DCV-01'); pg.wait_for_timeout(1500)
pg.get_by_text('TEST-DCV-01 - DCV Contributor 1').first.click(); pg.wait_for_timeout(800)
pg.get_by_text('Select Co-Authors').first.click(); pg.wait_for_timeout(1000)
pg.get_by_placeholder('Search...').last.fill('TEST-DCV-02'); pg.wait_for_timeout(1500)
pg.get_by_text('TEST-DCV-02 - DCV Contributor 2').first.click(); pg.wait_for_timeout(500)
pg.keyboard.press('Escape'); pg.mouse.click(700, 100); pg.wait_for_timeout(800)
b.shot('DCO', None, 'UP5', '1-author-coauthor', 'Author = DCV Contributor 1, Co-Author = DCV Contributor 2')
# Reviewer
pg.get_by_role('button', name='Reviewers', exact=True).click(); pg.wait_for_timeout(1500)
pg.get_by_placeholder('Search by name').fill('DCV Contributor 3'); pg.wait_for_timeout(1200)
pg.locator('div:has(> div:has-text("TEST-DCV-03"))').filter(has_text='DCV Contributor 3').last.click(); pg.wait_for_timeout(600)
b.shot('DCO', None, 'UP5', '2-reviewer', 'Reviewer = DCV Contributor 3')
pg.get_by_role('button', name='Update Reviewers').click(); pg.wait_for_timeout(1500)
# Approver: remove the current one, add DCV Copy Approver
pg.get_by_role('button', name='Approvers', exact=True).click(); pg.wait_for_timeout(1200)
pg.get_by_role('button', name='Cancel').click(); pg.wait_for_timeout(800)
pg.locator('tbody tr', has_text='approver.test1@example.local').locator('button').first.click(); pg.wait_for_timeout(1200)
b.shot('DCO', None, 'UP5', '3-remove-approver', 'after clicking remove on the old approver')
for t in ['Remove', 'Confirm', 'Yes']:
    bt = pg.get_by_role('button', name=t, exact=True)
    if bt.count() and bt.first.is_visible():
        bt.first.click(); pg.wait_for_timeout(1000); break
pg.get_by_role('button', name='Approvers', exact=True).click(); pg.wait_for_timeout(1500)
pg.get_by_placeholder('Search by name').fill('DCV Copy Approver'); pg.wait_for_timeout(1200)
pg.locator('div:has(> div:has-text("TEST-DCV-04"))').filter(has_text='DCV Copy Approver').last.click(); pg.wait_for_timeout(600)
b.shot('DCO', None, 'UP5', '4-approver', 'Approver = DCV Copy Approver')
pg.get_by_role('button', name='Commit Selection').click(); pg.wait_for_timeout(1500)
b.shot('DCO', None, 'UP5', '5-approvers-tab', 'Approvers tab after change')
# Review date + description
pg.evaluate('window.scrollTo(0,0)')
pg.get_by_text('Select review date').first.click(); pg.wait_for_timeout(1200)
b.shot('DCO', None, 'UP5', '6-date-picker', 'review date picker')
pg.get_by_text('30', exact=True).last.click(); pg.wait_for_timeout(500)
pg.get_by_role('button', name='Apply').click(); pg.wait_for_timeout(800)
pg.locator('textarea').last.fill('DCV-TEST upgrade 2.0.0: new Author/Co-Author/Reviewer/Approver, to test the per-role access profiles.'); pg.wait_for_timeout(500)
b.shot('DCO', None, 'UP5', '7-form-filled', 'review date and description filled')
pg.get_by_role('button', name='Save', exact=True).click(); pg.wait_for_timeout(4000)
b.shot('DCO', None, 'UP5', '8-confirm-save', 'Save Next-Revision Configuration dialog (before/after)')
pg.locator('div[role=dialog], div.fixed').get_by_role('button', name='Save', exact=True).last.click(); pg.wait_for_timeout(4000)
b.shot('DCO', None, 'UP5', '8b-after-save', 'after confirming Save')
pg.evaluate('window.scrollTo(0,0)'); pg.wait_for_timeout(600)
b.shot('DCO', None, 'UP5', '9-top-after-save', 'top of page after Save')
b.close()
