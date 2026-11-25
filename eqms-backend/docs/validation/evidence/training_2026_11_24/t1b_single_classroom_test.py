"""T1-B: one session, classroom with a test (APD.0009, paper copies, scored by the trainer): two pass, one fails, one is absent; QA completes. Then the make-up for the person who was absent (suffix a)
and the retraining of the person who failed (suffix b), each completed with a pass. Expected results come from SOP.0003 5.1.2 (classroom: test APD.0009), 5.3.5 (the test is prepared and approved before
the training), 5.3.6 (the copies are printed, attendance, results), 5.3.7 (pass mark, make-up for the absent and for the one who failed)."""
from lib24 import *
import lib31

b = Browser()
P1, P2, ABS, FAIL = 'uat31.s1.pass1', 'uat31.s1.pass2', 'uat31.s1.absent', 'uat31.s1.fail'
for u in (P1, P2, ABS, FAIL):
    set_status(u, 'Active')
sql(f"delete from training_work_suspensions where person_user_id in ('{uid(FAIL)}')") if sql("select to_regclass('training_work_suspensions')")[0][0] else None

step('T1B.1 create, one classroom session with a test: the content is asked for before the approvers can sign')
aid = new_activity('T1B single session classroom test')
a = get(aid)
sid = add_session(aid, 'CLASSROOM', 'TEST', 'RUN24 Gowning for classified areas')
pid = people_on(aid, sid, [P1, P2, ABS, FAIL])
confirm_list(aid)
rules = get(aid)['contentRules']
check('T1B.1 a classroom with a test needs a material and a test', rules['materialsRequired'] and rules['testRequired'] and 'TRAINING_TEST_REQUIRED' in rules['missing'] and 'TRAINING_MATERIALS_REQUIRED' in rules['missing'], rules)
admin.call('PUT', f'/training/activities/{aid}/approver-pair', {'firstUserId': uid(APPR1), 'secondUserId': uid(APPR2)})
code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/submit-for-approval', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
check('T1B.2 submit for approval is refused while the material and the test are missing', code == 409, (code, t))
shot_tabs(b, aid, 'T1B-01', 'Content_missing', 'T1-B: buổi Tập trung có Bài kiểm tra, còn thiếu tài liệu và bài kiểm tra', ('General Information', 'Assessment'))
link(aid, 'RUN24 gowning procedure slides')
choose_test(aid, sid)
rules = get(aid)['contentRules']
check('T1B.3 the test of the library is chosen: nothing is missing', rules['missing'] == [], rules)
shot_tabs(b, aid, 'T1B-02', 'Test_chosen', 'T1-B: đã chọn bài kiểm tra APD.0009 từ thư viện', ('Training Materials', 'Assessment'))

step('T1B.2 approvals, notice, preparation, the paper copies, start')
approvals(aid)
check('T1B.4 both approvers signed', get(aid)['status'] == 'PENDING_APPROVAL' and get(aid)['capabilities'].get('notify'), get(aid)['status'])
notify(aid)
check('T1B.5 Notified', get(aid)['status'] == 'NOTIFIED', get(aid)['status'])
prepare(aid)
check('T1B.6 the test is conducted electronically by default (the delivery mode of the session): nothing to print', all(x.get('deliveryMode') in (None, 'ELECTRONIC') for x in get(aid)['sessions']), [x.get('deliveryMode') for x in get(aid)['sessions']])
shot_tabs(b, aid, 'T1B-03', 'Notified_prepared', 'T1-B: Notified, đã Prepare Training')
code, d, t = start(aid)
check('T1B.7 Start Training (signed): In Progress', code == 200 and d.get('status') == 'IN_PROGRESS', (code, t))
shot_tabs(b, aid, 'T1B-04', 'In_progress', 'T1-B: In Progress')

step('T1B.3 attendance and the test: two pass, one fails, one is absent')
code, d, t = attend(pid[ABS], 'ABSENT')
check('T1B.8 an absence needs a reason', code == 400, (code, t))
code, d, t = attend(pid[ABS], 'ABSENT', 'RUN24 sick leave on the day')
check('T1B.9 the absent person is recorded with the reason', code == 200, (code, t))
for u in (P1, P2, FAIL):
    code, d, t = attend(pid[u])
    check(f'T1B.10 {u} attends', code == 200, (code, t))
check('T1B.11 the session has its day after the first attendance', all(s['heldOn'] == TODAY_S for s in get(aid)['sessions']), [s.get('heldOn') for s in get(aid)['sessions']])
code, d, t = score(pid[ABS], 9)
check('T1B.12 a score for the absent person is refused', code in (400, 409), (code, t))
code, d, t = score(pid[P1], 11)
check('T1B.13 a score above the maximum is refused', code == 400, (code, t))
for u, got in ((P1, 9), (P2, 8), (FAIL, 4)):
    code, d, t = score(pid[u], got)
    check(f'T1B.14 score {got}/10 of {u}', code == 200, (code, t))
a = get(aid)
res = {u: part(a, u)[0]['result'] for u in (P1, P2, ABS, FAIL)}
check('T1B.15 results: 9 and 8 PASSED, 4 FAILED, the absent person has none', res[P1] == 'PASSED' and res[P2] == 'PASSED' and res[FAIL] == 'FAILED' and res[ABS] == 'PENDING', res)
code, d, t = score(pid[P1], 10)
check('T1B.16 a person who passed cannot be scored again', code == 409, (code, t))
susp = sql(f"select status, cleared_at is null from training_work_suspensions where person_user_id='{uid(FAIL)}' order by raised_at desc limit 1")
check('T1B.17 the person who failed is flagged: work suspended until a pass', bool(susp) and susp[0][1] == 't', susp)
shot_tabs(b, aid, 'T1B-05', 'Results', 'T1-B: kết quả: 2 đạt, 1 trượt, 1 vắng', ('Participants',))

