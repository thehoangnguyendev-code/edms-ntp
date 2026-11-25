from lib24 import *
import lib31
from lib31 import tab
b = Browser()
rid = 'e0adcf6a-3949-47cc-bd05-077534a79a79'
text = {}


def grab(pg):
    pg.wait_for_timeout(2500)
    els = [e for e in pg.get_by_text('Training Information', exact=True).all() if e.is_visible()]
    els[-1].click()
    pg.wait_for_timeout(2500)
    text['t'] = pg.inner_text('body')


b.shot('admin', f'/documents/revisions/{rid}', 'T14-01', 'Covered_revision_note', 'T14: Training Information của form: ghi rõ vì sao không có bước Pending Training riêng', action=grab, tall=False)
check('T14.1 the tab explains why the revision has no Pending Training of its own', 'needs no training of its own' in text.get('t', ''), text.get('t', '')[:200])
lib31.finish('T14', b)
