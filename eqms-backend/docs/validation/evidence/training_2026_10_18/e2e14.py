import os, sys, json, datetime, subprocess
sys.path.insert(0, os.path.dirname(__file__))
from api import Client
PW = os.environ['DEVPW']
def sign(c): return c.call('POST', '/auth/verify-signature', {'username': c.user['username'], 'password': PW})['signatureToken']
def step(m): print('\n== ' + m)
admin = Client('admin'); approver = Client('approver.test1'); reviewer = Client('user.a.test'); t1 = Client('trainee.test1'); trainer = Client('trainer.test1')
a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'trainingTitle': 'Online test time-out walkthrough'}); aid = a['id']; print(a['trainingNumber'])
a = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'External Trainer', 'scheduledOn': datetime.date.today().isoformat(), 'venue': 'Room 3', 'topics': [{'topicText': 'Time-out topic'}]})
sid = a['sessions'][0]['id']
a = admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': [t1.user['id']], 'reason': 'E2E'})
pid = a['participants'][0]['id']
admin.call('PUT', f'/training/activities/{aid}/exam', {'minutes': 1, 'questions': [{'kind': 'TRUE_FALSE', 'prompt': 'Is this a test?', 'options': [], 'correct': ['A'], 'points': 1}]})
admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'E2E'})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': approver.user['id']})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': reviewer.user['id']})
approver.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(approver)})
reviewer.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(reviewer)})
a = admin.call('GET', f'/training/activities/{aid}'); admin.call('POST', f'/training/activities/{aid}/notify', {'version': a['version']})
trainer.call('POST', f'/training/sessions/{sid}/hold', {}); trainer.call('POST', f'/training/participants/{pid}/attendance', {'state': 'ATTENDED'})
att = t1.call('POST', f'/training/me/participations/{pid}/exam/start'); print('started, due', att['dueAt'][:19])
step('the clock runs out (the due time is moved back in the database)')
subprocess.run(['docker', 'compose', 'exec', '-T', 'postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-c', f"update training_exam_attempts set due_at = now() - interval '5 minutes' where id = '{att['attemptId']}'"], cwd='D:/edms-project', capture_output=True)
code, b = t1.call('POST', f'/training/exam-attempts/{att["attemptId"]}/submit', {'answers': {att['questions'][0]['id']: ['A']}, 'signatureToken': sign(t1)}, raw=True); print('late submit ->', code, b[:90]); assert code == 409
code, b = t1.call('POST', f'/training/me/participations/{pid}/exam/start', None, raw=True); print('start -> ', code, b[:90]); assert code == 409
m = t1.call('GET', f'/training/me/participations/{pid}/exam'); print('mine:', m['attempt']['status'], 'canStart', m['canStart'])
a = admin.call('GET', f'/training/activities/{aid}'); print('trainer sees examState:', a['participants'][0]['examState'])
code, b = t1.call('POST', f'/training/participants/{pid}/exam/release', {'reason': 'self'}, raw=True); print('trainee releases own test ->', code); assert code == 403
code, b = trainer.call('POST', f'/training/participants/{pid}/exam/release', {}, raw=True); print('release without reason ->', code); assert code == 400
print(trainer.call('POST', f'/training/participants/{pid}/exam/release', {'reason': 'Network failure during the test'}))
att2 = t1.call('POST', f'/training/me/participations/{pid}/exam/start'); print('second attempt', att2['attemptNo'])
r = t1.call('POST', f'/training/exam-attempts/{att2["attemptId"]}/submit', {'answers': {att2['questions'][0]['id']: ['A']}, 'signatureToken': sign(t1)}); print('result', r['result'], r['attempt']['percent'])
a = admin.call('GET', f'/training/activities/{aid}'); print([ (p['fullName'], p['result'], p['examState']) for p in a['participants']])
