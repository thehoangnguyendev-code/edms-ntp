"""Scenario 4, regression of the defect found in the run of scenario 4: a person who fails the original test, fails the FIRST retraining and passes the SECOND one kept an OPEN work-suspension flag (the one raised by the first
retraining), because clearOnPass cleared only the flag of the original activity. Fixed in TrainingSuspensionService.clearOnPass (every flag of the family of the original activity ends). This script repeats the case with a new person
(three small activities) and also ends the flag that the buggy run left on Phan Thi Quyen (through the head's way: reason + e-signature)."""
from flows31 import *

state = load()
S = state.setdefault('s4b', {})
P = 'uat31.s2.qa.pass'
person = uid(P)
TOPIC = 'UAT31 regression: a flag after two retrainings'


def one(parent, score, tag):
    if parent:
        a = admin.call('GET', f'/training/activities/{S["root"]}')
        code, d, t = attempt(admin, 'POST', f'/training/activities/{S["root"]}/supplementary', {'participantIds': [S['pid_root']], 'reason': 'UAT31 ' + tag})
        aid = d['id']
        sid, pid = run_to_start(aid, 'CLASSROOM', 'TEST', None, TOPIC, exam='UAT31 regression test')
        pid = pid[P]
    else:
        a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'dueDate': (TODAY + datetime.timedelta(days=30)).isoformat()})
        aid = a['id']
        sid, pid = run_to_start(aid, 'CLASSROOM', 'TEST', [P], TOPIC, exam='UAT31 regression test')
        pid = pid[P]
    attempt(admin, 'POST', f'/training/participants/{pid}/attendance', {'state': 'ATTENDED'})
    code, d, t = attempt(admin, 'POST', f'/training/participants/{pid}/assessments', {'scoreObtained': score, 'scoreMax': 10, 'remarks': 'UAT31 ' + tag})
    check(f'{tag} score {score}/10', code == 200, (code, t))
    a = get(aid)
    attempt(admin, 'POST', f'/training/activities/{aid}/send-attendance-list', {'version': a['version'], 'signatureToken': sign(admin)})
    f, c = finish_and_confirm(aid)
    check(f'{tag} finished and confirmed', f[0] == 200 and c[0] == 200, (f[2], c[2]))
    return aid, pid


def open_flags():
    return int(sql(f"select count(*) from training_work_suspensions where person_user_id='{person}' and status='OPEN'")[0][0])


if 'root' not in S:
    S['root'], S['pid_root'] = one(None, 4, 'original: fails')
    check('R.1 the failed original raises one flag', open_flags() == 1, open_flags())
    S['re1'], pid1 = one(S['root'], 5, 'first retraining: fails again')
    check('R.2 the failed first retraining raises a flag too', open_flags() == 2, open_flags())
    S['re2'], pid2 = one(S['root'], 9, 'second retraining: passes')
    save(state)
check('R.3 after the second retraining is passed NO flag is left open (the defect: one stayed OPEN)', open_flags() == 0, sql(f"select status, count(*) from training_work_suspensions where person_user_id='{person}' group by 1"))

step('the flag that the buggy run left on Phan Thi Quyen is ended the proper way (head: reason + e-signature)')
rows = sql(f"select s.id from training_work_suspensions s where s.person_user_id='{uid('uat31.s2.pr.fail')}' and s.status='OPEN'")
for (sid_,) in rows:
    code, d, t = attempt(admin, 'POST', f'/training/compliance/suspensions/{sid_}/resume', {'reason': 'UAT31 the person passed the second retraining (TRN/QA/26-942c); the flag of the first retraining was left open by a defect of the system that was fixed', 'signatureToken': sign(admin)})
    check('R.4 the stuck flag is resumed with a reason and an e-signature', code == 200, (code, t))
check('R.5 Phan Thi Quyen has no open flag', sql(f"select count(*) from training_work_suspensions where person_user_id='{uid('uat31.s2.pr.fail')}' and status='OPEN'") == [['0']], '')
state['s4b'] = S
save(state)
finish('p4b')
