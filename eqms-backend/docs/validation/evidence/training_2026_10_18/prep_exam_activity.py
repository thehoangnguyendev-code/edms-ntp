import os, sys, json, datetime
sys.path.insert(0, os.path.dirname(__file__))
from api import Client
PW = os.environ['DEVPW']
def sign(c): return c.call('POST', '/auth/verify-signature', {'username': c.user['username'], 'password': PW})['signatureToken']
admin = Client('admin'); approver = Client('approver.test1'); trainee = Client('user.a.test'); dco = Client('dco.test1')
a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'trainingTitle': 'Exam stamping test'})
aid = a['id']; print(a['trainingNumber'])
today = datetime.date.today().isoformat()
a = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'External Trainer', 'scheduledOn': today, 'venue': 'Room 2', 'topics': [{'topicText': 'UI topic'}]})
sid = a['sessions'][0]['id']
a = admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': [trainee.user['id'], dco.user['id']], 'reason': 'UI'})
admin.call('POST', f'/training/sessions/{sid}/delivery-mode', {'mode': 'PAPER'})
admin.upload(f'/training/activities/{aid}/materials', 'file', 'exam.pdf', open('pack1.pdf','rb').read(), 'application/pdf', '?purpose=EXAM&title=Exam')
admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'UI'})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': approver.user['id']})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': trainee.user['id']})
approver.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(approver)})
trainee.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(trainee)})
a = admin.call('GET', f'/training/activities/{aid}')
a = admin.call('POST', f'/training/activities/{aid}/notify', {'version': a['version']})
code, pdf = admin.call('POST', f'/training/sessions/{sid}/paper-pack', {}, raw=True)
admin.call('POST', f'/training/sessions/{sid}/hold', {})
admin.upload(f'/training/activities/{aid}/paper-evidence', 'file', 'ui-scan.pdf', pdf, 'application/pdf', '?kind=ATTENDANCE_SHEET')
json.dump({'aid': aid, 'sid': sid}, open('exam_state.json', 'w'))
print('ready', aid, a['status'])
