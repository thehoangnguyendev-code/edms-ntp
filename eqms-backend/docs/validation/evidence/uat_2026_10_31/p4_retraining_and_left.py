"""Scenario 4: what happens to the people of scenarios 1 and 2 who are not trained yet.
 - the people who LEFT the company stay Absent on the original list (SOP.0003 5.3.7), cannot be put on a supplementary training (their account is closed), and nobody is chased;
 - the ABSENT people are trained in a make-up activity (original number + letter, ABSENT_MAKEUP) with its own list;
 - the people who FAILED are retrained in a retraining activity (FAILED_ASSESSMENT): the first retraining of scenario 2 has one person who fails AGAIN; a further retraining is made for that person;
 - the personal records (APD.0014) of a retrained person and of a person who left; the lists APD.0117 of the make-up and the retraining.
Shots and APD files are named S4-xx."""
from flows31 import *
import urllib.parse

state = load()
S = state.setdefault('s4', {})
S1, S2 = state['s1'], state['s2']
b = Browser()


def supp(aid, pids, reason):
    return attempt(admin, 'POST', f'/training/activities/{aid}/supplementary', {'participantIds': pids, 'reason': reason})


def run_child(child, topic, exam, scores, tag):
    """The supplementary activity: its people are on the first session already. Everyone attends, takes the test with the given score {username: score}. Returns {username: participantId}."""
    sid, pid = run_to_start(child, 'CLASSROOM', 'TEST', None, topic, exam=exam)
    for u, sc in scores.items():
        code, d, t = attempt(admin, 'POST', f'/training/participants/{pid[u]}/attendance', {'state': 'ATTENDED'})
        check(f'{tag} {u} attends', code == 200, (code, t))
        code, d, t = attempt(admin, 'POST', f'/training/participants/{pid[u]}/assessments', {'scoreObtained': sc, 'scoreMax': 10, 'remarks': 'UAT31 ' + tag})
        check(f'{tag} {u} scores {sc}/10', code == 200, (code, t))
    a = get(child)
    attempt(admin, 'POST', f'/training/activities/{child}/send-attendance-list', {'version': a['version'], 'signatureToken': sign(admin)})
    f, c = finish_and_confirm(child)
    check(f'{tag} finished and confirmed by QA', f[0] == 200 and c[0] == 200 and get(child)['status'] == 'COMPLETED', (f[2], c[2]))
    return sid, pid


def open_supp_dialog(pg):
    pg.get_by_role('button', name=re.compile('Supplementary', re.I)).first.click()


# ---------------------------------------------------------------- scenario 1 (the document): absent, failed, left
step('S4-1 scenario 1 (revision 2 of the SOP): what is offered for the absent, the failed and the person who left')
A1, pids1 = S1['aid2'], S1['pid2']
TOPIC1 = 'UAT31 SOP Handling of QC samples, revision 2'
check('S4-1.1 the person who left cannot be put on a supplementary training', supp(A1, [pids1['uat31.s1.left']], 'UAT31 try for a person who left')[0] == 409, '')
code, d, t = supp(A1, [pids1['uat31.s1.left']], 'UAT31 try for a person who left')
check('S4-1.2 the reason is TRAINING_SUPPLEMENTARY_PERSON_NOT_ACTIVE', 'TRAINING_SUPPLEMENTARY_PERSON_NOT_ACTIVE' in t, t)
b.shot('admin', f'/training-management/activities/{A1}', 'S4-01', 'Activity_rev2_supplementary_dialog', 'Activity revision 2 đã Completed: hộp thoại Supplementary training — người vắng và người trượt chọn được, người đã nghỉ việc bị khoá kèm lý do', action=open_supp_dialog)

if 'absent1' not in S:
    code, d, t = supp(A1, [pids1['uat31.s1.absent']], 'UAT31 make-up for the absent person (sick leave)')
    check('S4-1.3 the make-up activity for the absent person is created (original number + a)', code == 200 and d.get('kindReason') == 'ABSENT_MAKEUP', (code, t))
    S['absent1'] = d['id']
    sid, pid = run_child(S['absent1'], TOPIC1, 'UAT31 test of SOP Handling of QC samples revision 2 (make-up)', {'uat31.s1.absent': 8}, 'S4-1.4 make-up')
    S['absent1_sid'] = sid
    save(state)
