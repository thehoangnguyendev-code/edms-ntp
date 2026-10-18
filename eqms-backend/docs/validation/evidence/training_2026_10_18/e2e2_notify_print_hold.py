import os, sys, json, datetime
sys.path.insert(0, os.path.dirname(__file__))
from api import Client
PW = os.environ['DEVPW']
def sign(c):
    return c.call('POST', '/auth/verify-signature', {'username': c.user['username'], 'password': PW})['signatureToken']
def step(m): print('\n== ' + m)
admin = Client('admin'); approver = Client('approver.test1'); trainee = Client('user.a.test'); dco = Client('dco.test1')
st = json.load(open(os.path.join(os.path.dirname(__file__), 'e2e_state.json')))
aid, sid, pid = st['aid'], st['sid'], st['pid']

step('second participant (dco.test1)')
a = admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': [dco.user['id']], 'reason': 'E2E'})
pid2 = [p['id'] for p in a['participants'] if p['personUserId'] == dco.user['id']][0]
print('p2', pid2[:8])
print('confirm list again'); admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'E2E'})

step('designate and confirm content')
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': approver.user['id']})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': trainee.user['id']})
approver.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(approver)})
a = trainee.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(trainee)})
print('content confirmed', a['status'])

step('notify')
a = admin.call('GET', f'/training/activities/{aid}')
print('blockers', a['capabilities'].get('notifyBlockers'))
a = admin.call('POST', f'/training/activities/{aid}/notify', {'version': a['version']})
print('status', a['status'], 'caps printPaper', a['capabilities'].get('printPaper'), 'rollCall', a['capabilities'].get('rollCall'))

step('print the paper pack')
code, pdf = admin.call('POST', f'/training/sessions/{sid}/paper-pack', {}, raw=True)
print('first print', code, pdf[:5], len(pdf))
assert pdf[:4] == b'%PDF'
open(os.path.join(os.path.dirname(__file__), 'pack1.pdf'), 'wb').write(pdf)
code, body = admin.call('POST', f'/training/sessions/{sid}/paper-pack', {}, raw=True)
print('reprint without reason ->', code, body[:160])
assert code == 400
code, pdf2 = admin.call('POST', f'/training/sessions/{sid}/paper-pack', {'reason': 'Lost the first copy'}, raw=True)
print('reprint with reason', code, len(pdf2))
print([ (p['packCode'], p['copyNo'], p['pageCount'], p['peopleCount'], p.get('reason')) for p in admin.call('GET', f'/training/activities/{aid}/paper-packs')])

step('hold the session')
a = admin.call('POST', f'/training/sessions/{sid}/hold', {})
print('status', a['status'], [s['status'] for s in a['sessions']], 'rollCall', a['capabilities'].get('rollCall'), 'transcribe', a['capabilities'].get('transcribe'))
json.dump({'aid': aid, 'sid': sid, 'pid': pid, 'pid2': pid2}, open(os.path.join(os.path.dirname(__file__), 'e2e_state.json'), 'w'))
