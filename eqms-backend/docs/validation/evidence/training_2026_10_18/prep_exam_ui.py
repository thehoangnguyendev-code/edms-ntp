import os, sys, json, datetime
sys.path.insert(0, '.')
from api import Client
PW = os.environ['DEVPW']
def sign(c): return c.call('POST', '/auth/verify-signature', {'username': c.user['username'], 'password': PW})['signatureToken']
admin = Client('admin'); approver = Client('approver.test1'); reviewer = Client('user.a.test'); t2 = Client('trainee.test2'); trainer = Client('trainer.test1')
# one activity left editable (for the author screen) and one ready for the trainee screen
a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'trainingTitle': 'Test authoring screen'}); edit_id = a['id']
admin.call('POST', f'/training/activities/{edit_id}/sessions', {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'External Trainer', 'scheduledOn': datetime.date.today().isoformat(), 'venue': 'Room 4', 'topics': [{'topicText': 'Authoring topic'}]})
admin.call('PUT', f'/training/activities/{edit_id}/exam', {'minutes': 20, 'questions': [{'kind': 'SINGLE', 'prompt': 'Which colour is a stop signal?', 'options': [{'id':'A','text':'Red'},{'id':'B','text':'Green'}], 'correct': ['A'], 'points': 1}]})
a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'trainingTitle': 'Test taking screen'}); aid = a['id']
a = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'External Trainer', 'scheduledOn': datetime.date.today().isoformat(), 'venue': 'Room 5', 'topics': [{'topicText': 'Taking topic'}]}); sid = a['sessions'][0]['id']
a = admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': [t2.user['id']], 'reason': 'UI'}); pid = a['participants'][0]['id']
admin.call('PUT', f'/training/activities/{aid}/exam', {'minutes': 15, 'questions': [
 {'kind': 'SINGLE', 'prompt': 'What is the pass mark of a training test?', 'options': [{'id':'A','text':'50%'},{'id':'B','text':'70%'},{'id':'C','text':'90%'}], 'correct': ['B'], 'points': 2},
 {'kind': 'MULTI', 'prompt': 'Which of these are ALCOA+ attributes?', 'options': [{'id':'A','text':'Attributable'},{'id':'B','text':'Colourful'},{'id':'C','text':'Legible'}], 'correct': ['A','C'], 'points': 2},
 {'kind': 'TRUE_FALSE', 'prompt': 'A trainee signs the completed test.', 'options': [], 'correct': ['A'], 'points': 1}]})
admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'UI'})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': approver.user['id']})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': reviewer.user['id']})
approver.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(approver)})
reviewer.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(reviewer)})
a = admin.call('GET', f'/training/activities/{aid}'); admin.call('POST', f'/training/activities/{aid}/notify', {'version': a['version']})
trainer.call('POST', f'/training/sessions/{sid}/hold', {}); trainer.call('POST', f'/training/participants/{pid}/attendance', {'state': 'ATTENDED'})
json.dump({'edit': edit_id, 'aid': aid, 'pid': pid}, open('exam_ui.json', 'w')); print('ready', aid, pid)
