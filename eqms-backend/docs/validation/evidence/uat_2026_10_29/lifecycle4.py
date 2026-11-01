"""DEV UAT, 2026-10-30: the Training Matrix lifecycle through the API (create, save rows, submit, reject, resubmit, approve, upgrade). The password comes from DEVPW and is never written.
The matrix is made for the department "Warehouse", which has no matrix before this run; it ends Effective (version 1) with a Draft version 2 from the upgrade. Not repeatable: a department has one matrix.
Run with plain `python`. Exit code 1 when a check fails."""
import os, sys, json, subprocess
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'training_2026_10_18'))
from api import Client

PW = os.environ['DEVPW']
results = []


def check(name, ok, detail=''):
    results.append((name, ok, str(detail)[:300]))
    print(('PASS  ' if ok else 'FAIL  ') + name + ((' -- ' + str(detail)[:300]) if (detail and not ok) else ''))


def sign(c):
    return c.call('POST', '/auth/verify-signature', {'username': c.user['username'], 'password': PW})['signatureToken']


def attempt(c, method, path, body=None):
    code, payload = c.call(method, path, body, raw=True)
    try:
        data = json.loads(payload) if payload and payload[:1] in (b'{', b'[') else {}
    except Exception:
        data = {}
    return code, data, payload[:300].decode('utf-8', 'ignore')


