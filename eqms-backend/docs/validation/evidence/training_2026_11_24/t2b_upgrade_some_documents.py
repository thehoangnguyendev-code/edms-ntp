"""T2-B: Upgrade Revision of only some documents of a SOP cluster. The SOP and form 1 are upgraded (form 2 and the other related documents are not): they share one new Training Number, form 2 is shown
as a related document that did not change. The training is a classroom with a test (APD.0009): two pass, one fails, one is absent; QA completes; make-up and retraining. Then only form 2 is upgraded:
it opens its own activity, not joined to anything, and is trained by self-reading. Expected results: SOP.0003 5.1.2, 5.1.3, 5.1.4, 5.3.5-5.3.7 and DEC-TRAINING-2026-11-24-2."""
from lib24 import *
import lib31

b = Browser()
P1, P2, ABS, FAIL = 'uat31.s1.pass1', 'uat31.s1.pass2', 'uat31.s1.absent', 'uat31.s1.fail'
for u in (P1, P2, ABS, FAIL):
    set_status(u, 'Active')
sql(f"update training_work_suspensions set status='CLEARED', cleared_at=now(), clear_basis='RUN24_RESET' where person_user_id in ('{uid(FAIL)}') and cleared_at is null")
S = load()
T = S['t2a']
assert T.get('published'), 'run T2-A first'


def sources(aid):
    return admin.call('GET', f'/training/activities/{aid}/document-sources')


def roles(aid):
    return {d['documentNumber']: (d['role'], d.get('approved'), d.get('unchanged')) for d in sources(aid)['documents']}


step('T2B.1 the three documents are in force (revision 1); the SOP and form 1 are upgraded, form 2 is not')
for key in ('r_sop', 'r1', 'r2'):
    check(f'T2B.1 {key} is Effective', str(admin.call('GET', f"/revisions/{T[key]}").get('status')).upper() == 'EFFECTIVE', admin.call('GET', f"/revisions/{T[key]}").get('status'))
code, d, t = attempt(admin, 'POST', f"/documents/{T['sop']}/upgrade-revision")
check('T2B.2 Upgrade Revision of the SOP creates revision 2', code == 200 and d.get('id'), (code, t))
r_sop2 = d['id']
code, d, t = attempt(admin, 'POST', f"/documents/{T['f1']}/upgrade-revision")
check('T2B.3 Upgrade Revision of form 1 creates revision 2', code == 200 and d.get('id'), (code, t))
r1_2 = d['id']
rows = [r for r in rows_of_document(T['sopNo']) if r['status'] not in ('COMPLETED', 'CANCELLED')]
check('T2B.4 the SOP has a new activity of its own (a new version), waiting for the approval', len(rows) == 1 and rows[0]['status'] == 'RESERVED', [(r['trainingNumber'], r['status']) for r in rows])
aid = rows[0]['id']
a = get(aid)
check('T2B.5 it is a new version of the SOP', a['kindReason'] == 'SOP_VERSION' and a['trainingNumber'] != T['number'], (a['kindReason'], a['trainingNumber']))
grp = {g['documentNumber'] for g in a['groupRevisions']}
check('T2B.6 form 1 joined the Training Number of the SOP; form 2 did not (it was not upgraded)', grp == {T['sopNo'], T['f1No']}, grp)
ro = roles(aid)
print('sources:', ro)
check('T2B.7 the Training Materials: SOP (main), form 1 (same number), form 2 shown as related and not changed', ro[T['sopNo']][0] == 'MAIN' and ro[T['f1No']][0] == 'GROUP' and ro[T['f2No']][0] == 'RELATED' and ro[T['f2No']][2] is True, ro)
sd = sources(aid)['sessionDefaults']
check('T2B.8 a later version: classroom + test, nobody proposed as trainer (the head of each unit trains)', sd and sd['method'] == 'CLASSROOM' and sd['trainerUserId'] is None, sd)
S['t2b'] = {'aid': aid, 'r_sop2': r_sop2, 'r1_2': r1_2}
save(S)
shot_tabs(b, aid, 'T2B-01', 'Reserved_upgrade', 'T2-B: nâng revision SOP + FRM1 (không nâng FRM2): Reserved, tài liệu: MAIN, cùng mã, liên quan không đổi', ('General Information', 'Training Materials'))

