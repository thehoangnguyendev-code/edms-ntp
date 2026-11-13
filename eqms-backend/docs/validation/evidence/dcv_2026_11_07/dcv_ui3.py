"""DEV only: Co-Author and Author open the Draft revision; Edit File Online (Office Online)."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dcv_lib import *
RID = '0bd67452-5a7c-412e-8a20-27e163454689'
b = Browser()
for role, tag in (('U2', 'UI3-coauthor'), ('U3', 'UI3-reviewer-draft')):
    pg = b.page(role); pg.set_default_timeout(20000)
    pg.goto(f'{BASE}/documents/revisions/edit/{RID}', wait_until='domcontentloaded'); pg.wait_for_timeout(6000)
    print(role, pg.url, [x.inner_text() for x in pg.get_by_role('button').all() if x.inner_text().strip()][-8:])
    b.shot(role, None, tag, '1-open', f'{role} opens the Draft revision')
pg = b.page('U2')
pg.goto(f'{BASE}/documents/revisions/edit/{RID}', wait_until='domcontentloaded'); pg.wait_for_timeout(5000)
if pg.get_by_role('button', name='Edit File Online').count():
    with pg.context.expect_page(timeout=30000) as np:
        pg.get_by_role('button', name='Edit File Online').first.click()
    pop = np.value; pop.wait_for_load_state('domcontentloaded'); pop.wait_for_timeout(8000)
    print('popup', pop.url[:120]); pop.screenshot(path=os.path.join(SHOTS, 'UI3__2-edit-online-coauthor.png'))
else:
    pg.get_by_role('button', name='Edit File Online').first.click() if False else print('no Edit File Online for U2')
b.close()
