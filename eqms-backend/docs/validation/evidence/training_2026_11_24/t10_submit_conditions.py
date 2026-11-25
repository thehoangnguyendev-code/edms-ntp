"""T10: Submit for Approval is offered only when everything the approvers sign is in place (DEC-TRAINING-2026-11-25-1): a session with a trainer, people on every session, the confirmed list, the material and the test,
the two approvers saved; it is refused by the server with the same list; only an organizer of the department, only while the activity is Planned, with a signature."""
from lib24 import *
import lib31

b = Browser()
A, B = 'uat31.s2.qa.pass', 'uat31.s2.qa.fail'
OUTSIDER = 'uat31.s1.pass1'
for u in (A, B, OUTSIDER):
    set_status(u, 'Active')
BASE_ACT = '/training-management/activities'


def caps(aid):
    return get(aid)['capabilities']


def submit(aid, who=None):
    c = who or admin
    return attempt(c, 'POST', f'/training/activities/{aid}/submit-for-approval', {'version': get(aid)['version'], 'signatureToken': sign(c)})


step('T10.1 an empty activity: nothing to submit, the list says what is missing, the server refuses with the first one')
aid = new_activity('T10 submit conditions')
c = caps(aid)
check('T10.1 the button is not offered', c.get('submitForApproval') is False, c)
check('T10.2 the list starts with the session', c.get('submitBlockers', [''])[0] == 'TRAINING_SESSION_REQUIRED', c.get('submitBlockers'))
code, d, t = submit(aid)
check('T10.3 the server refuses with the same first reason (409)', code == 409 and 'TRAINING_SESSION_REQUIRED' in t, (code, t[:150]))

step('T10.2 a session without people, then the people, then the list')
sid = add_session(aid, 'CLASSROOM', 'TEST', 'RUN24 T10 topic')
c = caps(aid)
check('T10.4 now the people are missing', c.get('submitForApproval') is False and c['submitBlockers'][0] == 'TRAINING_PARTICIPANT_REQUIRED', c.get('submitBlockers'))
code, d, t = submit(aid)
check('T10.5 refused: TRAINING_PARTICIPANT_REQUIRED', code == 409 and 'TRAINING_PARTICIPANT_REQUIRED' in t, (code, t[:150]))
people_on(aid, sid, [A, B])
c = caps(aid)
check('T10.6 the list is not confirmed', c['submitBlockers'][0] == 'TRAINING_LIST_NOT_CONFIRMED', c.get('submitBlockers'))
code, d, t = submit(aid)
check('T10.7 refused: TRAINING_LIST_NOT_CONFIRMED', code == 409 and 'TRAINING_LIST_NOT_CONFIRMED' in t, (code, t[:150]))
b.shot('admin', f'{BASE_ACT}/{aid}/edit', 'T10-01', 'Blocked_list', 'T10: màn Edit: chưa đủ điều kiện, không có nút Submit for Approval, danh sách ghi những gì còn thiếu', tall=True)
confirm_list(aid)
c = caps(aid)
check('T10.8 the material and the test are missing, and the approvers', c['submitBlockers'][-1] == 'TRAINING_APPROVERS_NOT_SAVED' and len(c['submitBlockers']) >= 2, c.get('submitBlockers'))
link(aid, 'RUN24 T10 material')
choose_test(aid, sid)
c = caps(aid)
check('T10.9 only the approvers are missing', c['submitBlockers'] == ['TRAINING_APPROVERS_NOT_SAVED'] and c['submitForApproval'] is False, c.get('submitBlockers'))
code, d, t = submit(aid)
check('T10.10 refused: TRAINING_APPROVERS_NOT_SAVED', code == 409 and 'TRAINING_APPROVERS_NOT_SAVED' in t, (code, t[:150]))

step('T10.3 the approvers are saved: nothing is missing, the button is offered')
admin.call('PUT', f'/training/activities/{aid}/approver-pair', {'firstUserId': uid(APPR1), 'secondUserId': uid(APPR2)})
c = caps(aid)
check('T10.11 nothing is missing and the button is offered', c['submitBlockers'] == [] and c['submitForApproval'] is True, c.get('submitBlockers'))
b.shot('admin', f'{BASE_ACT}/{aid}/edit', 'T10-02', 'Ready_button', 'T10: đủ điều kiện: có nút Submit for Approval', tall=True)

step('T10.4 who may submit: a person without the permission of the organizer')
code, d, t = submit(aid, U(OUTSIDER))
check('T10.12 a person who does not organize trainings is refused (403)', code == 403, (code, t[:150]))
check('T10.13 the activity is still Planned', get(aid)['status'] == 'PLANNED', get(aid)['status'])

step('T10.5 the organizer submits with a signature: Pending Approval, the button is gone')
code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/submit-for-approval', {'version': get(aid)['version']})
check('T10.14 without a signature: refused', code == 400 and 'TRAINING_SIGNATURE_REQUIRED' in t, (code, t[:150]))
code, d, t = submit(aid)
check('T10.15 submitted', code == 200 and get(aid)['status'] == 'PENDING_APPROVAL', (code, t[:150]))
c = caps(aid)
check('T10.16 in Pending Approval the button is not offered and nothing is listed', c['submitForApproval'] is False and c['submitBlockers'] == [], c)
code, d, t = submit(aid)
check('T10.17 a second submission is refused', code in (403, 409), (code, t[:150]))
lib31.finish('T10', b)
