import os, sys, json, uuid
sys.path.insert(0, os.path.dirname(__file__))
from api import Client
PW = os.environ['DEVPW']
def sign(c): return c.call('POST', '/auth/verify-signature', {'username': c.user['username'], 'password': PW})['signatureToken']
def step(m): print('\n== ' + m)
admin = Client('admin'); approver = Client('approver.test1'); trainee = Client('user.a.test'); dco = Client('dco.test1')
st = json.load(open(os.path.join(os.path.dirname(__file__), 'e2e_state.json')))
aid, sid, pid, pid2 = st['aid'], st['sid'], st['pid'], st['pid2']

step('quick roll-call: only the first participant, signed once')
a = admin.call('POST', f'/training/sessions/{sid}/roll-call', {'present': [pid], 'absent': [], 'signatureToken': sign(admin)})
print([(p['fullName'], p['state'], p.get('signMode')) for p in a['participants']])

step('roll-call again for the same person must be refused')
code, body = admin.call('POST', f'/training/sessions/{sid}/roll-call', {'present': [pid], 'absent': [], 'signatureToken': sign(admin)}, raw=True)
print(code, body[:140]); assert code == 409

step('scan evidence')
pdf = open(os.path.join(os.path.dirname(__file__), 'pack1.pdf'), 'rb').read()
files = admin.upload(f'/training/activities/{aid}/paper-evidence', 'file', 'signed-sheet.pdf', pdf, 'application/pdf', '?kind=ATTENDANCE_SHEET')
ev = files['evidence'][0]
print('evidence', ev['id'][:8], ev['kind'], ev['originalName'])

step('transcription typed by admin')
key = str(uuid.uuid4())
body = {'evidenceId': ev['id'], 'idempotencyKey': key, 'lines': [{'participantId': pid2, 'state': 'ATTENDED', 'scoreObtained': 18, 'scoreMax': 20}]}
t = admin.call('POST', f'/training/sessions/{sid}/transcriptions', body)
print(t['status'], len(t['lines']), 'late', t.get('lateReason'))
t_again = admin.call('POST', f'/training/sessions/{sid}/transcriptions', body)
print('same key returns the same one:', t_again['id'] == t['id'])
code, b = admin.call('POST', f'/training/sessions/{sid}/transcriptions', {**body, 'idempotencyKey': str(uuid.uuid4())}, raw=True)
print('second open one refused', code, b[:120]); assert code == 409

step('the typist cannot verify; a different person can')
code, b = admin.call('POST', f'/training/transcriptions/{t["id"]}/verify', {'signatureToken': sign(admin)}, raw=True)
print('typist verify ->', code, b[:140]); assert code in (400, 403)
v = approver.call('POST', f'/training/transcriptions/{t["id"]}/verify', {'signatureToken': sign(approver)})
print('verified', v['status'], v['verifiedByName'])

step('result applied by the server')
a = admin.call('GET', f'/training/activities/{aid}')
print([(p['fullName'], p['state'], p['result'], p.get('signMode')) for p in a['participants']])
json.dump({**st}, open(os.path.join(os.path.dirname(__file__), 'e2e_state.json'), 'w'))