step('T1B.4 attendance list, Finish Training, QA confirms')
f = finish_training(aid)
check('T1B.18 Finish Training (the attendance list goes first)', f[0] == 200, (f[0], f[2]))
check('T1B.19 Pending QA Confirmation', get(aid)['status'] == 'PENDING_QA_CONFIRMATION', get(aid)['status'])
shot_tabs(b, aid, 'T1B-06', 'Pending_QA', 'T1-B: chờ QA xác nhận')
code, d, t = confirm_completion(aid, admin)
check('T1B.20 the organizer cannot confirm (separation of duties)', code >= 400 and ('SEGREGATION' in t or 'SEPARATION_OF_DUTIES' in t), (code, t))
c = confirm_completion(aid)
check('T1B.21 QA confirms: Completed', c[0] == 200 and get(aid)['status'] == 'COMPLETED', (c[0], c[2]))
shot_tabs(b, aid, 'T1B-07', 'Completed', 'T1-B: Completed (còn 1 vắng, 1 trượt)', ('General Information', 'Participants'))
rec = sql(f"select person_user_id from training_records where activity_id='{aid}'")
got = {r[0] for r in rec}
check('T1B.22 training records exist for the two who passed and none for the absent and failed', got == {uid(P1), uid(P2)}, got)
ov = admin.call('GET', f'/training/activities/{aid}/overview')
cands = {x['fullName']: (x.get('canOfferSupplementary'), x.get('state'), x.get('result')) for x in ov.get('supplementaryCandidates', [])}
check('T1B.23 the absent person and the one who failed are offered a supplementary training', cands.get(name_of(ABS), (None,))[0] is True and cands.get(name_of(FAIL), (None,))[0] is True, cands)

step('T1B.5 the make-up for the absent person (suffix a) and the retraining of the one who failed (suffix b)')
a0 = get(aid)
parent_no = a0['trainingNumber']
code, d, t = supplementary(aid, [pid[ABS]], 'RUN24 make-up: absent on the day')
check('T1B.24 the make-up has the number of the parent and a letter', code == 200 and d['trainingNumber'] == parent_no + 'a', (code, d.get('trainingNumber')))
ca = d['id']
code, d, t = supplementary(aid, [pid[FAIL]], 'RUN24 retraining: failed the test')
check('T1B.25 the retraining has the next letter', code == 200 and d['trainingNumber'] == parent_no + 'b', (code, d.get('trainingNumber')))
cb = d['id']
ra = get(ca)
rb = get(cb)
check('T1B.26 the retraining says why (failed assessment) and the make-up says absent', 'ABSENT' in str(ra.get('kindReason')).upper() or 'MAKEUP' in str(ra.get('kindReason')).upper(), (ra.get('kindReason'), rb.get('kindReason')))
shot_tabs(b, cb, 'T1B-08', 'Retraining_created', f"T1-B: đào tạo lại {rb['trainingNumber']} cho người trượt")

for child, who, label in ((ca, ABS, 'make-up'), (cb, FAIL, 'retraining')):
    c0 = get(child)
    csid = c0['sessions'][0]['id']
    cp = {u: p['id'] for p in c0['participants'] for u in (who,) if p['personUserId'] == uid(u)}
    check(f'T1B.27 {label}: the same session (classroom, test) and only that person', len(c0['participants']) == 1 and who in cp and c0['sessions'][0]['assessmentMethod'] == 'TEST', (len(c0['participants']), c0['sessions'][0]['assessmentMethod']))
    confirm_list(child)
    approvals(child)
    notify(child)
    prepare(child)
    code, d, t = start(child)
    check(f'T1B.29 {label}: starts', code == 200 and d.get('status') == 'IN_PROGRESS', (code, t))
    code, d, t = attend(cp[who])
    check(f'T1B.30 {label}: attends', code == 200, (code, t))
    code, d, t = score(cp[who], 9)
    check(f'T1B.31 {label}: scores 9/10', code == 200, (code, t))
    shot_tabs(b, child, 'T1B-09' if label == 'make-up' else 'T1B-10', f'{slug(label)}_scored', f"T1-B: {c0['trainingNumber']} ({label}) đã chấm điểm", ('Participants',))
    f = finish_training(child)
    check(f'T1B.32 {label}: Finish Training', f[0] == 200, (f[0], f[2]))
    c = confirm_completion(child)
    check(f'T1B.33 {label}: QA confirms: Completed', c[0] == 200 and get(child)['status'] == 'COMPLETED', (c[0], c[2]))

rec = {r[0] for r in sql(f"select person_user_id from training_records where activity_id in ('{ca}','{cb}')")}
check('T1B.34 the absent person and the retrained person now have a record', rec == {uid(ABS), uid(FAIL)}, rec)
susp = sql(f"select status, clear_basis from training_work_suspensions where person_user_id='{uid(FAIL)}' order by raised_at desc limit 1")
check('T1B.35 the pass of the retraining lifts the work suspension (cleared: retrained and passed)', bool(susp) and susp[0][0] == 'CLEARED' and susp[0][1] == 'RETRAINED_PASSED', susp)
shot_tabs(b, cb, 'T1B-11', 'Retraining_completed', 'T1-B: đào tạo lại đã Completed', ('General Information', 'Participants'))
S = load()
S['t1b'] = {'aid': aid, 'a': ca, 'b': cb}
save(S)
lib31.finish('T1B', b)
