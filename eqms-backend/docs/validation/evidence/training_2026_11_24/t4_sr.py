"""T4-C: an activity whose sessions are all self-reading no longer shows the table of scores and scanned tests; a classroom + test activity still does."""
from lib24 import *
import lib31

b = Browser()
S = load()
sr, cl = S['t2a']['aid'], S['t4a']['aid']
seen = {}


def grab(key):
    def run(pg):
        pg.wait_for_timeout(1500)
        seen[key] = pg.inner_text('body')
    return run


b.shot('admin', f'/training-management/activities/{sr}', 'T4C-07', 'Self_reading_completed', 'T4-C: activity Tự đọc đã hoàn tất: không còn bảng điểm / bài kiểm tra scan', action=grab('sr'), tall=True)
b.shot('admin', f'/training-management/activities/{cl}', 'T4C-08', 'Classroom_completed_has_results', 'T4-C: activity Tập trung + Kiểm tra vẫn có bảng điểm', action=grab('cl'), tall=True)
a = get(sr)
check('T4C.1 the self-reading activity has only self-reading sessions', all(s['method'] == 'SELF_READING' for s in a['sessions'] if s['status'] != 'CANCELLED'), [s['method'] for s in a['sessions']])
check('T4C.2 a self-reading does not show the table of scores', 'Results and scanned tests' not in seen.get('sr', ''), '')
check('T4C.3 a classroom + test activity still shows it', 'Results and scanned tests' in seen.get('cl', ''), seen.get('cl', '')[:80])
lib31.finish('T4_sr', b)
