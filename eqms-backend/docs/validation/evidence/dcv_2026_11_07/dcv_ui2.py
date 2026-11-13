"""DEV only: the new Author (dcv.u1) opens SOP.7147 and starts the upload of the new revision file."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dcv_lib import *
DOC = 'a09c5b96-2b83-48d8-95ce-3e97134ae630'
f = os.path.join(HERE, 'upgrade2-sop7147.docx')
open(f, 'wb').write(mini_docx('DCV-TEST SOP.7147 second upgrade Purpose Scope Procedure'))
b = Browser(); pg = b.page('U1'); pg.set_default_timeout(20000)
pg.goto(f'{BASE}/documents/{DOC}', wait_until='domcontentloaded'); pg.wait_for_timeout(5000)
pg.evaluate('window.scrollTo(0, document.body.scrollHeight)'); pg.wait_for_timeout(600)
b.shot('U1', None, 'UI2', '1-author-view', 'new Author opens the document')
print([x.inner_text() for x in pg.get_by_role('button').all() if x.inner_text().strip()][-14:])
pg.get_by_role('button', name='Upload Revision').click(); pg.wait_for_timeout(1500)
b.shot('U1', None, 'UI2', '2-upload-modal', 'Upload Revision dialog')
pg.locator('input[type=file]').first.set_input_files(f); pg.wait_for_timeout(1500)
b.shot('U1', None, 'UI2', '3-file-chosen', 'file chosen')
pg.get_by_placeholder('Enter notes about this revision').fill('DCV-TEST: second upgrade uploaded by the Author through the screen')
pg.get_by_role('button', name='OK', exact=True).click(); pg.wait_for_timeout(7000)
print('URL', pg.url)
b.shot('U1', None, 'UI2', '4-after-upload', 'after OK: what the Author sees')
print([x.inner_text() for x in pg.get_by_role('button').all() if x.inner_text().strip()]); print(pg.url)
b.close()
