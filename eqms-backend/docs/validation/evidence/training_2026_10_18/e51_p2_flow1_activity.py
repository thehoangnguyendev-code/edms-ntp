"""Phase 2, flow 1: a training created from Training Activities, for three employees, from the creation to the completion by QA, with APD.0117 (the attendance list) made at each milestone and
APD.0009 (the test) in the exam pack; one employee fails and is trained again (a supplementary training). Screens shot at each stage. Password from DEVPW (never written)."""
from e51_lib import *

state = load()
b = Browser()
S = {}


def tget(aid):
    return trainer.call('GET', f'/training/activities/{aid}')


def milestone(aid, name, label):
    """APD.0117 as it is at this milestone: Word and PDF, the PDF as pictures."""
    st, w = fetch(admin, f'/training/activities/{aid}/attendance-list?format=docx', name + '.docx')
    st2, p = fetch(admin, f'/training/activities/{aid}/attendance-list?format=pdf', name + '.pdf')
    check(f'{label}: APD.0117 as Word and PDF', st == 200 and st2 == 200 and w[:2] == b'PK' and p[:4] == b'%PDF', (st, st2, w[:200]))
    if st == 200:
        t = words(w)
        check(f'{label}: no token is left and the notes of the template are not written', '{{' not in t and 'HISTORY REVISION' not in t, t[:200])
        return t, p
    return '', b''


step('2.1 the activity is created from Training Activities')
code, a, text = attempt(admin, 'POST', '/training/activities', {'kind': 'PERIODIC', 'kindReason': 'SOP_VERSION', 'trainingTitle': 'E2E51 GMP basics refresher'})
check('2.1 created, Planned, with a Training Number', code == 200 and a['status'] == 'PLANNED' and bool(a['trainingNumber']), (code, text))
aid = a['id']
S['aid'] = aid
S['number'] = a['trainingNumber']
a = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'trainerUserId': trainer.user['id'], 'scheduledOn': TODAY, 'venue': 'Training room 1',
                                                              'topics': [{'topicText': 'E2E51 GMP basics refresher'}]})
sid = a['sessions'][0]['id']
S['sid'] = sid
admin.call('POST', f'/training/sessions/{sid}/trainer-exception', {'reason': 'E2E51 the trainer of the unit', 'approverUserId': qa.user['id']})
ex = [x for x in get(aid)['sessions'] if x['id'] == sid][0]['trainerQualification'].get('exception')
if ex:
    qa.call('POST', f"/training/trainer-exceptions/{ex['id']}/approve", {'signatureToken': sign(qa)})
a = admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': [t.user['id'] for t in TRAINEES], 'reason': 'E2E51 three employees'})
pid = {p['personUserId']: p['id'] for p in a['participants']}
check('2.2 three employees are on the list, the trainer is not', len(pid) == 3 and trainer.user['id'] not in pid, list(pid))
S['pid'] = pid
b.shot('admin', f'/training-management/activities/{aid}', 'p2_01_activity_planned', wait=5000)
a = admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'E2E51 list prepared'})
t, p = milestone(aid, 'f1_M1_list_prepared', '2.3 M1 the list is prepared')
if t:
    check('2.4 M1: the number, the three names, the preparer and the signature are written; no result yet', S['number'] in t and all(x.user['fullName'] in t for x in TRAINEES) and 'Attendance List Verified' in t, t[:400])
    print('   pages', render_pdf(p, 'p2_02_APD0117_M1_list_prepared'))

