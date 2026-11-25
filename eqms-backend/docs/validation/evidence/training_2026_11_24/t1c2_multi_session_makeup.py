"""T1-C part 2: the make-up of a multi-session training. B failed S1: retraining of S1 only. C was absent from S1 and could not read S2: one make-up of those two sessions. Each is completed.
Expected results: SOP.0003 5.1.4 (suffix letters, one line each in the allocation log), 5.3.7 (make-up for the absent and the failed)."""
from lib24 import *
import lib31

b = Browser()
S = load()
T = S['t1c']
aid, pa = T['aid'], T['pa']
A, B, C = 'uat31.s2.qa.pass', 'uat31.s2.qa.fail', 'uat31.s2.qa.absent'
parent = get(aid)['trainingNumber']

step('T1C2.1 retraining of S1 for B (failed) and a make-up of S1 and S2 for C (absent / could not read)')
code, d, t = supplementary(aid, [pa['s1'][B]], 'RUN24 retraining: failed the test of S1')
check('T1C2.1 retraining created (suffix a)', code == 200 and d['trainingNumber'] == parent + 'a', (code, t))
cb = d['id']
code, d, t = supplementary(aid, [pa['s1'][C], pa['s2'][C]], 'RUN24 make-up: absent S1, could not read S2')
check('T1C2.2 make-up created (suffix b)', code == 200 and d['trainingNumber'] == parent + 'b', (code, t))
cc = d['id']
for child, label in ((cb, 'retraining B'), (cc, 'make-up C')):
    c0 = get(child)
    print(label, c0['trainingNumber'], [(s['sessionNo'], s['method'], s['assessmentMethod'], s.get('deliveryMode')) for s in c0['sessions']], [p['fullName'] for p in c0['participants']])
shot_tabs(b, cc, 'T1C2-01', 'Makeup_C_created', 'T1-C: bổ sung cho C (vắng buổi 1, không đọc được buổi 2)', ('General Information', 'Participants'))
c0 = get(cc)
check('T1C2.3 the make-up of C has a session for S1 (classroom, test) and one for S2 (self-reading)', sorted(s['method'] for s in c0['sessions']) == ['CLASSROOM', 'SELF_READING'], [(s['method']) for s in c0['sessions']])


def run_child(child, who, label, shot_id):
    c0 = get(child)
    sess = {s['method']: s for s in c0['sessions']}
    pids = {(p['sessionId']): p['id'] for p in c0['participants'] if p['personUserId'] == uid(who)}
    confirm_list(child)
    approvals(child)
    notify(child)
    prepare(child)
    try:
        print_tests(child)
    except SystemExit as e:
        check(f'{label}: print', False, str(e)[:200])
    code, d, t = start(child)
    check(f'{label}: Start Training', code == 200, (code, t))
    for s in c0['sessions']:
        pid = pids[s['id']]
        if s['method'] == 'SELF_READING':
            code, d, t = read(who, pid)
            check(f'{label}: reads S2', code == 200, (code, t))
        else:
            code, d, t = attend(pid)
            check(f'{label}: attends S1', code == 200, (code, t))
            code, d, t = score(pid, 9)
            check(f'{label}: scores 9/10', code == 200, (code, t))
            if s.get('deliveryMode') in ('PAPER', 'MIXED'):
                scan_test(child, pid)
    if any(s['method'] == 'SELF_READING' for s in c0['sessions']):
        code, d, t = head_verifies(child, HEAD_QA)
        check(f'{label}: the head confirms the reading', code == 200, (code, t))
    shot_tabs(b, child, shot_id, slug(label) + '_done', f'T1-C: {label} đã có kết quả', ('Participants',))
    f = finish_training(child)
    check(f'{label}: Finish Training', f[0] == 200, (f[0], f[2]))
    c = confirm_completion(child)
    check(f'{label}: QA confirms: Completed', c[0] == 200 and get(child)['status'] == 'COMPLETED', (c[0], c[2]))
    shot_tabs(b, child, shot_id + 'b', slug(label) + '_completed', f'T1-C: {label} Completed', ('General Information',))


run_child(cb, B, 'retraining of B', 'T1C2-02')
run_child(cc, C, 'make-up of C', 'T1C2-03')
rec = [(r[0], r[1][:60]) for r in sql(f"select u.username, r.topic_text from training_records r join app_users u on u.id=r.person_user_id where r.activity_id in ('{cb}','{cc}')")]
print('records of the children:', rec)
check('T1C2.4 B has the record of S1 now; C has the records of S1 and S2', sum(1 for u, _ in rec if u == B) == 1 and sum(1 for u, _ in rec if u == C) == 2, rec)
susp = sql(f"select status from training_work_suspensions where person_user_id='{uid(B)}' order by raised_at desc limit 1")
check('T1C2.5 the pass of the retraining lifts the work suspension of B', bool(susp) and susp[0][0] == 'CLEARED', susp)
lib31.finish('T1C2', b)
