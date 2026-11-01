"""Scenario 2, part b: the picture of the Participants tab when a person whose account is closed is still Invited (the label was cut at the edge of the table in the first run: fixed in
TrainingActivityDetailPage.tsx, the note is now a second line). A small classroom activity is started with three people, one of them is closed, and the tab is shot."""
from flows31 import *

state = load()
S = state.setdefault('s2b', {})
b = Browser()
people = ['uat31.s2.qa.pass', 'uat31.s2.qc.pass', 'uat31.s2.pr.left']
set_status('uat31.s2.pr.left', 'Active')
if 'aid' not in S:
    a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'dueDate': (TODAY + datetime.timedelta(days=30)).isoformat()})
    S['aid'] = a['id']
    sid, pid = run_to_start(S['aid'], 'CLASSROOM', 'TEST', people, 'UAT31 display check: a person with a closed account is still invited', exam='UAT31 display check test')
    S['sid'], S['pid'] = sid, pid
    save(state)
aid = S['aid']
set_status('uat31.s2.pr.left', 'Terminated', 'UAT31 left the company')
line = {p['id']: p for p in get(aid)['participants']}[S['pid']['uat31.s2.pr.left']]
check('S2b.1 the line shows the closed account', line.get('accountStatus') == 'Terminated' and line.get('state') == 'INVITED', (line.get('accountStatus'), line.get('state')))
drop_shots(['S2-03'])
b.shot('admin', f'/training-management/activities/{aid}', 'S2-03', 'Participants_person_left_still_invited', 'Tab Participants: người đã nghỉ việc (tài khoản Terminated) vẫn ở trạng thái Invited: ghi chú "Account terminated: cannot sign" ở dòng thứ hai, cột Attendance không bị cắt', action=tab('Participants'))
finish('p2b', b)