step('T2B.2 both upgraded revisions are approved: the activity opens')
for name, rid in (('SOP rev 2', r_sop2), ('form 1 rev 2', r1_2)):
    bad = approve_revision(rid, 'RUN24 upgrade ' + name, 'RUN24')
    check(f'T2B.9 {name} approved', not bad, bad)
    if name.startswith('SOP'):
        check('T2B.10 after the SOP alone: still Reserved', get(aid)['status'] == 'RESERVED', get(aid)['status'])
a = get(aid)
check('T2B.11 after the last one: Planned', a['status'] == 'PLANNED', a['status'])
shot_tabs(b, aid, 'T2B-02', 'Planned_upgrade', 'T2-B: Planned sau khi cả hai revision được duyệt', ('General Information', 'Training Materials'))

step('T2B.3 classroom + test: planned, approved, started')
sid = add_session(aid, 'CLASSROOM', 'TEST', f"{T['sopNo']} RUN24 SOP Cleaning of classified rooms, revision 2", rid=r_sop2, venue='Training room 1')
pid = people_on(aid, sid, [P1, P2, ABS, FAIL])
choose_test(aid, sid)
check('T2B.12 the documents are the material and the test is chosen: nothing is missing', get(aid)['contentRules']['missing'] == [], get(aid)['contentRules'])
confirm_list(aid)
approvals(aid)
notify(aid)
prepare(aid)
code, d, t = start(aid)
check('T2B.13 Start Training: In Progress', code == 200 and d.get('status') == 'IN_PROGRESS', (code, t))
code, d, t = attend(pid[ABS], 'ABSENT', 'RUN24 on leave')
check('T2B.14 absent with a reason', code == 200, (code, t))
for u in (P1, P2, FAIL):
    attend(pid[u])
for u, got in ((P1, 9), (P2, 8), (FAIL, 4)):
    code, d, t = score(pid[u], got)
    check(f'T2B.15 score {got}/10 of {u}', code == 200, (code, t))
a = get(aid)
res = {u: part(a, u)[0]['result'] for u in (P1, P2, ABS, FAIL)}
check('T2B.16 two PASSED, one FAILED, one without a result', res[P1] == 'PASSED' and res[P2] == 'PASSED' and res[FAIL] == 'FAILED' and res[ABS] == 'PENDING', res)
shot_tabs(b, aid, 'T2B-03', 'Results', 'T2-B: kết quả: 2 đạt, 1 trượt, 1 vắng', ('Participants',))
f = finish_training(aid)
check('T2B.17 Finish Training', f[0] == 200, (f[0], f[2]))
c = confirm_completion(aid)
check('T2B.18 QA confirms: Completed', c[0] == 200 and get(aid)['status'] == 'COMPLETED', (c[0], c[2]))
a = get(aid)
waiting = [g for g in a['groupRevisions'] if g['revisionStatus'] == 'PENDING_TRAINING']
check('T2B.19 only the two upgraded revisions wait for Complete Training', {g['documentNumber'] for g in waiting} == {T['sopNo'], T['f1No']}, [(g['documentNumber'], g['revisionStatus']) for g in a['groupRevisions']])
shot_tabs(b, aid, 'T2B-04', 'Completed', 'T2-B: Completed, hai revision chờ Complete Training', ('General Information',))

step('T2B.4 make-up (absent) and retraining (failed) of the upgraded SOP')
code, d, t = supplementary(aid, [pid[ABS]], 'RUN24 make-up: absent')
check('T2B.20 make-up created (suffix a)', code == 200 and d['trainingNumber'].endswith('a'), (code, t))
ca = d['id']
code, d, t = supplementary(aid, [pid[FAIL]], 'RUN24 retraining: failed')
check('T2B.21 retraining created (suffix b)', code == 200 and d['trainingNumber'].endswith('b'), (code, t))
cb = d['id']
for child, who, label in ((ca, ABS, 'make-up'), (cb, FAIL, 'retraining')):
    c0 = get(child)
    cp = {u: p['id'] for p in c0['participants'] for u in (who,) if p['personUserId'] == uid(u)}
    confirm_list(child)
    approvals(child)
    notify(child)
    prepare(child)
    code, d, t = start(child)
    check(f'T2B.22 {label}: starts', code == 200, (code, t))
    attend(cp[who])
    code, d, t = score(cp[who], 9)
    check(f'T2B.23 {label}: passes 9/10', code == 200, (code, t))
    f = finish_training(child)
    c = confirm_completion(child)
    check(f'T2B.24 {label}: Completed', f[0] == 200 and c[0] == 200 and get(child)['status'] == 'COMPLETED', (f[0], c[0], c[2]))
