import os, sys, json
sys.path.insert(0, os.path.dirname(__file__))
from api import Client
def step(m): print('\n== ' + m)
admin = Client('admin'); trainee = Client('user.a.test')
step('suggestions')
print('suggestions:', admin.call('GET', '/training/personnel-reviews/suggestions'))
step('review with a training created from an item')
r = admin.call('POST', '/training/personnel-reviews', {'personUserId': trainee.user['id'], 'kind': 'ABSENCE_RETURN', 'eventDate': '2026-10-18', 'absenceFrom': '2026-01-05', 'absenceTo': '2026-09-30', 'note': 'E2E long absence'})
rid = r['id']; print('review', r['reviewNo'], 'over six months:', r['absenceOverSixMonths'])
r = admin.call('POST', f'/training/personnel-reviews/{rid}/items/RETRAINING/training')
act = [i for i in r['items'] if i['itemCode'] == 'RETRAINING'][0]
print('created', r['createdActivityId'][:8], act['trainingNumber'], act.get('trainingTopics'))
code, b = admin.call('POST', f'/training/personnel-reviews/{rid}/items/RETRAINING/training', None, raw=True); print('again ->', code); assert code == 409
code, b = admin.call('POST', f'/training/personnel-reviews/{rid}/items/REVIEW_RECORDS/training', None, raw=True); print('item without training ->', code); assert code == 400
r = admin.call('PUT', f'/training/personnel-reviews/{rid}/items/RETRAINING', {'status': 'PENDING', 'activityId': act['activityId'], 'note': 'to be organised'}); print('re-save with the same activity ok')
a = admin.call('GET', f"/training/activities/{act['activityId']}"); print('activity', a['trainingNumber'], a['kindReason'], a['trainingTitle'])
step('compliance shows the open review')
print('summary openReviews:', admin.call('GET', '/training/compliance/summary')['openReviews'])
pos = admin.call('GET', '/training/compliance/positions')
for p in pos:
    m = admin.call('GET', f'/training/compliance/matrix-completion?positionId={p["id"]}&limit=20')
    print(p['name'], [(x['fullName'], x['openReviews']) for x in m['data']])
step('cancel the test review and its activity')
admin.call('POST', f'/training/personnel-reviews/{rid}/cancel', {'reason': 'E2E cleanup'})
a = admin.call('GET', f"/training/activities/{act['activityId']}")
admin.call('POST', f"/training/activities/{act['activityId']}/cancel", {'version': a['version'], 'reason': 'E2E cleanup'}); print('cleaned')