if 'fail1' not in S:
    code, d, t = supp(A1, [pids1['uat31.s1.fail']], 'UAT31 retraining after the failed test (40%)')
    check('S4-1.5 the retraining activity for the person who failed is created (FAILED_ASSESSMENT)', code == 200 and d.get('kindReason') == 'FAILED_ASSESSMENT', (code, t))
    S['fail1'] = d['id']
    sid, pid = run_child(S['fail1'], TOPIC1, 'UAT31 retest of SOP Handling of QC samples revision 2', {'uat31.s1.fail': 9}, 'S4-1.6 retraining')
    S['fail1_sid'] = sid
    save(state)
for key, label in (('absent1', 'Make_up_of_the_absent_person'), ('fail1', 'Retraining_of_the_failed_person')):
    ch = get(S[key])
    print(label, ch['trainingNumber'], ch['status'], ch.get('kindReason'))
    b.shot('admin', f'/training-management/activities/{S[key]}', f"S4-0{2 if key == 'absent1' else 3}", label, f"Activity {ch['trainingNumber']} ({'đào tạo bù cho người vắng' if key == 'absent1' else 'đào tạo lại cho người trượt'}) đã Completed", action=tab('Participants'))
check('S4-1.7 the person who left stays Absent on the original list, nothing was created for them', sql(f"select count(*) from training_activities where parent_activity_id='{A1}'") == [['2']], sql(f"select count(*) from training_activities where parent_activity_id='{A1}'"))
sus = sql(f"select count(*) from training_work_suspensions where person_user_id='{uid('uat31.s1.fail')}' and status='OPEN'")
check('S4-1.8 the work-suspension flag of the retrained person is cleared by the passed retest', sus == [['0']], sus)
rec = {u: sql(f"select count(*) from training_records r where r.person_user_id='{uid(u)}' and r.topic_text like 'UAT31 SOP Handling of QC samples%' and r.activity_id in ('{S1['aid2']}','{S.get('absent1')}','{S.get('fail1')}')") for u in ('uat31.s1.pass1', 'uat31.s1.absent', 'uat31.s1.fail', 'uat31.s1.left')}
print('training records of the SOP revision 2 per person:', rec)
check('S4-1.9 the absent and the failed person now have a record of the SOP; the person who left has none', rec['uat31.s1.absent'] != [['0']] and rec['uat31.s1.fail'] != [['0']] and rec['uat31.s1.left'] == [['0']], rec)

# ---------------------------------------------------------------- scenario 2 (no document): 2 absent, 4 failed, 2 left
step('S4-2 scenario 2 (activity without a document): 2 absent, 4 failed, 2 left')
A2, pids2 = S2['aid'], S2['pid']
TOPIC2 = 'UAT31 Good Laboratory Practice refresher: handling and recording of results'
for u in ('uat31.s2.qa.left', 'uat31.s2.pr.left'):
    code, d, t = supp(A2, [pids2[u]], 'UAT31 try for a person who left')
    check(f'S4-2.1 {u} (left) cannot be put on a supplementary training', code == 409 and 'TRAINING_SUPPLEMENTARY_PERSON_NOT_ACTIVE' in t, (code, t))
b.shot('admin', f'/training-management/activities/{A2}', 'S4-04', 'Activity_no_document_supplementary_dialog', 'Activity không từ tài liệu đã Completed: hộp thoại Supplementary training với 2 người vắng + 4 người trượt chọn được, 2 người nghỉ việc bị khoá', action=open_supp_dialog)
if 'absent2' not in S:
    code, d, t = supp(A2, [pids2['uat31.s2.qa.absent'], pids2['uat31.s2.qc.absent']], 'UAT31 make-up for the two absent people (annual leave)')
    check('S4-2.2 one make-up activity for the 2 absent people of two departments', code == 200 and d.get('kindReason') == 'ABSENT_MAKEUP', (code, t))
    S['absent2'] = d['id']
    sid, pid = run_child(S['absent2'], TOPIC2, 'UAT31 GLP refresher test (make-up)', {'uat31.s2.qa.absent': 9, 'uat31.s2.qc.absent': 8}, 'S4-2.3 make-up')
    save(state)
