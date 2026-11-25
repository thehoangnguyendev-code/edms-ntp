"""T1-A: one session, self-reading (APD.0108): two people read and sign, one cannot read (recorded absent), the head of the department confirms, QA completes; then the make-up (suffix a) for the
person who could not read, in the same way. Expected results come from SOP.0003 5.1.2 (self-reading), 5.3.4 (list), 5.3.5 (two approvers), 5.3.6 (notice, preparation), 5.3.7 (make-up)."""
from lib24 import *
import lib31

b = Browser()
for u in ('uat31.s1.pass1', 'uat31.s1.pass2', 'uat31.s1.absent'):
    set_status(u, 'Active')
S = {}

step('T1A.1 create the activity (no document): Planned, with a Training Number')
aid = new_activity('T1A single session self-reading')
a = get(aid)
S['aid'] = aid
check('T1A.1 Planned with a Training Number', a['status'] == 'PLANNED' and a['trainingNumber'].startswith('TRN/'), (a['status'], a['trainingNumber']))
shot_tabs(b, aid, 'T1A-01', 'Activity_created_planned', f"T1-A: activity {a['trainingNumber']} vừa tạo (Planned), chưa có buổi")

step('T1A.2 one self-reading session with its material; the rules ask for a material, no test')
sid = add_session(aid, 'SELF_READING', 'SELF_READING_CONFIRMATION', 'RUN24 Self-reading of the cleaning procedure', venue='Own workstation')
link(aid, 'RUN24 cleaning procedure (read)')
a = get(aid)
rules = a['contentRules']
check('T1A.2 a self-reading needs a material and no test or checklist', rules['materialsRequired'] and rules['materialsSatisfied'] and not rules['testRequired'] and not rules['checklistRequired'] and rules['missing'] == [], rules)
shot_tabs(b, aid, 'T1A-02', 'Session_and_material', 'T1-A: một buổi Tự đọc và tài liệu đọc', ('General Information', 'Training Materials'))

step('T1A.3 the people (QC): two to read, one who will not be able to; the list is confirmed')
pid = people_on(aid, sid, ['uat31.s1.pass1', 'uat31.s1.pass2', 'uat31.s1.absent'])
check('T1A.3 three people on the list', len(pid) == 3, pid)
code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/submit-for-approval', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
check('T1A.3b submit for approval is refused while the two approvers are not chosen', code == 409 and 'TRAINING_APPROVERS_NOT_SAVED' in t, (code, t))
confirm_list(aid)
shot_tabs(b, aid, 'T1A-03', 'People_listed', 'T1-A: danh sách 3 người đã xác nhận', ('Participants',))

step('T1A.4 two approvers by permission, in turn')
code, d, t = attempt(admin, 'PUT', f'/training/activities/{aid}/approver-pair', {'firstUserId': uid(APPR1), 'secondUserId': uid(APPR1)})
check('T1A.4 the same person cannot be both approvers', code == 400, (code, t))
admin.call('PUT', f'/training/activities/{aid}/approver-pair', {'firstUserId': uid(APPR1), 'secondUserId': uid(APPR2)})
admin.call('POST', f'/training/activities/{aid}/submit-for-approval', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
a = get(aid)
check('T1A.5 Pending Approval', a['status'] == 'PENDING_APPROVAL', a['status'])
shot_tabs(b, aid, 'T1A-04', 'Pending_approval', 'T1-A: Pending Approval, chờ người phê duyệt thứ nhất')
prod = U(APPR2)
code, d, t = attempt(prod, 'POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(prod)})
check('T1A.6 the second approver cannot sign before the first', code in (403, 409), (code, t))
qa1 = U(APPR1)
qa1.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE_FIRST', 'signatureToken': sign(qa1)})
prod.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(prod)})
a = get(aid)
check('T1A.7 both approved: still Pending Approval, Notify is offered', a['status'] == 'PENDING_APPROVAL' and a['capabilities'].get('notify') is True, (a['status'], a['capabilities'].get('notify')))

