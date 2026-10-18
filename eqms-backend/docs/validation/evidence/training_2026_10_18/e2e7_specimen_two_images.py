import os, sys, json, zlib, struct, urllib.request, urllib.error, datetime
sys.path.insert(0, os.path.dirname(__file__))
from api import Client, BASE
PW = os.environ['DEVPW']
def sign(c): return c.call('POST', '/auth/verify-signature', {'username': c.user['username'], 'password': PW})['signatureToken']
def step(m): print('\n== ' + m)
admin = Client('admin'); approver = Client('approver.test1'); trainee = Client('user.a.test')

def png(w=120, h=40, shade=0):
    raw = b''.join(b'\x00' + bytes([shade, shade, shade] * w) for _ in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')

def multipart(c, path, parts, params):
    b = '----e2e8c1'; nl = chr(13) + chr(10); body = b''
    for name, fn, data in parts:
        body += ('--' + b + nl + 'Content-Disposition: form-data; name="' + name + '"; filename="' + fn + '"' + nl + 'Content-Type: image/png' + nl + nl).encode() + data + nl.encode()
    body += ('--' + b + '--' + nl).encode()
    req = urllib.request.Request(BASE + path + params, data=body, method='POST')
    req.add_header('Content-Type', 'multipart/form-data; boundary=' + b); req.add_header('Authorization', 'Bearer ' + c.token)
    try:
        with c.opener.open(req) as r: return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:200]

step('specimen: the 2nd image is required')
code, body = multipart(trainee, '/training/specimen-signatures', [('file', 's1.png', png())], f'?confirmerId={approver.user["id"]}&reason=E2E')
print('one image ->', code, body); assert code == 400
step('specimen: two images')
code, sp = multipart(trainee, '/training/specimen-signatures', [('file', 's1.png', png(shade=0)), ('file2', 's2.png', png(shade=60))], f'?confirmerId={approver.user["id"]}&reason=E2E+two+images')
print(code, sp if code != 200 else (sp['versionNo'], sp['status'], sp.get('hasSecond')))
if code == 200:
    for which in (1, 2):
        c2, img = trainee.call('GET', f'/training/specimen-signatures/{sp["id"]}/image?which={which}', raw=True)
        print('image', which, c2, img[:4], len(img))
    done = approver.call('POST', f'/training/specimen-signatures/{sp["id"]}/confirm', {'signatureToken': sign(approver)})
    print('confirmed', done['status'])

step('non-working days')
d = (datetime.date.today() + datetime.timedelta(days=40))
while d.weekday() >= 5: d += datetime.timedelta(days=1)
rows = admin.call('POST', '/training/settings/non-working-days', {'day': d.isoformat(), 'name': 'E2E holiday', 'reason': 'E2E'})
print([r['day'] for r in rows if r['name'] == 'E2E holiday'])
code, b = admin.call('POST', '/training/settings/non-working-days', {'day': d.isoformat(), 'name': 'dup', 'reason': 'E2E'}, raw=True); print('dup ->', code); assert code == 409
sat = d + datetime.timedelta(days=(5 - d.weekday()) % 7)
code, b = admin.call('POST', '/training/settings/non-working-days', {'day': sat.isoformat(), 'name': 'weekend', 'reason': 'E2E'}, raw=True); print('weekend ->', code, b[:90]); assert code in (400, 409)
code, b = admin.call('DELETE', f'/training/settings/non-working-days/{d.isoformat()}', {'reason': 'E2E cleanup'}, raw=True); print('remove', code)

step('copies of an approved requirement')
req = '82ba7e2a-bfeb-42f3-9c04-47a2a5085597'; qa = '23111111-1111-1111-1111-111111111111'
log = admin.call('GET', f'/training/copies/requirement/{req}'); print('before', len(log['rows']), 'canSend', log['canSend'])
log = admin.call('POST', f'/training/copies/requirement/{req}', {'departmentIds': [qa], 'note': 'E2E copy'})
row = log['rows'][0]; print(row['departmentName'], row['sentByName'], 'canReceive(admin)', row['canReceive'])
code, b = admin.call('POST', f'/training/copies/requirement/{req}', {'departmentIds': [qa]}, raw=True); print('send again ->', code)
mine = trainee.call('GET', '/training/copy-distributions/mine'); print('mine (trainee)', [(m['objectName'], m['canReceive']) for m in mine])
code, b = approver.call('POST', f'/training/copy-distributions/{row["id"]}/receive', None, raw=True); print('other department receive ->', code); assert code == 403
r = trainee.call('POST', f'/training/copy-distributions/{row["id"]}/receive'); print('received', r)
code, b = trainee.call('POST', f'/training/copy-distributions/{row["id"]}/receive', None, raw=True); print('receive again ->', code); assert code == 409

step('preparation: the assignee reports done, a stranger cannot')
st = json.load(open(os.path.join(os.path.dirname(__file__), 'e2e_state.json')))
code, b = trainee.call('PUT', f'/training/sessions/{st["sid"]}/preparation/EQUIPMENT', {'status': 'DONE'}, raw=True); print('stranger ->', code); assert code == 403
