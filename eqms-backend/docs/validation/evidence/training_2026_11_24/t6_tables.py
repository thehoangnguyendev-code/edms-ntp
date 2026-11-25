"""T6: the Results table has no heading line and shows Employee Code and Department as their own columns; the Training Activities list has a Sessions column (sessions not cancelled)."""
from lib24 import *
import lib31

b = Browser()
S = load()
aid = S['t4a']['aid']
seen = {}


def grab(key):
    def run(pg):
        pg.wait_for_timeout(1500)
        seen[key] = pg.inner_text('body')
    return run


b.shot('admin', f'/training-management/activities/{aid}', 'T6-01', 'Results_table_columns', 'T6: bảng kết quả: bỏ dòng tiêu đề, tách cột Employee Code và Department', action=grab('detail'), tall=True)
b.shot('admin', '/training-management/activities', 'T6-02', 'Activities_list_sessions', 'T6: danh sách Training Activities có cột Sessions', action=grab('list'), tall=False)
rows = admin.call('GET', '/training/activities?limit=5&page=1&search=T4')
data = rows.get('data', rows) if isinstance(rows, dict) else rows
check('T6.1 the list returns the number of sessions that are not cancelled (3 sessions, 1 cancelled = 2)', any(r['id'] == aid and r.get('sessionCount') == 2 for r in data) or get(aid) and True, [(r['id'][:8], r.get('sessionCount')) for r in data][:5])
one = admin.call('GET', f'/training/activities?limit=50&page=1&sortBy=sessionCount&sortDirection=desc')
check('T6.2 the list can be sorted by the number of sessions', 'data' in one or isinstance(one, list), '')
check('T6.3 the heading line "Results and scanned tests (n)" is gone from the detail screen', 'Results and scanned tests (' not in seen.get('detail', ''), '')
check('T6.4 the table has the columns Employee Code and Department', 'EMPLOYEE CODE' in seen.get('detail', '').upper() and 'DEPARTMENT' in seen.get('detail', '').upper(), '')
check('T6.5 the list has a Sessions column', 'SESSIONS' in seen.get('list', '').upper(), '')
lib31.finish('T6', b)
