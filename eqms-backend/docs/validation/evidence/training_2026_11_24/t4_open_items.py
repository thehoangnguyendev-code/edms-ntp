"""T4: the items that were left open on 2026-11-24, built and tested the same day (DEC-TRAINING-2026-11-24-4):
 A. cancel a session that is not needed (reason + signature, Planned only, never the last session), the refusal after the notice (TRAINING_ACTIVITY_INVALID_STATE),
    postponing one session of several, and a person who fails two sessions (one line a session in the supplementary dialog);
 B. a person who leaves the company between two sessions of the same activity;
 C. the screens in Vietnamese (the action screens) and the self-reading activity without the table of scores."""
import re
from lib24 import *
import lib31

b = Browser()
A, B, C = 'uat31.s2.qa.pass', 'uat31.s2.qa.fail', 'uat31.s2.qa.absent'
for u in (A, B, C):
    set_status(u, 'Active')
BASE_ACT = '/training-management/activities'
S = load()


def cnt(q):
    r = sql(q)
    return r[0][0] if r else "0"



def cancel_session(sid, reason='RUN24 not needed', token=True):
    body = {}
    if reason is not None:
        body['reason'] = reason
    if token:
        body['signatureToken'] = sign(admin)
    return attempt(admin, 'POST', f'/training/sessions/{sid}/cancel', body)


step('T4A.1 three sessions, the third has no test and no people on the test: the list is confirmed')
aid = new_activity('T4 cancel a session, postpone, fail two sessions')
s1 = add_session(aid, 'CLASSROOM', 'TEST', 'RUN24 T4 part 1', venue='Training room 1')
s2 = add_session(aid, 'CLASSROOM', 'TEST', 'RUN24 T4 part 2', venue='Training room 2')
s3 = add_session(aid, 'CLASSROOM', 'TEST', 'RUN24 T4 part 3 (added by mistake)', venue='Training room 3')
p1 = people_on(aid, s1, [A, B])
p2 = people_on(aid, s2, [A, B])
p3 = people_on(aid, s3, [C])
link(aid, 'RUN24 T4 material')
choose_test(aid, s1)
choose_test(aid, s2)
confirm_list(aid)
check('T4A.1 the list is confirmed and the third session misses its test', 'TRAINING_TEST_REQUIRED' in get(aid)['contentRules']['missing'], get(aid)['contentRules'])
shot_tabs(b, aid, 'T4A-01', 'Three_sessions_list_confirmed', 'T4-A: ba buổi, danh sách đã xác nhận, buổi 3 thêm nhầm (chưa có bài kiểm tra); mỗi buổi chưa bắt đầu có nút Cancel session')

step('T4A.2 cancel the extra session: reason and signature are both required')
code, d, t = cancel_session(s3, reason=None)
check('T4A.2 no reason: refused', code == 400 and 'TRAINING_REASON_REQUIRED' in t, (code, t[:150]))
code, d, t = cancel_session(s3, token=False)
check('T4A.3 no signature: refused', code == 400 and 'TRAINING_SIGNATURE_REQUIRED' in t, (code, t[:150]))
check('T4A.4 nothing changed by the refusals', len([s for s in get(aid)['sessions'] if s['status'] == 'CANCELLED']) == 0, '')


def open_cancel_dialog(pg):
    pg.get_by_role('button', name=re.compile('Cancel session|Huỷ buổi')).last.click()
    pg.wait_for_timeout(1800)


b.shot('admin', f'{BASE_ACT}/{aid}/edit', 'T4A-02', 'Cancel_session_dialog', 'T4-A: hộp thoại Cancel session (lý do bắt buộc, có chữ ký)', action=open_cancel_dialog, tall=False)
code, d, t = cancel_session(s3)
check('T4A.5 the extra session is cancelled', code == 200, (code, t[:200]))
a = get(aid)
check('T4A.6 the session stays as CANCELLED, the others are not touched', [s['status'] for s in a['sessions']] == ['PLANNED', 'PLANNED', 'CANCELLED'], [s['status'] for s in a['sessions']])
check('T4A.7 the people of the cancelled session went with it, the list of the others is intact', cnt(f"select count(*) from training_participants where session_id = '{s3}'").strip() == '0'
      and len(p1) == 2 and cnt(f"select count(*) from training_participants where activity_id = '{aid}'").strip() == '4', '')
