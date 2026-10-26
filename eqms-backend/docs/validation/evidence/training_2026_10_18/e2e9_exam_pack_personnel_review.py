import os, sys, json
sys.path.insert(0, os.path.dirname(__file__))
from api import Client
PW = os.environ['DEVPW']
def sign(c): return c.call('POST', '/auth/verify-signature', {'username': c.user['username'], 'password': PW})['signatureToken']
def step(m): print('\n== ' + m)
admin = Client('admin'); approver = Client('approver.test1'); dco = Client('dco.test1'); trainee = Client('user.a.test')
st = json.load(open('exam_state.json')); aid = st['aid']; sid = st['sid']

step('exam pack: refused without an exam, then with a PDF exam')
code, out = admin.call('POST', f'/training/sessions/{sid}/exam-pack', {}, raw=True); print('print ->', code, out[:5], len(out)); assert code == 200 and out[:2] == b'PK'  # a ZIP with one file for each trainee
open('exam1.pdf', 'wb').write(out)
code, b = admin.call('POST', f'/training/sessions/{sid}/exam-pack', {}, raw=True); print('reprint no reason ->', code); assert code == 400
code, out2 = admin.call('POST', f'/training/sessions/{sid}/exam-pack', {'reason': 'Torn copy'}, raw=True); print('reprint with reason ->', code)
print([(p['packKind'], p['packCode'], p['pageCount']) for p in admin.call('GET', f'/training/activities/{aid}/paper-packs')])
a = admin.call('GET', f'/training/activities/{aid}'); print('qaList for an ordinary training:', a.get('qaList'))

step('personnel review')
r = admin.call('POST', '/training/personnel-reviews', {'personUserId': dco.user['id'], 'kind': 'NEW_HIRE', 'eventDate': '2026-10-01', 'note': 'E2E new employee'})
rid = r['id']; print(r['reviewNo'], r['status'], [i['itemCode'] for i in r['items']])
code, b = admin.call('POST', '/training/personnel-reviews', {'personUserId': dco.user['id'], 'kind': 'NEW_HIRE', 'eventDate': '2026-10-01'}, raw=True); print('second open ->', code); assert code == 409
code, b = admin.call('PUT', f'/training/personnel-reviews/{rid}/items/GMP_GENERAL', {'status': 'NOT_NEEDED'}, raw=True); print('not needed without reason ->', code); assert code == 400
code, b = admin.call('PUT', f'/training/personnel-reviews/{rid}/items/GMP_GENERAL', {'status': 'DONE', 'activityId': aid}, raw=True); print('link activity of the person ->', code)
code, b = admin.call('POST', f'/training/personnel-reviews/{rid}/close', {'signatureToken': sign(admin)}, raw=True); print('close with pending ->', code, b[:90]); assert code == 409
for item in ('RULES_SAFETY', 'JOB_SPECIFIC', 'SPECIMEN', 'JOB_ASSIGNMENT'):
    admin.call('PUT', f'/training/personnel-reviews/{rid}/items/{item}', {'status': 'DONE', 'note': 'done by hand'})
r = admin.call('GET', f'/training/personnel-reviews/{rid}'); print('open items', r['openItems'], 'caps', r['capabilities'])
code, b = dco.call('POST', f'/training/personnel-reviews/{rid}/close', {'signatureToken': sign(dco)}, raw=True); print('the employee tries to close ->', code); assert code in (400, 403)
r = admin.call('POST', f'/training/personnel-reviews/{rid}/close', {'signatureToken': sign(admin)}); print('closed', r['status'], r['closedByName'])
code, b = admin.call('PUT', f'/training/personnel-reviews/{rid}/items/SPECIMEN', {'status': 'PENDING'}, raw=True); print('change after close ->', code); assert code == 409
lst = admin.call('GET', '/training/personnel-reviews?limit=5'); print('list', lst['pagination']['total'])