shot_tabs(b, cb, 'T2B-05', 'Retraining_completed', 'T2-B: đào tạo lại đã Completed', ('General Information',))

step('T2B.5 Complete Training of the two upgraded revisions, then publish; form 2 stays at revision 1')
for g in waiting:
    code, d, t = attempt(admin, 'POST', f"/revisions/{g['revisionId']}/training/complete", {'signatureToken': sign(admin), 'comment': 'RUN24', 'reason': 'RUN24 training completed'})
    check(f"T2B.25 Complete Training of {g['documentNumber']}", code == 200, (code, t))
for name, rid in (('SOP rev 2', r_sop2), ('form 1 rev 2', r1_2)):
    st, problems = publish_revision(rid)
    check(f'T2B.26 {name} published: Effective', str(st).upper() in ('EFFECTIVE', 'ACTIVE') or str(st).upper().startswith('PUBLISH'), (st, problems))
check('T2B.27 revision 1 of the SOP is obsolete now, form 2 still revision 1 and Effective', str(admin.call('GET', f"/revisions/{T['r2']}").get('status')).upper() == 'EFFECTIVE', admin.call('GET', f"/revisions/{T['r2']}").get('status'))

step('T2B.6 only form 2 is upgraded: its own activity, not joined to the SOP; trained by self-reading')
code, d, t = attempt(admin, 'POST', f"/documents/{T['f2']}/upgrade-revision")
check('T2B.28 Upgrade Revision of form 2', code == 200 and d.get('id'), (code, t))
r2_2 = d['id']
rows = [r for r in rows_of_document(T['f2No']) if r['status'] not in ('COMPLETED', 'CANCELLED')]
check('T2B.29 form 2 has an activity of its own, with its own number', len(rows) == 1 and rows[0]['trainingNumber'] not in (T['number'], get(aid)['trainingNumber']), [(r['trainingNumber'], r['status']) for r in rows])
aid2 = rows[0]['id']
a2 = get(aid2)
check('T2B.30 its group is form 2 alone', [g['documentNumber'] for g in a2['groupRevisions']] == [T['f2No']], [g['documentNumber'] for g in a2['groupRevisions']])
ro = roles(aid2)
print('sources of form 2:', ro)
check('T2B.31 its Training Materials are form 2 only (it lists nothing as related)', list(ro) == [T['f2No']] and ro[T['f2No']][0] == 'MAIN', ro)
bad = approve_revision(r2_2, 'RUN24 upgrade form 2', 'RUN24')
check('T2B.32 form 2 rev 2 approved: Planned', not bad and get(aid2)['status'] == 'PLANNED', (bad, get(aid2)['status']))
shot_tabs(b, aid2, 'T2B-06', 'Form2_own_activity', 'T2-B: chỉ nâng FRM2: activity riêng, tài liệu chỉ có FRM2', ('General Information', 'Training Materials'))
sid2 = add_session(aid2, 'SELF_READING', 'SELF_READING_CONFIRMATION', f"{T['f2No']} RUN24 form 2, revision 2", rid=r2_2, venue='Own workstation')
pid2 = people_on(aid2, sid2, [P1, P2])
confirm_list(aid2)
approvals(aid2)
notify(aid2)
prepare(aid2)
code, d, t = start(aid2)
check('T2B.33 Start Training', code == 200, (code, t))
for u in (P1, P2):
    read(u, pid2[u])
code, d, t = head_verifies(aid2, HEAD_QC)
check('T2B.34 the head confirms the self-reading', code == 200, (code, t))
f = finish_training(aid2)
c = confirm_completion(aid2)
check('T2B.35 Completed', f[0] == 200 and c[0] == 200 and get(aid2)['status'] == 'COMPLETED', (f[0], c[0], c[2]))
code, d, t = attempt(admin, 'POST', f"/revisions/{r2_2}/training/complete", {'signatureToken': sign(admin), 'comment': 'RUN24', 'reason': 'RUN24'})
check('T2B.36 Complete Training of form 2', code == 200, (code, t))
st, problems = publish_revision(r2_2)
check('T2B.37 form 2 revision 2 Effective', str(st).upper() in ('EFFECTIVE', 'ACTIVE') or str(st).upper().startswith('PUBLISH'), (st, problems))
shot_tabs(b, aid2, 'T2B-07', 'Form2_completed', 'T2-B: FRM2 đã Completed và Effective', ('General Information',))
S['t2b'].update({'aid2': aid2, 'done': True})
save(S)
lib31.finish('T2B', b)