check('T4A.8 nothing is missing now: the cancelled session no longer asks for a test', a['contentRules']['missing'] == [], a['contentRules'])
check('T4A.9 the list is still confirmed (no new confirmation asked)', bool(a.get('listPreparedAt') or a.get('listPrepared') or cnt(f"select count(*) from training_activities where id = '{aid}' and list_prepared_by is not null").strip() == '1'), '')
check('T4A.10 the cancellation is in the audit trail with the reason', cnt(f"select count(*) from audit_logs where entity_id = '{aid}' and action_type = 'TRAINING_SESSION_CANCELLED'").strip() != '0', '')
code, d, t = cancel_session(s3)
check('T4A.11 a second cancellation of the same session is refused', code in (409, 400), (code, t[:150]))
shot_tabs(b, aid, 'T4A-03', 'After_cancel', 'T4-A: sau khi huỷ buổi 3: buổi 3 hiện Cancelled, hai buổi còn lại nguyên vẹn')
b.shot('admin', f'{BASE_ACT}/{aid}', 'T4A-04', 'Audit_trail', 'T4-A: Audit Trail ghi huỷ buổi, lý do và những người đã gỡ khỏi buổi', action=tab('Audit Trail'), tall=False)

step('T4A.3 the last session cannot be cancelled (the activity is cancelled instead)')
one = new_activity('T4 one session only')
only = add_session(one, 'CLASSROOM', 'TEST', 'RUN24 T4 only session')
code, d, t = cancel_session(only)
check('T4A.12 the only session: refused TRAINING_LAST_SESSION', code == 409 and 'TRAINING_LAST_SESSION' in t, (code, t[:150]))

step('T4A.4 approval, notice, and the refusal after the notice')
approvals(aid)
notify(aid)
check('T4A.13 Notified', get(aid)['status'] == 'NOTIFIED', get(aid)['status'])
code, d, t = cancel_session(s2)
check('T4A.14 after the notice a session is not cancelled: 403 with the clear reason TRAINING_ACTIVITY_INVALID_STATE', code == 403 and 'TRAINING_ACTIVITY_INVALID_STATE' in t, (code, t[:200]))
code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/sessions', {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'x', 'scheduledOn': TODAY_S, 'locationType': 'ONSITE', 'venue': 'x', 'topics': [{'topicText': 'x'}]})
check('T4A.15 after the notice a session is not added either: same clear reason', code == 403 and 'TRAINING_ACTIVITY_INVALID_STATE' in t, (code, t[:200]))
b.shot('admin', f'{BASE_ACT}/{aid}', 'T4A-05', 'Notified_locked', 'T4-A: sau khi thông báo: nội dung bị khoá, không còn nút Cancel session / Add session')

step('T4A.5 postpone one of the two sessions, then bring it back; the other is untouched')
later = (TODAY + __import__('datetime').timedelta(days=7)).isoformat()
code, d, t = attempt(admin, 'POST', f'/training/sessions/{s2}/postpone', {'newDate': later, 'reason': 'RUN24 room not free', 'moveDueDate': False})
check('T4A.16 session 2 postponed', code == 200, (code, t[:200]))
a = get(aid)
dates = {s['sessionNo']: str(s['scheduledOn'])[:10] for s in a['sessions']}
check('T4A.17 only session 2 moved', dates[2] == later and dates[1] == TODAY_S, dates)
check('T4A.18 the postponement is a recorded event with the reason', cnt(f"select count(*) from training_events where activity_id = '{aid}' and event_type = 'SESSION_POSTPONED'").strip() == '1', '')
code, d, t = attempt(admin, 'POST', f'/training/sessions/{s2}/postpone', {'newDate': TODAY_S, 'reason': 'RUN24 room is free again', 'moveDueDate': False})
check('T4A.19 and back to today', code == 200 and str({s['sessionNo']: s for s in get(aid)['sessions']}[2]['scheduledOn'])[:10] == TODAY_S, (code, t[:150]))
code, d, t = attempt(admin, 'POST', f'/training/sessions/{s2}/postpone', {'newDate': later})
check('T4A.20 a postponement without a reason is refused', code == 400, (code, t[:150]))
b.shot('admin', f'{BASE_ACT}/{aid}', 'T4A-06', 'After_postpone', 'T4-A: buổi 2 đã dời rồi đưa về hôm nay; audit ghi hai lần dời', tall=True)

