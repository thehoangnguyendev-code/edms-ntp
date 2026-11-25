"""T2-A, second part (re-run after the fix of the null variable in the notification): Complete Training of each revision of the group, then publish the three documents (Effective)."""
from lib24 import *
import lib31

b = Browser()
S = load()
T = S['t2a']
aid = T['aid']
a = get(aid)
print('activity', a['trainingNumber'], a['status'], [(g['documentNumber'], g['revisionStatus']) for g in a['groupRevisions']])
check('T2A.23r the activity is Completed and the group waits for Complete Training', a['status'] == 'COMPLETED', a['status'])
for g in a['groupRevisions']:
    if g['revisionStatus'] != 'PENDING_TRAINING':
        continue
    code, d, t = attempt(admin, 'POST', f"/revisions/{g['revisionId']}/training/complete", {'signatureToken': sign(admin), 'comment': 'RUN24', 'reason': 'RUN24 training completed'})
    check(f"T2A.24 Complete Training of {g['documentNumber']}", code == 200, (code, t))
a = get(aid)
check('T2A.24b the button is gone when all are done', a['capabilities'].get('completeTraining') is False, a['capabilities'].get('completeTraining'))
shot_tabs(b, aid, 'T2A-07b', 'Revisions_completed', 'T2-A: Complete Training của cả ba revision đã xong', ('General Information',))
for name, key in (('SOP', 'r_sop'), ('form 1', 'r1'), ('form 2', 'r2')):
    st, problems = publish_revision(T[key])
    check(f'T2A.25 {name} published: Effective', str(st).upper() in ('EFFECTIVE', 'ACTIVE') or str(st).upper().startswith('PUBLISH'), (st, problems))
b.shot('admin', f"/documents/revisions/{T['r_sop']}", 'T2A-08', 'SOP_effective', 'T2-A: SOP đã Effective')
T['published'] = all(str(admin.call('GET', f"/revisions/{T[k]}").get('status')).upper() == 'EFFECTIVE' for k in ('r_sop', 'r1', 'r2'))
check('T2A.26 the three documents are Effective', T['published'], [admin.call('GET', f"/revisions/{T[k]}").get('status') for k in ('r_sop', 'r1', 'r2')])
S['t2a'] = T
save(S)
lib31.finish('T2A_resume', b)
