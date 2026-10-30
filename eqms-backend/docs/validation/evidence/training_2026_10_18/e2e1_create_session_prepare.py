import os, sys, json, datetime
sys.path.insert(0, os.path.dirname(__file__))
from api import Client

PW = os.environ['DEVPW']
def sign(c):
    r = c.call('POST', '/auth/verify-signature', {'username': c.user['username'], 'password': PW})
    return r['signatureToken']

def step(msg):
    print('\n== ' + msg)

admin = Client('admin')
approver = Client('approver.test1')
trainee = Client('user.a.test')
print('users', admin.user['username'], approver.user['username'], trainee.user['username'])

step('create activity')
a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'trainingTitle': 'E2E paper training'})
aid = a['id']
print(a['trainingNumber'], a['status'], a.get('trainingTopics'))

step('list shows trainingTitle and actions')
lst = admin.call('GET', '/training/activities?limit=5&search=' + a['trainingNumber'])  # an activity has no title of its own: its Training Number finds it
row = [r for r in lst['data'] if r['id'] == aid][0]
print(row.get('trainingTopics'), row.get('actions'))

step('session + participants')
today = datetime.date.today().isoformat()
a = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'External Trainer', 'scheduledOn': today, 'venue': 'Room 1', 'topics': [{'topicText': 'E2E topic'}]})
sid = a['sessions'][0]['id']
print('session', sid, a['sessions'][0].get('deliveryMode'))
a = admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': [trainee.user['id']], 'reason': 'E2E'})
pid = a['participants'][0]['id']
print('participant', a['participants'][0]['fullName'], a['participants'][0]['state'])

step('delivery mode PAPER')
print(admin.call('POST', f'/training/sessions/{sid}/delivery-mode', {'mode': 'PAPER'}))

step('preparation checklist')
prep = admin.call('GET', f'/training/activities/{aid}/preparation')
print([(s['sessionNo'], s['open']) for s in prep])
prep = admin.call('PUT', f'/training/sessions/{sid}/preparation/VENUE', {'status': 'DONE', 'assignedTo': approver.user['id'], 'note': 'Room booked'})
print([(i['itemCode'], i['status'], i.get('assignedToName')) for i in prep[0]['items']])

step('confirm list')
a = admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'E2E'})
print('list prepared')

step('approvers for content')
for s_ in ('CONTENT_REVIEW', 'CONTENT_APPROVE'):
    el = admin.call('GET', f'/training/activities/{aid}/eligible-approvers?step={s_}&limit=50')
    print(s_, [(p['fullName'], p['id'][:8]) for p in el['data']][:6])
open(os.path.join(os.path.dirname(__file__), 'e2e_state.json'), 'w').write(json.dumps({'aid': aid, 'sid': sid, 'pid': pid}))
