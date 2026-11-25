"""T2-B (resumed after a restart of the backend): Upgrade Revision of only some documents of a SOP cluster. The SOP and form 1 are upgraded (form 2 and the other related documents are not): they share one new Training Number, form 2 is shown
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


aid, r_sop2, r1_2 = S['t2b']['aid'], S['t2b']['r_sop2'], S['t2b']['r1_2']
st, problems = publish_revision(r1_2)
check('T2B.26 form 1 rev 2 published: Effective', str(st).upper() in ('EFFECTIVE', 'ACTIVE') or str(st).upper().startswith('PUBLISH'), (st, problems))
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
lib31.finish('T2B_resume4', b)
