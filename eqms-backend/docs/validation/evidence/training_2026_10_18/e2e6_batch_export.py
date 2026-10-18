import os, sys, json, subprocess, io, zipfile
sys.path.insert(0, os.path.dirname(__file__))
from api import Client
PW = os.environ['DEVPW']
def sign(c): return c.call('POST', '/auth/verify-signature', {'username': c.user['username'], 'password': PW})['signatureToken']
def step(m): print('\n== ' + m)
admin = Client('admin'); approver = Client('approver.test1'); trainee = Client('user.a.test'); dco = Client('dco.test1')
st = json.load(open(os.path.join(os.path.dirname(__file__), 'e2e_state.json')))
aid, sid, pid, pid2 = st['aid'], st['sid'], st['pid'], st['pid2']

step('batch export for the department of dco.test1')
dept = '23111111-1111-1111-1111-111111111111'
print('department', dept)
year = 2026
pv = admin.call('GET', f'/training/record-exports/batches/preview?departmentId={dept}&year={year}')
print('preview', pv)
el = admin.call('GET', f'/training/record-exports/batches/eligible-approvers?departmentId={dept}')
print('eligible', [p['fullName'] for p in el['data']])
b = admin.call('POST', '/training/record-exports/batches', {'departmentId': dept, 'year': year, 'reason': 'E2E yearly print', 'approverUserId': approver.user['id'], 'signatureToken': sign(admin)})
print('batch', b['status'], b['personCount'])
code, body = admin.call('POST', f'/training/record-exports/batches/{b["id"]}/approve', {'signatureToken': sign(admin)}, raw=True)
print('self approve ->', code, body[:140]); assert code in (400, 403)
b = approver.call('POST', f'/training/record-exports/batches/{b["id"]}/approve', {'signatureToken': sign(approver)})
print('approved', b['status'], b['personCount'], b['sizeBytes'])
code, z = admin.call('GET', f'/training/record-exports/batches/{b["id"]}/download', raw=True)
print('download', code, len(z))
names = zipfile.ZipFile(io.BytesIO(z)).namelist()
print('zip entries', names)
mine = approver.call('GET', '/training/me/approvals')
print('approvals visible', len(mine['data']) if isinstance(mine, dict) else len(mine))