def sql(q):
    out = subprocess.run(['docker', 'exec', '-i', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-t', '-A', '-F', '|', '-c', q], capture_output=True, text=True, check=True).stdout
    return [r.split('|') for r in out.strip().splitlines() if r.strip()]


admin = Client('admin')
approver = Client('approver.test1')
trainee = Client('trainee.test1')


def main():
    dep = sql("select id from departments where name='Warehouse'")[0][0]
    have = sql(f"select v.id from training_matrices m join training_matrix_versions v on v.matrix_id=m.id where m.department_id='{dep}' and v.version_no=1 and v.status='DRAFT'")
    if sql(f"select count(*) from training_matrices where department_id='{dep}'")[0][0] != '0' and not have:
        check('MX0 Warehouse has no matrix yet, or only the Draft of an earlier run of this script', False, 'a matrix exists already')
        return
    if have:
        print('   resuming with the Draft version 1 of the Warehouse matrix made by the first run')
        d = admin.call('GET', f'/training/matrix-versions/{have[0][0]}')
        vid = d.get('id')
        check('MX2 (resumed) the Draft version 1 of the Warehouse matrix', d.get('status') == 'DRAFT' and d.get('versionNo') == 1, d.get('status'))
    else:
        code, d, t = attempt(trainee, 'POST', '/training/matrices', {'departmentId': dep})
        check('MX1 a person without training.matrix.manage cannot create a matrix', code in (401, 403), (code, t))
        code, d, t = attempt(admin, 'POST', '/training/matrices', {'departmentId': dep})
        check('MX2 the matrix is created with a Draft version 1', code == 200 and d.get('status') == 'DRAFT' and d.get('versionNo') == 1, (code, t))
        vid = d.get('id')
    print('   version keys:', sorted(d.keys())[:26], '| rows at creation:', len(d.get('rows') or []))
    code, d2, t = attempt(admin, 'POST', '/training/matrices', {'departmentId': dep})
    check('MX3 a department has only one matrix (TRAINING_MATRIX_EXISTS)', code == 409 and 'MATRIX_EXISTS' in t, (code, t))
    rows = [{'group': r.get('group'), 'topicText': r.get('topicText'), 'documentId': r.get('documentId'), 'annualRequired': r.get('annualRequired'), 'note': r.get('note'),
             'positionIds': [c for c in (r.get('positionIds') or [])], 'allEmployees': r.get('allEmployees'), 'locked': r.get('locked')} for r in (d.get('rows') or [])]
    if not rows:
        code, d2, t = attempt(admin, 'POST', f'/training/matrix-versions/{vid}/submit', {'version': d.get('version'), 'signatureToken': sign(admin), 'approverUserId': approver.user['id']})
        check('MX4 a matrix without rows cannot be submitted (TRAINING_MATRIX_EMPTY)', code == 409 and 'MATRIX_EMPTY' in t, (code, t))
    rows.append({'group': 'DEPARTMENT_GENERAL', 'topicText': 'UAT-2026 matrix topic', 'annualRequired': False, 'allEmployees': True, 'positionIds': [], 'locked': False})
    code, d2, t = attempt(admin, 'PUT', f'/training/matrix-versions/{vid}', {'version': d.get('version'), 'changeReason': 'UAT-2026 first version', 'rows': rows})
    print('   save:', code, t[:200] if code != 200 else 'ok')
    check('MX5 the rows are saved in the Draft', code == 200 and any('UAT-2026 matrix topic' == (r.get('topicText')) for r in (d2.get('rows') or [])), (code, t))
    ver = d2.get('version') or d.get('version')
    code, d3, t = attempt(admin, 'POST', f'/training/matrix-versions/{vid}/submit', {'version': ver, 'approverUserId': approver.user['id']})
    check('MX6 submitting needs an electronic signature', code == 400, (code, t))
    code, d3, t = attempt(admin, 'POST', f'/training/matrix-versions/{vid}/submit', {'version': ver, 'signatureToken': sign(admin), 'approverUserId': admin.user['id']})
    check('MX7 the preparer cannot be the approver', code >= 400, (code, t))
    code, d3, t = attempt(admin, 'POST', f'/training/matrix-versions/{vid}/submit', {'version': ver, 'signatureToken': sign(admin), 'approverUserId': approver.user['id']})
    check('MX8 the matrix is submitted: Pending Approval', code == 200 and d3.get('status') == 'PENDING_APPROVAL', (code, t))
    ver = d3.get('version')
    code, d4, t = attempt(admin, 'PUT', f'/training/matrix-versions/{vid}', {'version': ver, 'changeReason': 'x', 'rows': rows})
    check('MX9 a version that waits for approval cannot be edited', code == 409, (code, t))
    code, d4, t = attempt(admin, 'POST', f'/training/matrix-versions/{vid}/approve', {'version': ver, 'signatureToken': sign(admin)})
    check('MX10 the preparer cannot approve their own matrix', code >= 400, (code, t))
    code, d4, t = attempt(approver, 'POST', f'/training/matrix-versions/{vid}/reject', {'version': ver, 'reason': ''})
    check('MX11 a rejection needs a reason', code == 400, (code, t))
    code, d4, t = attempt(approver, 'POST', f'/training/matrix-versions/{vid}/reject', {'version': ver, 'reason': 'UAT-2026 sent back'})
    check('MX12 the approver rejects with a reason: back to Draft with the reason kept', code == 200 and d4.get('status') == 'DRAFT' and 'UAT-2026' in str(d4.get('rejectReason')), (code, t))
    ver = d4.get('version')
    code, d5, t = attempt(admin, 'POST', f'/training/matrix-versions/{vid}/submit', {'version': ver, 'signatureToken': sign(admin), 'approverUserId': approver.user['id']})
    check('MX13 the matrix is submitted again', code == 200 and d5.get('status') == 'PENDING_APPROVAL', (code, t))
    ver = d5.get('version')
    code, d6, t = attempt(approver, 'POST', f'/training/matrix-versions/{vid}/approve', {'version': ver})
    check('MX14 approving needs an electronic signature', code == 400, (code, t))
    code, d6, t = attempt(approver, 'POST', f'/training/matrix-versions/{vid}/approve', {'version': ver, 'signatureToken': sign(approver)})
    check('MX15 the approver signs: the version is Effective', code == 200 and d6.get('status') == 'EFFECTIVE', (code, t))
    code, d7, t = attempt(approver, 'POST', f'/training/matrix-versions/{vid}/approve', {'version': d6.get('version'), 'signatureToken': sign(approver)})
    check('MX16 an effective version cannot be approved again', code == 409, (code, t))
    mid = d6.get('matrixId')
    code, d8, t = attempt(admin, 'POST', f'/training/matrices/{mid}/upgrade')
    check('MX17 Upgrade makes a Draft version 2 of the effective matrix', code == 200 and d8.get('status') == 'DRAFT' and d8.get('versionNo') == 2, (code, t))
    code, d9, t = attempt(admin, 'POST', f'/training/matrices/{mid}/upgrade')
    check('MX18 a second upgrade while a draft exists is refused', code == 409, (code, t))
    code, payload = admin.call('GET', f'/training/matrix-versions/{vid}/export?format=pdf', raw=True)
    check('MX19 the effective version exports as a PDF', code == 200 and payload[:4] == b'%PDF', (code, payload[:40]))
    code, payload = admin.call('GET', f'/training/matrix-versions/{vid}/export?format=docx', raw=True)
    check('MX20 the effective version exports as a Word file', code == 200 and payload[:2] == b'PK', (code, payload[:40]))
    code, d9, t = attempt(admin, 'GET', f"/training/matrix-versions/{vid}/compare/{d8.get('id')}")
    check('MX21 two versions can be compared', code == 200, (code, t))


try:
    main()
except BaseException as e:
    check('Matrix: ran to the end', False, repr(e)[:300])

ok = [r for r in results if r[1] is True]
bad = [r for r in results if r[1] is False]
print(f'\n{len(ok)} passed, {len(bad)} failed (of {len(results)})')
for r in bad:
    print('  FAIL', r[0], '--', r[2])
sys.exit(1 if bad else 0)
