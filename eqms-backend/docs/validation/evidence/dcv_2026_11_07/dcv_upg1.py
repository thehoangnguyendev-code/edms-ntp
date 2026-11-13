"""DEV only: open SOP.7147 as the operator, start 'Edit Revision for Upgrade' and screenshot. """
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dcv_lib import *
DOC = 'a09c5b96-2b83-48d8-95ce-3e97134ae630'
b = Browser(); pg = b.page('DCO'); pg.set_default_timeout(20000)
pg.goto(f'{BASE}/documents/{DOC}', wait_until='domcontentloaded'); pg.wait_for_timeout(5000)
b.shot('DCO', None, 'UP1', '1-document', 'Effective document SOP.7147 before upgrade')
print([x.inner_text() for x in pg.get_by_role('button').all()][:40])
b.close()
