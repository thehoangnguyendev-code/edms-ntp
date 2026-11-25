"""T12: Select Approver and Submit for Approval are taken only by a person of the department that organizes the training, also by one who holds the permission to organize and may see every department
(DEC-TRAINING-2026-11-25-2)."""
from lib24 import *
import lib31

A = 'uat31.s2.qa.pass'
set_status(A, 'Active')
aid = new_activity('T12 submit department')
sid = add_session(aid, 'CLASSROOM', 'TEST', 'RUN24 T12 topic')
people_on(aid, sid, [A])
confirm_list(aid)
link(aid, 'RUN24 T12 material')
choose_test(aid, sid)
act = get(aid)
dep = act['departmentName']
print('activity department:', dep)
rows = []
for u in ('admin', 'approver.test1', 'user.a.test', 'dco.test1', 'uat31.head.qc', 'uat31.head.qa', 'uat31.head.pr', 'author.test1'):
    try:
        c = U(u)
    except SystemExit:
        continue
    code, d, t = attempt(c, 'PUT', f'/training/activities/{aid}/approver-pair', {'firstUserId': uid(APPR1), 'secondUserId': uid(APPR2)})
    own = sql(f"select department from app_users where username = '{u}'")[0][0]
    rows.append((u, own, code, t[:70] if code != 200 else ''))
    print(u, '| department:', own, '| Select Approver ->', code)
same = [r for r in rows if r[1] == dep]
other = [r for r in rows if r[1] != dep]
check('T12.1 at least one person of another department was tried', len(other) > 0, rows)
check('T12.2 nobody of another department could choose the approvers (403)', all(r[2] == 403 for r in other), other)
check('T12.3 the person of the department that holds the permission could', any(r[2] == 200 for r in same), same)
lib31.finish('T12', None) if False else None
