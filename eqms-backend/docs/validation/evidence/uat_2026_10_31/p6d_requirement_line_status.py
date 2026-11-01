"""Corrections of 2026-10-31, part d: the Status of a line of a Training Requirement shows the status of its activity (option A of the owner)."""
from flows31 import *
b = Browser()
reqs = admin.call('GET', '/training/requirements?limit=50')['data']
hit = None
for r in reqs:
    d = admin.call('GET', f"/training/requirements/{r['id']}")
    if any(l.get('trainingNumber') == 'TRN/QA/26-034' for l in d['lines']):
        hit = d; break
check('F-19.1 the requirement with TRN/QA/26-034 is found', hit is not None, '')
for l in hit['lines']:
    print(l['trainingNumber'], 'line:', l['lineStatus'], 'activity:', l['activityStatus'])
b.shot('admin', f"/training-management/requirements/{hit['id']}", 'F-19', 'Requirement_lines_status_of_activity', 'Training Requirement Details, tab Lines: cột Status hiện trạng thái thật của activity (TRN/QA/26-034 = Planned, giống trang Training Activity Details)', action=tab('Lines'))
pg = b.page('admin')
body = pg.inner_text('body')
check('F-19.2 the line of TRN/QA/26-034 shows Planned, as its own page does', 'Planned' in body and 'In Progress' not in body.split('STATUS')[-1].split('QA')[0], body[-300:])
finish('p6d', b)