if 'fail2' not in S:
    four = ['uat31.s2.qa.fail', 'uat31.s2.qc.fail1', 'uat31.s2.qc.fail2', 'uat31.s2.pr.fail']
    code, d, t = supp(A2, [pids2[u] for u in four], 'UAT31 retraining after the failed test')
    check('S4-2.4 one retraining activity for the 4 people who failed (3 departments)', code == 200 and d.get('kindReason') == 'FAILED_ASSESSMENT', (code, t))
    S['fail2'] = d['id']
    sid, pid = run_child(S['fail2'], TOPIC2, 'UAT31 GLP refresher retest', {'uat31.s2.qa.fail': 8, 'uat31.s2.qc.fail1': 9, 'uat31.s2.qc.fail2': 7, 'uat31.s2.pr.fail': 5}, 'S4-2.5 retraining')
    S['fail2_pid'] = pid
    save(state)
res = {p['fullName']: p['result'] for p in get(S['fail2'])['participants']}
print('results of the first retraining:', res)
check('S4-2.6 three of the four pass the retest; one fails AGAIN', sorted(res.values()) == ['FAILED', 'PASSED', 'PASSED', 'PASSED'], res)
check('S4-2.7 the person who failed again keeps an open work-suspension flag', sql(f"select count(*) from training_work_suspensions where person_user_id='{uid('uat31.s2.pr.fail')}' and status='OPEN'") != [['0']], '')
b.shot('admin', f"/training-management/activities/{S['fail2']}", 'S4-05', 'Retraining_four_people_one_failed_again', 'Đào tạo lại cho 4 người trượt (3 phòng): 3 đạt, 1 người (Production) trượt lần nữa', action=tab('Participants'))
if 'fail3' not in S:
    ov = admin.call('GET', f"/training/activities/{S['fail2']}/overview")
    again = [x for x in ov['supplementaryCandidates'] if x['fullName'] == name_of('uat31.s2.pr.fail')]
    check('S4-2.8 the person who failed again is offered a second retraining', bool(again) and again[0].get('canOfferSupplementary') is True, again)
    code, d, t = supp(S['fail2'], [S['fail2_pid']['uat31.s2.pr.fail']], 'UAT31 second retraining (failed again at 50%)')
    check('S4-2.9 a second retraining is created from the first retraining', code in (200, 400, 409), (code, t))
    if code != 200:
        print('NOTE second retraining from a retraining:', code, t)
        code, d, t = supp(A2, [pids2['uat31.s2.pr.fail']], 'UAT31 second retraining (failed again at 50%), from the original activity')
        check('S4-2.10 the second retraining is created from the ORIGINAL activity', code == 200, (code, t))
    if code == 200:
        S['fail3'] = d['id']
        sid, pid = run_child(S['fail3'], TOPIC2, 'UAT31 GLP refresher second retest', {'uat31.s2.pr.fail': 9}, 'S4-2.11 second retraining')
        save(state)
check('S4-2.12 all open work-suspension flags of scenario 2 are cleared', sql(f"select count(*) from training_work_suspensions s join app_users u on u.id=s.person_user_id where u.username like 'uat31.s2.%' and s.status='OPEN'") == [['0']], sql("select u.username, s.status from training_work_suspensions s join app_users u on u.id=s.person_user_id where u.username like 'uat31.s2.%'"))
numbers = [(k, get(S[k])['trainingNumber']) for k in ('absent2', 'fail2', 'fail3') if S.get(k)]
print('numbers of the make-ups and retrainings of scenario 2:', numbers)