step('T1A.5 notice: Notified, and then locked')
notify(aid)
a = get(aid)
check('T1A.8 Notified', a['status'] == 'NOTIFIED', a['status'])
code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/sessions', {'method': 'SELF_READING', 'assessmentMethod': 'SELF_READING_CONFIRMATION', 'externalTrainerName': 'X', 'scheduledOn': TODAY_S, 'venue': 'x', 'topics': [{'topicText': 'late'}]})
check('T1A.9 Notified is locked: a session cannot be added (no policy allows it in this state)', code in (403, 409), (code, t))
shot_tabs(b, aid, 'T1A-05', 'Notified', 'T1-A: Notified (khóa nội dung, chỉ còn Hoãn/Sửa nội dung)')

step('T1A.6 Prepare Training, then Start Training')
code, d, t = start(aid)
check('T1A.10 Start Training is refused before the preparation is done', code == 409 and 'TRAINING_PREPARATION_PENDING' in t, (code, t))
prepare(aid)
code, d, t = start(aid)
check('T1A.11 Start Training with a signature: In Progress', code == 200 and d.get('status') == 'IN_PROGRESS', (code, t))
shot_tabs(b, aid, 'T1A-06', 'In_progress', 'T1-A: In Progress sau Prepare + Start Training')

step('T1A.7 the reading: two sign, one cannot read; the head confirms')
code, d, t = attempt(U(HEAD_QC), 'POST', f'/training/activities/{aid}/verify-self-reading', {'signatureToken': sign(U(HEAD_QC)), 'reason': 'RUN24'})
check('T1A.12 the head cannot confirm before anybody signed', code >= 400, (code, t))
code, d, t = read('uat31.s1.pass1', pid['uat31.s1.pass1'])
check('T1A.13 the first reader signs', code == 200, (code, t))
code, d, t = attempt(admin, 'POST', f"/training/participants/{pid['uat31.s1.pass2']}/remind-read")
check('T1A.14 the trainer reminds the person who has not signed', code == 200, (code, t))
code, d, t = read('uat31.s1.pass2', pid['uat31.s1.pass2'])
check('T1A.15 the second reader signs', code == 200, (code, t))
code, d, t = head_verifies(aid, HEAD_QC)
check('T1A.16 the head cannot confirm while a person has neither signed nor been recorded', code == 409 and 'NOT_ALL_SIGNED' in t, (code, t))
code, d, t = cannot_read(pid['uat31.s1.absent'], '')
check('T1A.17 Cannot Read needs a reason', code == 400, (code, t))
code, d, t = cannot_read(pid['uat31.s1.absent'], 'RUN24 on long leave, cannot read in time')
check('T1A.18 the person who cannot read is recorded absent', code == 200, (code, t))
shot_tabs(b, aid, 'T1A-07', 'Readers_signed_one_absent', 'T1-A: 2 người đã ký đã đọc, 1 người vắng (không đọc được)', ('General Information', 'Participants'))
code, d, t = head_verifies(aid, HEAD_QC)
check('T1A.19 the head of the department confirms', code == 200, (code, t))
a = get(aid)
res = {u: part(a, u)[0]['result'] for u in ('uat31.s1.pass1', 'uat31.s1.pass2', 'uat31.s1.absent')}
check('T1A.20 the two readers PASSED, the absent person has no result', res['uat31.s1.pass1'] == 'PASSED' and res['uat31.s1.pass2'] == 'PASSED' and res['uat31.s1.absent'] == 'PENDING', res)
shot_tabs(b, aid, 'T1A-08', 'Head_confirmed', 'T1-A: trưởng bộ phận đã xác nhận APD.0108', ('Participants',))

