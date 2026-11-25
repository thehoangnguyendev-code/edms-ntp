"""T1-C: one Training Number, three sessions (the initial training of SOP.0003 5.1.1: three parts), each with its own method, test, material and people: S1 classroom + test on paper, S2 self-reading,
S3 classroom + test (electronic). The same three people attend every session (SOP 4.2); one is absent from S1 and cannot read S2, one fails S1 and passes S3. The activity is complete when every
session is (per-session content), QA completes it, and the make-up / retraining are offered per person. Expected results come from SOP.0003 4.2, 5.1.1, 5.1.2, 5.1.4, 5.3.5-5.3.7."""
from lib24 import *
import lib31

b = Browser()
A, B, C = 'uat31.s2.qa.pass', 'uat31.s2.qa.fail', 'uat31.s2.qa.absent'
for u in (A, B, C):
    set_status(u, 'Active')

step('T1C.1 three sessions under one Training Number, each with its own topic and method')
aid = new_activity('T1C three sessions initial training', kind='INITIAL', reason='NEW_HIRE')
a = get(aid)
check('T1C.1 an initial training is created Planned with one Training Number', a['status'] == 'PLANNED' and a['kind'] == 'INITIAL', (a['status'], a['kind']))
s1 = add_session(aid, 'CLASSROOM', 'TEST', 'RUN24 S1 Occupational safety and company policy', venue='Training room 1')
s2 = add_session(aid, 'SELF_READING', 'SELF_READING_CONFIRMATION', 'RUN24 S2 Company rules (read)', venue='Own workstation')
s3 = add_session(aid, 'CLASSROOM', 'TEST', 'RUN24 S3 Principles of GMP', venue='Training room 2')
a = get(aid)
check('T1C.2 three sessions with their own methods', [(s['sessionNo'], s['method']) for s in a['sessions']] == [(1, 'CLASSROOM'), (2, 'SELF_READING'), (3, 'CLASSROOM')], [(s['sessionNo'], s['method']) for s in a['sessions']])
shot_tabs(b, aid, 'T1C-01', 'Three_sessions', 'T1-C: một mã đào tạo, ba buổi (Tập trung + Kiểm tra, Tự đọc, Tập trung + Kiểm tra)')

step('T1C.2 the same three people on every session; the content of each session is asked for on its own')
pa = {}
for sid_, tag in ((s1, 's1'), (s2, 's2'), (s3, 's3')):
    pa[tag] = people_on(aid, sid_, [A, B, C])
check('T1C.3 the same people are on the three sessions (SOP 4.2: the same group may attend every session)', all(len(pa[t]) == 3 for t in pa), {t: len(pa[t]) for t in pa})
confirm_list(aid)
admin.call('PUT', f'/training/activities/{aid}/approver-pair', {'firstUserId': uid(APPR1), 'secondUserId': uid(APPR2)})
link(aid, 'RUN24 shared reading for every session')
choose_test(aid, s1)
rules = get(aid)['contentRules']
check('T1C.4 S3 still has no test: the activity is not complete', 'TRAINING_TEST_REQUIRED' in rules['missing'], rules)
code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/submit-for-approval', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
check('T1C.5 submit for approval is refused while S3 has no test', code == 409, (code, t))
shot_tabs(b, aid, 'T1C-02', 'S3_without_test', 'T1-C: buổi 3 chưa có bài kiểm tra: chưa thể gửi duyệt', ('Assessment',))
choose_test(aid, s3)
check('T1C.6 each session with a test has its own: nothing is missing', get(aid)['contentRules']['missing'] == [], get(aid)['contentRules'])
shot_tabs(b, aid, 'T1C-03', 'Content_complete', 'T1-C: mỗi buổi có nội dung riêng, đã đủ', ('Training Materials', 'Assessment'))

step('T1C.3 approvals and notice; S1 on paper: Start Training waits for the printed tests')
set_paper(s1, 'RUN24 the test of S1 is on paper')
approvals(aid)
notify(aid)
prepare(aid)
code, d, t = start(aid)
check('T1C.7 Start Training is refused until the paper tests of S1 are printed', code == 409 and 'TRAINING_TESTS_NOT_PRINTED' in t, (code, t))
shot_tabs(b, aid, 'T1C-04', 'Notified_prepared', 'T1-C: Notified, S1 trên giấy chưa in bài kiểm tra')
print_tests(aid)
code, d, t = start(aid)
check('T1C.8 after printing: Start Training, In Progress', code == 200 and d.get('status') == 'IN_PROGRESS', (code, t))

step('T1C.4 session 1: A attends and passes, B attends and fails, C is absent')
code, d, t = attend(pa['s1'][C], 'ABSENT', 'RUN24 sick leave on the day of session 1')
check('T1C.9 C absent from S1', code == 200, (code, t))
for u in (A, B):
    code, d, t = attend(pa['s1'][u])
    check(f'T1C.10 {u} attends S1', code == 200, (code, t))
