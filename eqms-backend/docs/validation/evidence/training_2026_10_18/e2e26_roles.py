"""DEV: who may do what in a training activity, with the accounts of the limited roles: trainee.test1 (module.view, self.view) and trainer.test1 (activity.view, conduct, assessment.record, paper) and
dco.test1 (views only). The expected results follow the permissions of each account, not what the system answers. The password comes from DEVPW (never written); records are titled "E2E-TEST roles ...".
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from api import Client, tick_all, finish_for_qa
from e2e21_matrix import mini_pdf, attempt, check, sign, results, admin, qa, trainee, get, TODAY

trainee1 = Client('trainee.test1')
trainer1 = Client('trainer.test1')
viewer = Client('dco.test1')

a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'trainingTitle': 'E2E-TEST roles'})
aid = a['id']
a = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'External Trainer', 'scheduledOn': TODAY, 'venue': 'Room 1', 'topics': [{'topicText': 'E2E-TEST topic'}]})
sid = a['sessions'][0]['id']
a = admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': [trainee1.user['id']], 'reason': 'E2E-TEST'})
pid = a['participants'][0]['id']
admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'E2E-TEST'})
admin.call('POST', f'/training/activities/{aid}/material-links', {'title': 'E2E-TEST material', 'url': 'https://example.com/e2e'})
admin.upload(f'/training/activities/{aid}/materials', 'file', 'e2e-test.pdf', mini_pdf('E2E-TEST'), 'application/pdf', '?purpose=EXAM&title=E2E-TEST%20test')
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': qa.user['id']})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': trainee.user['id']})
qa.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(qa)})
trainee.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(trainee)})

print('== before the notice')
for who, name in ((trainee1, 'trainee.test1'), (trainer1, 'trainer.test1'), (viewer, 'dco.test1')):
    code, data, text = attempt(who, 'POST', f'/training/activities/{aid}/notify', {'version': get(aid)['version'], 'signatureToken': sign(who)})
    check(f'1 {name} cannot notify (no right to organize)', code == 403, (code, text))
code, data, text = attempt(trainee1, 'GET', f'/training/activities/{aid}')
check('2 trainee.test1 cannot open the activity (no right to view activities)', code == 403, (code, text))
code, data, text = attempt(trainer1, 'GET', f'/training/activities/{aid}')
check('3 trainer.test1 can open it (activity.view)', code == 200, (code, text))

admin.call('POST', f'/training/activities/{aid}/notify', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
tick_all(admin, sid)
print(chr(10) + '== start and attendance')
code, data, text = attempt(trainee1, 'POST', f'/training/sessions/{sid}/hold', {'signatureToken': sign(trainee1)})
check('4 trainee.test1 cannot start the training', code == 403, (code, text))
code, data, text = attempt(trainer1, 'POST', f'/training/sessions/{sid}/hold', {'signatureToken': sign(trainer1)})
check('5 trainer.test1 (right to conduct) starts the training with a signature', code == 200 and data.get('status') == 'IN_PROGRESS', (code, text))
code, data, text = attempt(trainee1, 'POST', f'/training/participants/{pid}/attendance', {'state': 'ATTENDED'})
check('6 trainee.test1 cannot record an attendance', code == 403, (code, text))
code, data, text = attempt(trainer1, 'POST', f'/training/participants/{pid}/attendance', {'state': 'ATTENDED'})
check('7 trainer.test1 records the attendance', code == 200, (code, text))
code, data, text = attempt(trainee1, 'POST', f'/training/participants/{pid}/assessments', {'scoreObtained': 9, 'scoreMax': 10})
check('8 trainee.test1 cannot score himself', code == 403, (code, text))
code, data, text = attempt(trainer1, 'POST', f'/training/participants/{pid}/assessments', {'scoreObtained': 9, 'scoreMax': 10})
check('9 trainer.test1 scores (assessment.record)', code == 200, (code, text))
finish_for_qa(trainer1, aid, lambda: sign(trainer1))
code, data, text = attempt(trainer1, 'POST', f'/training/activities/{aid}/submit-for-confirmation', {'version': get(aid)['version'], 'signatureToken': sign(trainer1)})
check('10 trainer.test1 cannot send the results to QA (that is for the organizer)', code == 403, (code, text))
finish_for_qa(admin, aid, lambda: sign(admin))
admin.call('POST', f'/training/activities/{aid}/submit-for-confirmation', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
code, data, text = attempt(trainer1, 'POST', f'/training/activities/{aid}/confirm-completion', {'version': get(aid)['version'], 'signatureToken': sign(trainer1)})
check('11 trainer.test1 cannot confirm the completion (that is for QA)', code in (400, 403), (code, text))
code, data, text = attempt(viewer, 'POST', f'/training/activities/{aid}/cancel', {'version': get(aid)['version'], 'reason': 'E2E-TEST', 'signatureToken': sign(viewer)})
check('12 dco.test1 cannot cancel', code == 403, (code, text))

failed = [r for r in results if not r[1]]
print(f'\n{len(results) - len(failed)} of {len(results)} checks passed')
sys.exit(1 if failed else 0)