step('T1A.8 Finish Training, QA confirms')
f = finish_training(aid)
check('T1A.21 Finish Training (results go to QA)', f[0] == 200, (f[0], f[2]))
a = get(aid)
check('T1A.22 Pending QA Confirmation', a['status'] == 'PENDING_QA_CONFIRMATION', a['status'])
shot_tabs(b, aid, 'T1A-09', 'Pending_QA', 'T1-A: chờ QA xác nhận')
code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/confirm-completion', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
check('T1A.23 the organizer cannot confirm (segregation of duties)', code >= 400 and ('SEGREGATION' in t or 'SEPARATION_OF_DUTIES' in t), (code, t))
c = confirm_completion(aid)
check('T1A.24 QA confirms: Completed', c[0] == 200 and get(aid)['status'] == 'COMPLETED', (c[0], c[2]))
shot_tabs(b, aid, 'T1A-10', 'Completed', 'T1-A: Completed', ('General Information', 'Signatures'))

step('T1A.9 make-up (suffix a) for the person who could not read')
code, d, t = supplementary(aid, [pid['uat31.s1.pass1']], 'RUN24 not eligible: passed')
check('T1A.25 a person who passed cannot be given a make-up', code >= 400, (code, t))
code, d, t = supplementary(aid, [pid['uat31.s1.absent']], 'RUN24 make-up for the person who could not read')
check('T1A.26 make-up created with the number of the parent and a letter', code == 200 and d['trainingNumber'].startswith(get(aid)['trainingNumber']) and d['trainingNumber'] != get(aid)['trainingNumber'], (code, t))
child = d['id']
S['child'] = child
c0 = get(child)
print('child:', c0['trainingNumber'], c0['status'], 'sessions', [(s['method'], s['assessmentMethod']) for s in c0['sessions']], 'people', [p['fullName'] for p in c0['participants']], 'rules', c0['contentRules'])
shot_tabs(b, child, 'T1A-11', 'Makeup_created', f"T1-A: bổ sung {c0['trainingNumber']} cho người không đọc được")

step('T1A.10 the make-up goes through the same course and is completed')
aid2 = child
sid2 = c0['sessions'][0]['id']
pid2 = {u: p['id'] for p in c0['participants'] for u in ('uat31.s1.absent',) if p['personUserId'] == uid(u)}
check('T1A.27 the make-up has the same session (self-reading) and the person on its list', len(c0['participants']) == 1 and 'uat31.s1.absent' in pid2, pid2)
a2 = get(aid2)
print('child caps:', {k: v for k, v in a2['capabilities'].items() if v is True})
for call, label in ((lambda: confirm_list(aid2), 'confirm list'), (lambda: approvals(aid2), 'approvals'), (lambda: notify(aid2), 'notify'), (lambda: prepare(aid2), 'prepare')):
    try:
        call()
    except SystemExit as e:
        check('T1A.28 make-up: ' + label, False, str(e)[:300])
        break
code, d, t = start(aid2)
check('T1A.29 the make-up starts', code == 200 and d.get('status') == 'IN_PROGRESS', (code, t))
shot_tabs(b, aid2, 'T1A-12', 'Makeup_in_progress', 'T1-A: bổ sung đang In Progress', ('General Information', 'Participants'))
code, d, t = read('uat31.s1.absent', pid2['uat31.s1.absent'])
check('T1A.30 the person reads and signs', code == 200, (code, t))
code, d, t = head_verifies(aid2, HEAD_QC)
check('T1A.31 the head confirms', code == 200, (code, t))
f = finish_training(aid2)
check('T1A.32 Finish Training', f[0] == 200, (f[0], f[2]))
c = confirm_completion(aid2)
check('T1A.33 QA confirms the make-up: Completed', c[0] == 200 and get(aid2)['status'] == 'COMPLETED', (c[0], c[2]))
shot_tabs(b, aid2, 'T1A-13', 'Makeup_completed', 'T1-A: bổ sung đã Completed', ('General Information', 'Participants'))
rec = sql(f"select count(*) from training_records where person_user_id='{uid('uat31.s1.absent')}' and activity_id='{aid2}'")
check('T1A.34 the make-up wrote the training record of the person', rec and int(rec[0][0]) >= 1, rec)
save(S)
lib31.finish('T1A', b)