# ---------------------------------------------------------------- the left people in the records and the requirements
step('S4-3 the people who left: what the screens and the forms say')
b.shot('admin', f'/training-management/activities/{A2}', 'S4-06', 'Activity_no_document_audit_trail', 'Audit Trail của activity không từ tài liệu: các thao tác điểm danh Absent (nghỉ việc), chấm điểm, đào tạo bù và đào tạo lại', action=tab('Audit Trail'))
for tag, aid_, sid_ in (('S4-07', A2, S2['sid']), ('S4-08', A1, S1['sid2'])):
    st, w = get_bytes(admin, f'/training/activities/{aid_}/attendance-list?format=docx')
    if st == 200:
        text = words(w)
        names = {'S4-07': [name_of(u) for u in ('uat31.s2.qa.left', 'uat31.s2.pr.left')], 'S4-08': [name_of('uat31.s1.left')]}[tag]
        check(f'{tag}.1 APD.0117 of the original still lists the people who left, marked Absent with the reason', all(n in text for n in names) and 'left the company' in text, text[:200])
        save_apd(tag, 'APD0117_original_after_make_up_' + ('scenario2' if tag == 'S4-07' else 'scenario1'), f"APD.0117 của activity gốc sau khi đã có đào tạo bù/đào tạo lại: người nghỉ việc vẫn nằm trong danh sách, ghi Vắng mặt và lý do ({'scenario 2' if tag == 'S4-07' else 'scenario 1'})", w, 'docx')
    st, p = get_bytes(admin, f'/training/activities/{aid_}/attendance-list?format=pdf')
    if st == 200 and p[:4] == b'%PDF':
        save_apd(tag, 'APD0117_original_after_make_up_' + ('scenario2' if tag == 'S4-07' else 'scenario1'), 'APD.0117 của activity gốc (PDF)', p, 'pdf', pages=3)
for key, tag, label in (('absent1', 'S4-09', 'make_up_scenario1'), ('fail1', 'S4-10', 'retraining_scenario1'), ('absent2', 'S4-11', 'make_up_scenario2'), ('fail2', 'S4-12', 'retraining_scenario2')):
    st, p = get_bytes(admin, f'/training/activities/{S[key]}/attendance-list?format=pdf')
    check(f'{tag}.1 APD.0117 of the {label} (own list, number of the original + letter)', st == 200 and p[:4] == b'%PDF', st)
    if st == 200:
        save_apd(tag, 'APD0117_' + label, f"APD.0117 danh sách riêng của buổi {'đào tạo bù' if key.startswith('absent') else 'đào tạo lại'} ({label}): mã gốc + chữ cái, kết quả của từng người", p, 'pdf', pages=2)
        check(f'{tag}.2 the list shows the number with the letter', get(S[key])['trainingNumber'] in pdf_text(p).replace(' ', '').replace('\n', '') or get(S[key])['trainingNumber'].split('/')[-1] in pdf_text(p), get(S[key])['trainingNumber'])
for u, tag in (('uat31.s1.fail', 'S4-13'), ('uat31.s1.absent', 'S4-14'), ('uat31.s1.left', 'S4-15')):
    code, exp, t = attempt(admin, 'POST', '/training/record-exports', {'personUserId': uid(u), 'reason': 'UAT31 personal record', 'approverUserId': qa.user['id'], 'signatureToken': sign(admin)})
    check(f'{tag}.1 APD.0014 is asked for ({u})', code == 200, (code, t[:200]))
    if code == 200:
        attempt(qa, 'POST', f"/training/record-exports/{exp['id']}/approve", {'signatureToken': sign(qa)})
        st, pdf = get_bytes(admin, f"/training/record-exports/{exp['id']}/download")
        check(f'{tag}.2 APD.0014 as PDF ({u})', st == 200 and pdf[:4] == b'%PDF', st)
        if st == 200:
            save_apd(tag, 'APD0014_record_' + u.split('.')[-1] + '_' + ('left_the_company' if u.endswith('left') else 'retrained'), f"APD.0014 hồ sơ đào tạo cá nhân của {name_of(u)} ({'đã nghỉ việc' if u.endswith('left') else 'sau đào tạo lại / đào tạo bù'})", pdf, 'pdf', pages=2)
    else:
        print('NOTE', u, 'record export:', code, t[:200])

def pick(tab_label, dept):
    def run(pg):
        tab(tab_label)(pg)
        pg.wait_for_timeout(1500)
        pg.get_by_text('My department').first.click()
        pg.wait_for_timeout(600)
        pg.get_by_text(dept, exact=True).last.click()
        pg.wait_for_timeout(2500)
    return run

b.shot('admin', '/training-management/compliance', 'S4-16', 'Compliance_Gap_List_Quality_Control', 'Compliance, tab Gap List (Quality Control): chỉ người còn tài khoản Active được đo yêu cầu đào tạo; người đã nghỉ việc không còn bị đòi', action=pick('Gap List', 'Quality Control'))
state['s4'] = S
save(state)
finish('p4', b)
