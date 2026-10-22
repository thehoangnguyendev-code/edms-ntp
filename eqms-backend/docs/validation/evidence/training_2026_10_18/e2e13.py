import os, sys, json, datetime, time
sys.path.insert(0, os.path.dirname(__file__))
from api import Client
PW = os.environ['DEVPW']
def sign(c): return c.call('POST', '/auth/verify-signature', {'username': c.user['username'], 'password': PW})['signatureToken']
def step(m): print('\n== ' + m)
admin = Client('admin'); approver = Client('approver.test1'); reviewer = Client('user.a.test')
t1 = Client('trainee.test1'); t2 = Client('trainee.test2'); trainer = Client('trainer.test1')

step('activity with a test written in the system')
a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'trainingTitle': 'Online test walkthrough'})
aid = a['id']; print(a['trainingNumber'])
today = datetime.date.today().isoformat()
a = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'External Trainer', 'scheduledOn': today, 'venue': 'Room 3', 'topics': [{'topicText': 'Online test topic'}]})
sid = a['sessions'][0]['id']
a = admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': [t1.user['id'], t2.user['id']], 'reason': 'E2E'})
p1 = [p['id'] for p in a['participants'] if p['personUserId'] == t1.user['id']][0]
p2 = [p['id'] for p in a['participants'] if p['personUserId'] == t2.user['id']][0]
bad = {'minutes': 30, 'questions': [{'kind': 'SINGLE', 'prompt': 'Only one option', 'options': [{'id': 'A', 'text': 'x'}], 'correct': ['A'], 'points': 1}]}
code, b = admin.call('PUT', f'/training/activities/{aid}/exam', bad, raw=True); print('one option ->', code); assert code == 400
good = {'minutes': 30, 'questions': [
    {'kind': 'SINGLE', 'prompt': 'What is the pass mark?', 'options': [{'id': 'A', 'text': '50%'}, {'id': 'B', 'text': '70%'}, {'id': 'C', 'text': '90%'}], 'correct': ['B'], 'points': 2},
    {'kind': 'MULTI', 'prompt': 'Which are ALCOA+ attributes?', 'options': [{'id': 'A', 'text': 'Attributable'}, {'id': 'B', 'text': 'Colourful'}, {'id': 'C', 'text': 'Legible'}, {'id': 'D', 'text': 'Contemporaneous'}], 'correct': ['A', 'C', 'D'], 'points': 2},
    {'kind': 'TRUE_FALSE', 'prompt': 'A trainee signs all pages of a paper test.', 'options': [], 'correct': ['A'], 'points': 1}]}
e = admin.call('PUT', f'/training/activities/{aid}/exam', good); print('saved', len(e['questions']), 'questions; canEdit', e['canEdit'], 'key shown to the author', 'correct' in e['questions'][0])
qs = {q['qNo']: q for q in e['questions']}
code, b = t1.call('GET', f'/training/activities/{aid}/exam', raw=True); print('trainee reads the test definition ->', code); assert code == 403

step('approval locks the questions')
admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'E2E'})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': approver.user['id']})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': reviewer.user['id']})
ek = approver.call('GET', f'/training/activities/{aid}/exam'); print('reviewer sees the key:', ek['canSeeKey'], 'correct' in ek['questions'][0])
approver.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(approver)})
reviewer.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(reviewer)})
code, b = admin.call('PUT', f'/training/activities/{aid}/exam', good, raw=True); print('edit after approval ->', code); assert code == 409
a = admin.call('GET', f'/training/activities/{aid}'); print('blockers', a['capabilities'].get('notifyBlockers'))
a = admin.call('POST', f'/training/activities/{aid}/notify', {'version': a['version']}); print(a['status'])

step('trainer holds the session and marks the trainees present')
a = trainer.call('POST', f'/training/sessions/{sid}/hold', {}); print('held by trainer.test1:', a['status'])
code, b = t1.call('POST', f'/training/me/participations/{p1}/exam/start', None, raw=True); print('start before attendance ->', code); assert code == 409
trainer.call('POST', f'/training/participants/{p1}/attendance', {'state': 'ATTENDED'}); trainer.call('POST', f'/training/participants/{p2}/attendance', {'state': 'ATTENDED'})
tasks = t1.call('GET', '/training/me/tasks/table?limit=10&search=Online'); print('trainee todo:', [(x['trainingNumber'], x['examReady']) for x in tasks['data']])

step('trainee 1 answers everything right')
m = t1.call('GET', f'/training/me/participations/{p1}/exam'); print('canStart', m['canStart'])
att = t1.call('POST', f'/training/me/participations/{p1}/exam/start')
print('questions', len(att['questions']), 'key leaked:', any('correct' in q for q in att['questions']), 'due', att['dueAt'][:19])
ans = {}
for q in att['questions']:
    ans[q['id']] = {'What is the pass mark?': ['B'], 'Which are ALCOA+ attributes?': ['A', 'C', 'D'], 'A trainee signs all pages of a paper test.': ['A']}[q['prompt']]
code, b = t2.call('POST', f'/training/exam-attempts/{att["attemptId"]}/submit', {'answers': ans, 'signatureToken': sign(t2)}, raw=True); print("another trainee submits someone else's attempt ->", code); assert code == 403
bad_ans = dict(ans); bad_ans[att['questions'][0]['id']] = ['Z']
code, b = t1.call('POST', f'/training/exam-attempts/{att["attemptId"]}/submit', {'answers': bad_ans, 'signatureToken': sign(t1)}, raw=True); print('invalid option ->', code); assert code == 400
code, b = t1.call('POST', f'/training/exam-attempts/{att["attemptId"]}/submit', {'answers': ans}, raw=True); print('no signature ->', code); assert code == 400
r = t1.call('POST', f'/training/exam-attempts/{att["attemptId"]}/submit', {'answers': ans, 'signatureToken': sign(t1)}); print('result', r['result'], r['attempt']['percent'], r['attempt']['scoreObtained'], '/', r['attempt']['scoreMax'])
code, b = t1.call('POST', f'/training/me/participations/{p1}/exam/start', None, raw=True); print('start again after a result ->', code); assert code == 409

step('trainee 2 fails, is blocked, gets released')
att2 = t2.call('POST', f'/training/me/participations/{p2}/exam/start')
ans2 = {q['id']: ['A'] for q in att2['questions']}
r2 = t2.call('POST', f'/training/exam-attempts/{att2["attemptId"]}/submit', {'answers': ans2, 'signatureToken': sign(t2)}); print('result', r2['result'], r2['attempt']['percent'])
a = admin.call('GET', f'/training/activities/{aid}'); print([(p['fullName'], p['state'], p['result'], p.get('examState')) for p in a['participants']])
json.dump({'aid': aid, 'sid': sid, 'p1': p1, 'p2': p2}, open('exam_walk.json', 'w'))