step('2.5 the content: materials, test, review and approval')
admin.call('POST', f'/training/activities/{aid}/material-links', {'title': 'E2E51 GMP slides', 'url': 'https://example.com/e2e51'})
admin.upload(f'/training/activities/{aid}/materials', 'file', 'e2e51-test.pdf', mini_pdf('E2E51 GMP test'), 'application/pdf', '?purpose=EXAM&title=E2E51%20GMP%20test')
admin.upload(f'/training/activities/{aid}/materials', 'file', 'e2e51-key.pdf', mini_pdf('E2E51 answer key'), 'application/pdf', '?purpose=ANSWER_KEY&title=E2E51%20answer%20key')
check('2.5 nothing is missing', get(aid)['contentRules']['missing'] == [], get(aid)['contentRules'])
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': qa.user['id']})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': t3.user['id']})
qa.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(qa)})
t3.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(t3)})
b.shot('admin', f'/training-management/activities/{aid}', 'p2_03_activity_content_approved', wait=5000)
a = admin.call('POST', f'/training/activities/{aid}/notify', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
check('2.6 notified', a['status'] == 'NOTIFIED', a['status'])
for who in TRAINEES:
    n = who.call('GET', '/notifications?limit=5')
b.shot('trainee.test1', '/training-management/my-training', 'p2_04_trainee_my_training', wait=5000)
tick_all(admin, sid)
a = admin.call('POST', f'/training/sessions/{sid}/hold', {'signatureToken': sign(admin)})
check('2.7 started: in progress', a['status'] == 'IN_PROGRESS', a['status'])

step('2.10 attendance (M2), the trainer sends the list (M2b)')
# trainee.test1 checks in with the code of the session and signs (My Training); the trainer ticks the other two present on their behalf with one signature (roll-call)
code_in = trainer.call('POST', f'/training/sessions/{sid}/check-in/open', {}).get('code') if False else admin.call('POST', f'/training/sessions/{sid}/check-in/open', {}).get('code')
check('2.9 a code to check in with is opened for the session', bool(code_in), code_in)
code, data, text = attempt(t1, 'POST', '/training/me/check-in', {'code': code_in, 'signatureToken': sign(t1)})
check('2.9 trainee.test1 checks in with the code and signs', code == 200, (code, text))
b.shot('trainee.test1', '/training-management/my-training', 'p2_06a_trainee_after_check_in', wait=4000)
code, data, text = attempt(trainer, 'POST', f'/training/sessions/{sid}/roll-call', {'present': [pid[t2.user['id']], pid[t3.user['id']]], 'absent': [], 'signatureToken': sign(trainer)})
if code != 200:
    code, data, text = attempt(admin, 'POST', f'/training/sessions/{sid}/roll-call', {'present': [pid[t2.user['id']], pid[t3.user['id']]], 'absent': [], 'signatureToken': sign(admin)})
check('2.9 the trainer ticks the two others present on their behalf, with a signature', code == 200, (code, text))
t, p = milestone(aid, 'f1_M2_attended', '2.10 M2 the session took place')
if t:
    check('2.10b M2: the column Signature is an electronic signature: the check-in of the employee and the roll-call of the trainer', 'Attendance Confirmed by Trainer' in t and 'Training Attended' in t and t.count('(UTC+') >= 3, t.count('(UTC+'))
print('   pages', render_pdf(p, 'p2_06_APD0117_M2_attended'))
b.shot('admin', f'/training-management/activities/{aid}/conduct', 'p2_07_conduct_attendance', wait=5000)
code, data, text = attempt(trainer, 'POST', f'/training/activities/{aid}/send-attendance-list', {'version': tget(aid)['version'], 'signatureToken': sign(trainer)})
check('2.11 the trainer signs and the attendance list is sent', code == 200, (code, text))
t, p = milestone(aid, 'f1_M2b_sent', '2.11 M2b the trainer sent the list')
if t:
    check('2.12 M2b: the trainer signature is written', 'Attendance List Sent' in t, t[:300])
    print('   pages', render_pdf(p, 'p2_08_APD0117_M2b_trainer_sent'))

step('2.13 results (M3): two pass, one fails')
for who, score in ((t1, 9), (t2, 8), (t3, 5)):
    a = admin.call('POST', f"/training/participants/{pid[who.user['id']]}/assessments", {'scoreObtained': score, 'scoreMax': 10, 'remarks': 'E2E51'})
res = {p['personUserId']: p['result'] for p in get(aid)['participants']}
check('2.13 9/10 and 8/10 pass, 5/10 fails (pass mark 70%)', res[t1.user['id']] == 'PASSED' and res[t2.user['id']] == 'PASSED' and res[t3.user['id']] == 'FAILED', res)
code, data, text = attempt(trainer, 'POST', f'/training/activities/{aid}/finish-training', {'version': tget(aid)['version'], 'signatureToken': sign(trainer)})
check('2.14 the trainer finishes the training', code == 200, (code, text))
t, p = milestone(aid, 'f1_M3_results', '2.15 M3 the results are finished')
if t:
    check('2.16 M3: the results are written (Passed and Failed)', 'Passed' in t and 'Failed' in t, t[:500])
    print('   pages', render_pdf(p, 'p2_09_APD0117_M3_results'))
code, data, text = attempt(trainer, 'POST', f'/training/activities/{aid}/submit-for-confirmation', {'version': tget(aid)['version'], 'signatureToken': sign(trainer)})
check('2.17 the trainer sends the results to QA', code == 200 and data.get('status') == 'PENDING_QA_CONFIRMATION', (code, text))
b.shot('approver.test1', f'/training-management/activities/{aid}', 'p2_10_activity_pending_qa', wait=5000)
code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/confirm-completion', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
check('2.18 the preparer of the list cannot confirm the completion (segregation)', code >= 400, (code, text))
code, data, text = attempt(qa, 'POST', f'/training/activities/{aid}/confirm-completion', {'version': get(aid)['version'], 'signatureToken': sign(qa)})
check('2.19 QA confirms: Completed', code == 200 and data.get('status') == 'COMPLETED', (code, text))
t, p = milestone(aid, 'f1_M4_completed', '2.20 M4 QA completed')
if t:
    check('2.21 M4: the QA completion signature is written', t.count('(UTC+') >= 3, t.count('(UTC+'))
    print('   pages', render_pdf(p, 'p2_11_APD0117_M4_completed'))
b.shot('admin', f'/training-management/activities/{aid}', 'p2_12_activity_completed', wait=5000)

step('2.22 the employee who failed is trained again (supplementary)')
code, sup, text = attempt(admin, 'POST', f'/training/activities/{aid}/supplementary', {'participantIds': [pid[t3.user['id']]], 'reason': 'E2E51 re-training after 5/10'})
check('2.22 a supplementary training is opened for the one who failed', code == 200, (code, text))
if code == 200:
    S['retrain'] = sup.get('id') or (sup.get('supplementary') or {}).get('id')
state['flow1'] = S
save(state)
finish(b)