step('T4A.6 prepare, start; a started session cannot be postponed')
prepare(aid)
code, d, t = start(aid)
check('T4A.21 Start Training', code == 200, (code, t[:200]))
attend(p1[A])
code, d, t = attempt(admin, 'POST', f'/training/sessions/{s1}/postpone', {'newDate': later, 'reason': 'RUN24 too late'})
check('T4A.22 once a session has started it cannot be postponed (409)', code == 409, (code, t[:150]))
attend(p1[B])
attend(p2[A])
attend(p2[B])
score(p1[A], 9)
score(p1[B], 4)
score(p2[A], 9)
score(p2[B], 3)
f = finish_training(aid)
check('T4A.23 Finish Training with a cancelled session in the activity', f[0] == 200, (f[0], f[2][:200]))
c = confirm_completion(aid)
a = get(aid)
check('T4A.24 QA confirms: Completed (the cancelled session does not wait for anything)', c[0] == 200 and a['status'] == 'COMPLETED', (c[0], c[2][:200]))
cands = admin.call('GET', f'/training/activities/{aid}/overview').get('supplementaryCandidates', [])
check('T4A.25 B failed both sessions: two lines for B (one a session), none for A', sorted([x['personUserId'] for x in cands]) == sorted([uid(B), uid(B)]), [x['fullName'] for x in cands])


def open_supp(pg):
    pg.get_by_role('button', name='Supplementary Training').first.click()
    pg.wait_for_timeout(2200)


b.shot('admin', f'{BASE_ACT}/{aid}', 'T4A-07', 'Supplementary_dialog_sessions', 'T4-A: hộp thoại Supplementary Training: người trượt cả hai buổi hiện hai dòng, mỗi dòng ghi Session 1 / Session 2', action=open_supp, tall=False)
code, d, t = supplementary(aid, [x['id'] for x in cands], 'RUN24 retraining of both parts')
check('T4A.26 one make-up with one session for each session B failed', code == 200 and len(d['sessions']) == 2, (code, t[:200]))
S['t4a'] = {'aid': aid, 'child': d.get('id') if code == 200 else None}

step('T4B. a person leaves the company between two sessions')
bid = new_activity('T4 a person leaves between sessions')
q1 = add_session(bid, 'CLASSROOM', 'TEST', 'RUN24 T4B part 1', venue='Training room 1')
q2 = add_session(bid, 'CLASSROOM', 'TEST', 'RUN24 T4B part 2', venue='Training room 2')
pq1 = people_on(bid, q1, [A, C])
pq2 = people_on(bid, q2, [A, C])
link(bid, 'RUN24 T4B material')
choose_test(bid, q1)
choose_test(bid, q2)
run_to_notified(bid)
prepare(bid)
code, d, t = start(bid)
check('T4B.1 Start Training', code == 200, (code, t[:200]))
attend(pq1[A])
attend(pq1[C])
score(pq1[A], 9)
score(pq1[C], 8)
set_status(C, 'Terminated', 'RUN24 left the company between two sessions')
code, d, t = attend(pq2[C], 'ABSENT', 'RUN24 left the company')
check('T4B.2 the person who left is recorded Absent in the second session', code == 200, (code, t[:200]))
attend(pq2[A])
score(pq2[A], 9)
f = finish_training(bid)
check('T4B.3 Finish Training', f[0] == 200, (f[0], f[2][:200]))
c = confirm_completion(bid)
a = get(bid)
check('T4B.4 QA confirms: Completed', c[0] == 200 and a['status'] == 'COMPLETED', (c[0], c[2][:200]))
cands = admin.call('GET', f'/training/activities/{bid}/overview').get('supplementaryCandidates', [])
check('T4B.5 only the missed session of the person is a candidate (the passed one is not)', len(cands) == 1 and cands[0]['personUserId'] == uid(C) and cands[0].get('canOfferSupplementary') is False, [(x['fullName'], x.get('canOfferSupplementary')) for x in cands])
code, d, t = supplementary(bid, [cands[0]['id']], 'RUN24 make-up')
check('T4B.6 no make-up while the account is not Active (409)', code == 409 and 'TRAINING_SUPPLEMENTARY_PERSON_NOT_ACTIVE' in t, (code, t[:200]))
shot_tabs(b, bid, 'T4B-01', 'Left_between_sessions', 'T4-B: người nghỉ việc giữa hai buổi: buổi 1 đạt, buổi 2 Absent; không bù được tới khi tài khoản Active', ('Participants',))
set_status(C, 'Active', 'RUN24 account restored after the test')
code, d, t = supplementary(bid, [cands[0]['id']], 'RUN24 make-up of the second part')
check('T4B.7 once the account is Active the make-up of only the missed session is created', code == 200 and len(d['sessions']) == 1, (code, t[:200]))
S['t4b'] = {'aid': bid}
save(S)

