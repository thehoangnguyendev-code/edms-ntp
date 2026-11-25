"""T8: the Training Materials tab shows the documents of Document Control as a table (No., Document, Revision, Role, Status, Action) with the Open button in the default variant."""
from lib24 import *
import lib31
from lib31 import tab

b = Browser()
S = load()
aid = S['t2b']['aid'] if S.get('t2b') and S['t2b'].get('aid') else S['t2a']['aid']
text = {}


def grab(pg):
    tab('Training Materials')(pg)
    pg.wait_for_timeout(2500)
    text['t'] = pg.inner_text('body')
    text['open'] = pg.get_by_role('button', name='Open').count()
    text['th'] = pg.locator('th').count()


b.shot('admin', f'/training-management/activities/{aid}', 'T8-01', 'Materials_table', 'T8: tab Training Materials: tài liệu từ Document Control trình bày dạng bảng, nút Open dạng mặc định', action=grab, tall=True)
check('T8.1 the documents are in a table with headers', text.get('th', 0) >= 5, text.get('th'))
check('T8.2 the Open button is a button', text.get('open', 0) >= 1, text.get('open'))
lib31.finish('T8', b)