check('T1C.11 S1 is held today', [s for s in get(aid)['sessions'] if s['id'] == s1][0]['heldOn'] == TODAY_S, [s.get('heldOn') for s in get(aid)['sessions']])
check('T1C.12 S2 and S3 are not held yet', [s for s in get(aid)['sessions'] if s['id'] in (s2, s3)][0].get('heldOn') is None, [s.get('heldOn') for s in get(aid)['sessions']])
for u, got in ((A, 9), (B, 4)):
    code, d, t = score(pa['s1'][u], got)
    check(f'T1C.13 S1 score {got}/10 of {u}', code == 200, (code, t))
shot_tabs(b, aid, 'T1C-05', 'S1_done', 'T1-C: buổi 1 xong: A đạt, B trượt, C vắng', ('Participants',))

step('T1C.5 session 2 (self-reading): A and B sign, C cannot read; the head confirms')
for u in (A, B):
    code, d, t = read(u, pa['s2'][u])
    check(f'T1C.14 {u} signs the reading of S2', code == 200, (code, t))
code, d, t = cannot_read(pa['s2'][C], 'RUN24 on leave, could not read S2 in time')
check('T1C.15 C cannot read S2: recorded absent', code == 200, (code, t))
code, d, t = head_verifies(aid, HEAD_QA)
check('T1C.16 the head of Quality Assurance confirms the readings of S2', code == 200, (code, t))
a = get(aid)
s2r = {u: [p for p in a['participants'] if p['id'] == pa['s2'][u]][0]['result'] for u in (A, B, C)}
check('T1C.17 S2: A and B PASSED, C has no result', s2r[A] == 'PASSED' and s2r[B] == 'PASSED' and s2r[C] == 'PENDING', s2r)

step('T1C.6 session 3: all three attend (C was absent from S1, B failed S1), scores 8, 9 and 7')
for u in (A, B, C):
    code, d, t = attend(pa['s3'][u])
    check(f'T1C.18 {u} attends S3', code == 200, (code, t))
for u, got in ((A, 8), (B, 9), (C, 7)):
    code, d, t = score(pa['s3'][u], got)
    check(f'T1C.19 S3 score {got}/10 of {u}', code == 200, (code, t))
shot_tabs(b, aid, 'T1C-06', 'All_sessions_done', 'T1-C: cả ba buổi đã có kết quả', ('General Information', 'Participants'))

step('T1C.7 Finish Training, QA confirms; the records are per person and per topic')
f = finish_training(aid)
check('T1C.19b Finish Training is refused while the scans of the paper tests of S1 are missing (the electronic S3 and the self-reading S2 need none)', f[0] == 409 and 'TRAINING_SCANS_PENDING' in f[2], (f[0], f[2]))
for u in (A, B):
    scan_test(aid, pa['s1'][u])
shot_tabs(b, aid, 'T1C-06b', 'S1_scans_in', 'T1-C: đã có bản scan bài kiểm tra giấy của buổi 1', ('Assessment',))
f = finish_training(aid)
check('T1C.20 Finish Training: Pending QA Confirmation', f[0] == 200 and get(aid)['status'] == 'PENDING_QA_CONFIRMATION', (f[0], f[2]))
c = confirm_completion(aid)
check('T1C.21 QA confirms: Completed', c[0] == 200 and get(aid)['status'] == 'COMPLETED', (c[0], c[2]))
shot_tabs(b, aid, 'T1C-07', 'Completed', 'T1-C: Completed', ('General Information', 'Signatures'))
rows = sql(f"select u.username, r.topic_text, r.result from training_records r join app_users u on u.id=r.person_user_id where r.activity_id='{aid}' order by 1,2")
by = {}
for u, topic, res in rows:
    by.setdefault(u, []).append((topic[:26], res))
print('records:', by)
check('T1C.22 A is recorded on three topics (passed S1, read S2, passed S3)', len(by.get(A, [])) == 3, by.get(A))
check('T1C.23 B is recorded on S2 and S3 only (failed S1)', sorted(t[0][:6] for t in by.get(B, [])) == ['RUN24 ', 'RUN24 '] and len(by.get(B, [])) == 2 and not any('S1' in t[0] for t in by.get(B, [])), by.get(B))
check('T1C.24 C is recorded on S3 only (absent S1, could not read S2)', len(by.get(C, [])) == 1 and 'S3' in by[C][0][0], by.get(C))

step('T1C.8 what is left to make up, per person')
ov = admin.call('GET', f'/training/activities/{aid}/overview')
cands = ov.get('supplementaryCandidates', [])
print('candidates:', [(x['fullName'], x.get('state'), x.get('result'), x.get('canOfferSupplementary')) for x in cands])
check('T1C.25 the make-up candidates are B (failed S1) and C (absent S1, could not read S2); A is not', {x['fullName'] for x in cands if x.get('canOfferSupplementary')} >= {name_of(B), name_of(C)} and name_of(A) not in {x['fullName'] for x in cands if x.get('canOfferSupplementary')}, [(x['fullName'], x.get('canOfferSupplementary')) for x in cands])
S = load()
S['t1c'] = {'aid': aid, 's1': s1, 's2': s2, 's3': s3, 'pa': pa}
save(S)
lib31.finish('T1C', b)