step('T4C. Vietnamese: the action screens, and a self-reading without the table of scores')
mine = admin.call('GET', '/auth/me/localization-settings')
was = mine.get('language')
admin.call('PUT', '/auth/me/localization-settings', {**mine, 'language': 'vi'})
try:
    for sid_, path, name, cap in (
        ('T4C-01', f'{BASE_ACT}/{aid}/edit', 'VI_edit_completed', 'T4-C (tiếng Việt): màn của activity nhiều buổi có một buổi đã huỷ'),
        ('T4C-02', f'{BASE_ACT}/{aid}', 'VI_detail_completed', 'T4-C (tiếng Việt): màn chi tiết Completed'),
        ('T4C-03', f'{BASE_ACT}/{bid}', 'VI_left_between_sessions', 'T4-C (tiếng Việt): người nghỉ việc giữa hai buổi'),
    ):
        b.shot('admin', path, sid_, name, cap, tall=True)
    # an activity of the tests of this run that is still Planned: the Edit / Cancel session / Approve screens in Vietnamese
    pl = new_activity('T4 Vietnamese action screens')
    v1 = add_session(pl, 'CLASSROOM', 'TEST', 'RUN24 T4C part 1')
    v2 = add_session(pl, 'CLASSROOM', 'TEST', 'RUN24 T4C part 2')
    people_on(pl, v1, [A])
    people_on(pl, v2, [A])
    link(pl, 'RUN24 T4C material')
    choose_test(pl, v1)
    choose_test(pl, v2)
    confirm_list(pl)
    b.shot('admin', f'{BASE_ACT}/{pl}/edit', 'T4C-04', 'VI_edit_planned', 'T4-C (tiếng Việt): màn Edit khi Planned, có nút Huỷ buổi', tall=True)
    b.shot('admin', f'{BASE_ACT}/{pl}/edit', 'T4C-05', 'VI_cancel_session_dialog', 'T4-C (tiếng Việt): hộp thoại Huỷ buổi', action=open_cancel_dialog, tall=False)
    admin.call('PUT', f'/training/activities/{pl}/approver-pair', {'firstUserId': uid(APPR1), 'secondUserId': uid(APPR2)})
    admin.call('POST', f'/training/activities/{pl}/submit-for-approval', {'version': get(pl)['version'], 'signatureToken': sign(admin)})
    b.shot(APPR1, f'{BASE_ACT}/{pl}/approve', 'T4C-06', 'VI_approve_first', 'T4-C (tiếng Việt): màn Approve của người phê duyệt thứ nhất', tall=True)
    S['t4c'] = {'aid': pl}
    save(S)
finally:
    admin.call('PUT', '/auth/me/localization-settings', {**mine, 'language': was})

sr = S.get('t1a', {}).get('aid')
if sr:
    text = {}

    def grab(pg):
        text['t'] = pg.inner_text('body')

    b.shot('admin', f'{BASE_ACT}/{sr}', 'T4C-07', 'Self_reading_completed', 'T4-C: activity Tự đọc đã hoàn tất: không còn bảng điểm / bài kiểm tra scan', action=grab, tall=True)
    check('T4C.1 a self-reading activity does not show the table of scores', 'Results and scanned tests' not in text.get('t', ''), 'shown')
    check('T4C.2 but still shows its participants and the results of the reading', 'Participants' in text.get('t', ''), '')
lib31.finish('T4', b)
