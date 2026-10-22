import os, sys, json, datetime, time
sys.path.insert(0, os.path.dirname(__file__))
from api import Client
PW = os.environ['DEVPW']
def sign(c): return c.call('POST', '/auth/verify-signature', {'username': c.user['username'], 'password': PW})['signatureToken']
def step(m): print('\n== ' + m)
admin = Client('admin'); approver = Client('approver.test1'); reviewer = Client('user.a.test')
t1 = Client('trainee.test1'); t2 = Client('trainee.test2'); trainer = Client('trainer.test1')

step('activity with a test written in the system')
a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'trainingTitle': 'Self check-in walkthrough'})
aid = a['id']; print(a['trainingNumber'])
today = datetime.date.today().isoformat()
a = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'External Trainer', 'scheduledOn': today, 'venue': 'Room 3', 'topics': [{'topicText': 'Online test topic'}]})
sid = a['sessions'][0]['id']
a = admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': [t1.user['id'], t2.user['id']], 'reason': 'E2E'})
p1 = [p['id'] for p in a['participants'] if p['personUserId'] == t1.user['id']][0]
p2 = [p['id'] for p in a['participants'] if p['personUserId'] == t2.user['id']][0]
step('approve and start')
admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'E2E'})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': approver.user['id']})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': reviewer.user['id']})
approver.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(approver)})
reviewer.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(reviewer)})
a = admin.call('GET', f'/training/activities/{aid}'); print('blockers', a['capabilities'].get('notifyBlockers'))
a = admin.call('POST', f'/training/activities/{aid}/notify', {'version': a['version']}); print(a['status'])

step('trainer holds the session')
a = trainer.call('POST', f'/training/sessions/{sid}/hold', {}); print(a['status'])

step('check-in')
code, b = t1.call('POST', f'/training/me/check-in', {'code': '123456', 'signatureToken': sign(t1)}, raw=True); print('door not open ->', code); assert code == 400
code, b = t1.call('POST', f'/training/sessions/{sid}/check-in/open', None, raw=True); print('trainee opens ->', code); assert code == 403
st = trainer.call('POST', f'/training/sessions/{sid}/check-in/open'); print('open', st)
code, b = t1.call('GET', f'/training/sessions/{sid}/check-in', raw=True); print('trainee reads status ->', code); assert code == 403
code, b = t1.call('POST', f'/training/me/check-in', {'code': '000000' if st['code'] != '000000' else '111111', 'signatureToken': sign(t1)}, raw=True); print('wrong code ->', code); assert code == 400
code, b = t1.call('POST', f'/training/me/check-in', {'code': st['code']}, raw=True); print('no signature ->', code); assert code == 400
r = t1.call('POST', f'/training/me/check-in', {'code': st['code'], 'signatureToken': sign(t1)}); print('checked in', r)
code, b = t1.call('POST', f'/training/me/check-in', {'code': st['code'], 'signatureToken': sign(t1)}, raw=True); print('again ->', code); assert code in (400, 409)
st = trainer.call('GET', f'/training/sessions/{sid}/check-in'); print(st)
a = admin.call('GET', f'/training/activities/{aid}'); print([(p['fullName'], p['state'], p.get('signMode')) for p in a['participants']])
step('trainer marks the one without a phone')
a = trainer.call('POST', f'/training/sessions/{sid}/roll-call', {'present': [p2], 'absent': [], 'signatureToken': sign(trainer)})
print([(p['fullName'], p['state'], p.get('signMode')) for p in a['participants']])
trainer.call('POST', f'/training/sessions/{sid}/check-in/close'); print('closed')
