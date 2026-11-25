"""T3: the action screens of the lifecycle, one for each state, as the person who acts sees them: Edit (planning), Approve (first and second approver), Prepare, Conduct, Confirm (QA). One classroom + test
activity with three people (one passes, one fails, one absent), driven through the API, with a shot at every state taken as the person whose turn it is."""
from lib24 import *
import lib31

b = Browser()
P1, ABS, FAIL = 'uat31.s1.pass1', 'uat31.s1.absent', 'uat31.s1.fail'
for u in (P1, ABS, FAIL):
    set_status(u, 'Active')
sql(f"update training_work_suspensions set status='CLEARED', cleared_at=now(), clear_basis='RUN24_RESET' where person_user_id = '{uid(FAIL)}' and cleared_at is null")
BASE_ACT = '/training-management/activities'

step('T3.1 planning: the Edit screen')
aid = new_activity('T3 action screens classroom test')
sid = add_session(aid, 'CLASSROOM', 'TEST', 'RUN24 Cleaning of classified rooms (action screens)')
pid = people_on(aid, sid, [P1, ABS, FAIL])
link(aid, 'RUN24 cleaning slides')
choose_test(aid, sid)
confirm_list(aid)
admin.call('PUT', f'/training/activities/{aid}/approver-pair', {'firstUserId': uid(APPR1), 'secondUserId': uid(APPR2)})
b.shot('admin', f'{BASE_ACT}/{aid}/edit', 'T3-01', 'Edit_planning', 'T3: màn Edit (lập kế hoạch): buổi, người tham gia, nội dung, người phê duyệt, nút Submit for Approval', tall=True)

step('T3.2 the first approver, then the second')
admin.call('POST', f'/training/activities/{aid}/submit-for-approval', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
b.shot(APPR1, f'{BASE_ACT}/{aid}/approve', 'T3-02', 'Approve_first', 'T3: người phê duyệt thứ nhất mở màn Approve', tall=True)
a1 = U(APPR1)
a1.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE_FIRST', 'signatureToken': sign(a1)})
b.shot(APPR2, f'{BASE_ACT}/{aid}/approve', 'T3-03', 'Approve_second', 'T3: người phê duyệt thứ hai mở màn Approve (sau khi người thứ nhất đã ký)', tall=True)
a2 = U(APPR2)
a2.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(a2)})
check('T3.1 both approved: Notify is offered', get(aid)['capabilities'].get('notify') is True, get(aid)['capabilities'].get('notify'))
b.shot('admin', f'{BASE_ACT}/{aid}', 'T3-04', 'Approved_notify_offered', 'T3: sau hai chữ ký: nút Notify Participants', tall=True)

step('T3.3 notice, Prepare Training, Start Training')
notify(aid)
b.shot('admin', f'{BASE_ACT}/{aid}/prepare', 'T3-05', 'Prepare_training', 'T3: màn Prepare Training (địa điểm, thiết bị, tài liệu, thông báo)', tall=True)
prepare(aid)
b.shot('admin', f'{BASE_ACT}/{aid}/prepare', 'T3-06', 'Prepare_done', 'T3: Prepare Training sau khi điền từ hồ sơ: sẵn sàng Start Training', tall=True)
code, d, t = start(aid)
check('T3.2 Start Training', code == 200, (code, t))

step('T3.4 conduct: attendance, absence, scores')
attend(pid[ABS], 'ABSENT', 'RUN24 sick leave')
attend(pid[P1])
attend(pid[FAIL])
b.shot('admin', f'{BASE_ACT}/{aid}/conduct', 'T3-07', 'Conduct_attendance', 'T3: màn Conduct sau khi điểm danh', tall=True)
score(pid[P1], 9)
score(pid[FAIL], 4)
b.shot('admin', f'{BASE_ACT}/{aid}/conduct', 'T3-08', 'Conduct_scored', 'T3: màn Conduct sau khi chấm điểm: 1 đạt, 1 trượt, 1 vắng', tall=True)
b.shot('admin', f'{BASE_ACT}/{aid}/sessions/{sid}/workspace', 'T3-09', 'Session_workspace', 'T3: Session Workspace của buổi đào tạo', tall=True)

step('T3.5 finish and QA')
f = finish_training(aid)
check('T3.3 Finish Training', f[0] == 200, (f[0], f[2]))
b.shot(APPR1, f'{BASE_ACT}/{aid}/confirm', 'T3-10', 'Confirm_QA', 'T3: QA mở màn Confirm để xác nhận hoàn tất', tall=True)
c = confirm_completion(aid)
check('T3.4 QA confirms: Completed', c[0] == 200 and get(aid)['status'] == 'COMPLETED', (c[0], c[2]))
b.shot('admin', f'{BASE_ACT}/{aid}', 'T3-11', 'Completed_supplementary_offered', 'T3: Completed, nút Supplementary Training cho người vắng và người trượt', tall=True)
b.shot('admin', f'{BASE_ACT}', 'T3-12', 'Activities_list', 'T3: danh sách Training Activities với các trạng thái và các mã a, b', tall=True)
S = load()
S['t3'] = {'aid': aid}
save(S)
lib31.finish('T3', b)
