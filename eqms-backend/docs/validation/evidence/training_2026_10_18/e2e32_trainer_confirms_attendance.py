"""DEV: the trainer of a session sends the attendance list (the signature confirms the attendance, APD.0117 item 5), finishes the training once every result is in, and sends the results to QA; the
organizer who is not the trainer cannot. Results are recorded per person with a maximum score and the pass mark of Training Properties; a scan is kept under its person.
The password comes from DEVPW (never written); records are titled "E2E-TEST ..."; none is deleted."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from api import Client, tick_all
from e2e21_matrix import mini_pdf, attempt, check, sign, results, admin, qa, trainee, other, get, TODAY

trainer = Client('trainer.test1')


def tget(aid):
    return trainer.call('GET', f'/training/activities/{aid}')


print('== 1. an activity whose session has a trainer of the system')
code, a, text = attempt(admin, 'POST', '/training/activities', {'kind': 'UNPLANNED', 'trainingTitle': 'E2E-TEST trainer sends attendance', 'kindReason': 'OTHER'})
check('1.0 created', code == 200, (code, text))
aid = a['id']
a = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'trainerUserId': trainer.user['id'], 'scheduledOn': TODAY, 'venue': 'Room 1', 'topics': [{'topicText': 'E2E-TEST topic'}]})
sid = a['sessions'][0]['id']
# an internal trainer with no training record on GMP or on the SOP needs an exception approved (SOP.0003 5.3.4)
admin.call('POST', f'/training/sessions/{sid}/trainer-exception', {'reason': 'E2E-TEST the trainer of the unit', 'approverUserId': qa.user['id']})
ex = [x for x in get(aid)['sessions'] if x['id'] == sid][0]['trainerQualification']['exception']
qa.call('POST', f"/training/trainer-exceptions/{ex['id']}/approve", {'signatureToken': sign(qa)})
a = admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': [trainee.user['id'], other.user['id']], 'reason': 'E2E-TEST'})
pid = {p['personUserId']: p['id'] for p in a['participants']}
admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'E2E-TEST'})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': qa.user['id']})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': trainee.user['id']})
admin.call('POST', f'/training/activities/{aid}/material-links', {'title': 'E2E-TEST material', 'url': 'https://example.com/e2e'})
admin.upload(f'/training/activities/{aid}/materials', 'file', 'e2e-form.pdf', mini_pdf('E2E-TEST form'), 'application/pdf', '?purpose=EXAM&title=E2E-TEST%20form')
qa.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(qa)})
trainee.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(trainee)})
admin.call('POST', f'/training/activities/{aid}/notify', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
tick_all(admin, sid)
admin.call('POST', f'/training/sessions/{sid}/hold', {'signatureToken': sign(admin)})

print(chr(10) + '== 2. the attendance list is sent by the trainer')
check('2.1 the trainer is offered the send; the organizer who is not the trainer is not', tget(aid)['capabilities']['sendAttendanceList'] is True and get(aid)['capabilities']['sendAttendanceList'] is False, (tget(aid)['capabilities'], get(aid)['capabilities']))
code, data, text = attempt(trainer, 'POST', f'/training/activities/{aid}/send-attendance-list', {'version': tget(aid)['version'], 'signatureToken': sign(trainer)})
check('2.2 not while someone is not recorded (TRAINING_PARTICIPANT_NOT_FINAL)', code == 409 and 'TRAINING_PARTICIPANT_NOT_FINAL' in text, (code, text))
admin.call('POST', f"/training/participants/{pid[trainee.user['id']]}/attendance", {'state': 'ATTENDED'})
admin.call('POST', f"/training/participants/{pid[other.user['id']]}/attendance", {'state': 'ABSENT', 'absenceReason': 'E2E-TEST on leave'})
code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/send-attendance-list', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
check('2.3 the organizer who is not the trainer cannot send it', code == 403, (code, text))
code, data, text = attempt(trainer, 'POST', f'/training/activities/{aid}/send-attendance-list', {'version': tget(aid)['version']})
check('2.4 not without a signature (TRAINING_SIGNATURE_REQUIRED)', code == 400 and 'TRAINING_SIGNATURE_REQUIRED' in text, (code, text))
code, data, text = attempt(trainer, 'POST', f'/training/activities/{aid}/send-attendance-list', {'version': tget(aid)['version'], 'signatureToken': sign(trainer)})
check('2.5 the trainer signs and the list is sent', code == 200, (code, text))
a = tget(aid)
check('2.6 date and person are kept; the send is off; Finish Training is not offered while a result is missing', bool(a.get('attendanceSentAt')) and a['capabilities']['sendAttendanceList'] is False and a['capabilities']['finishTraining'] is False and a['capabilities']['submitForConfirmation'] is False, a['capabilities'])
code, data, text = attempt(trainer, 'POST', f'/training/activities/{aid}/send-attendance-list', {'version': tget(aid)['version'], 'signatureToken': sign(trainer)})
check('2.7 once only (TRAINING_ATTENDANCE_ALREADY_SENT)', code == 409 and 'TRAINING_ATTENDANCE_ALREADY_SENT' in text, (code, text))
check('2.8 the completion day of the training is the day it was held', admin.call('GET', f'/training/activities/{aid}')['sessions'][0]['heldOn'] == TODAY)

print(chr(10) + '== 3. the results, the pass mark of Training Properties, the scan under its person')
settings = admin.call('GET', '/training/settings')
check('3.1 the detail carries the pass mark of Training Properties', get(aid)['passPercent'] == settings['passPercent'], (get(aid)['passPercent'], settings['passPercent']))
pm = settings['passPercent']
below = max(1, int(pm / 10) - 1)
a = admin.call('POST', f"/training/participants/{pid[trainee.user['id']]}/assessments", {'scoreObtained': below, 'scoreMax': 10})
p = [x for x in a['participants'] if x['id'] == pid[trainee.user['id']]][0]
check(f'3.2 {below} of 10 is below the pass mark {pm}%: Failed, and the last score is returned', p['result'] == 'FAILED' and float(p['lastScore']) == below and float(p['lastMax']) == 10, p)
check('3.3 a failed result is a result: Finish Training is offered to the trainer only', tget(aid)['capabilities']['finishTraining'] is True and get(aid)['capabilities']['finishTraining'] is False)
a = admin.call('POST', f"/training/participants/{pid[trainee.user['id']]}/assessments", {'scoreObtained': 10, 'scoreMax': 10})
p = [x for x in a['participants'] if x['id'] == pid[trainee.user['id']]][0]
check('3.4 10 of 10 passes (the second try)', p['result'] == 'PASSED' and float(p['lastScore']) == 10, p)
f = admin.upload(f'/training/activities/{aid}/paper-evidence', 'file', 'e2e-scan.pdf', mini_pdf('E2E-TEST scan'), 'application/pdf', f"?kind=ASSESSMENT&participantId={pid[trainee.user['id']]}")
mine = [e for e in f['evidence'] if e.get('participantId') == pid[trainee.user['id']]]
check('3.5 the scan is kept under that person', len(mine) == 1 and bool(mine[0]['participantName']), mine)

print(chr(10) + '== 4. Finish Training, then Send results to QA')
code, data, text = attempt(trainer, 'POST', f'/training/activities/{aid}/submit-for-confirmation', {'version': tget(aid)['version'], 'signatureToken': sign(trainer)})
check('4.1 Send results is refused before Finish Training (TRAINING_NOT_FINISHED)', code == 409 and 'TRAINING_NOT_FINISHED' in text, (code, text))
code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/finish-training', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
check('4.2 the organizer who is not the trainer cannot finish the training', code == 403, (code, text))
code, data, text = attempt(trainer, 'POST', f'/training/activities/{aid}/finish-training', {'version': tget(aid)['version']})
check('4.3 Finish Training needs a signature', code == 400 and 'TRAINING_SIGNATURE_REQUIRED' in text, (code, text))
code, data, text = attempt(trainer, 'POST', f'/training/activities/{aid}/finish-training', {'version': tget(aid)['version'], 'signatureToken': sign(trainer)})
check('4.4 the trainer signs and the training is finished', code == 200, (code, text))
a = tget(aid)
check('4.5 date and person kept; Send results offered; Finish off', bool(a.get('resultsFinishedAt')) and a['capabilities']['submitForConfirmation'] is True and a['capabilities']['finishTraining'] is False, a['capabilities'])
code, data, text = attempt(admin, 'POST', f"/training/participants/{pid[trainee.user['id']]}/assessments", {'scoreObtained': 1, 'scoreMax': 10})
check('4.6 no result can be changed after Finish Training', code == 409 and 'TRAINING_ALREADY_FINISHED' in text, (code, text))
code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/submit-for-confirmation', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
check('4.7 the organizer who is not the trainer cannot send the results', code == 403, (code, text))
code, data, text = attempt(trainer, 'POST', f'/training/activities/{aid}/submit-for-confirmation', {'version': tget(aid)['version'], 'signatureToken': sign(trainer)})
check('4.8 the trainer sends the results to QA', code == 200 and data.get('status') == 'PENDING_QA_CONFIRMATION', (code, text))
a = tget(aid)
check('4.9 nothing more is offered to the trainer', not any(a['capabilities'].get(k) for k in ('sendAttendanceList', 'finishTraining', 'submitForConfirmation')), a['capabilities'])

failed = [r for r in results if not r[1]]
print(f'\n{len(results) - len(failed)} of {len(results)} checks passed')
sys.exit(1 if failed else 0)
