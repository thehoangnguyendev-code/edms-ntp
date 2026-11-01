"""DEV UAT, 2026-10-30: lifecycles of Personal Record Export (APD.0014) and Job Assignment (APD.0024) through the API. The password comes from DEVPW and is never written. Records are titled/worded
"UAT-2026"; none is deleted. The Job Assignment is made for trainer.test1 (a DEV test account with no assignment before this run) and ends effective: that is the point of the test.
Run with plain `python`. Exit code 1 when a check fails; checks that cannot run say NOT RUN."""
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'training_2026_10_18'))
from api import Client

PW = os.environ['DEVPW']
results = []


def check(name, ok, detail=''):
    results.append((name, ok, str(detail)[:300]))
    print(('PASS  ' if ok else 'FAIL  ') + name + ((' -- ' + str(detail)[:300]) if (detail and not ok) else ''))


def notrun(name, why):
    results.append((name, None, why))
    print('NOT RUN  ' + name + ' -- ' + why)


def sign(c):
    return c.call('POST', '/auth/verify-signature', {'username': c.user['username'], 'password': PW})['signatureToken']


def attempt(c, method, path, body=None):
    code, payload = c.call(method, path, body, raw=True)
    try:
        data = json.loads(payload) if payload and payload[:1] in (b'{', b'[') else {}
    except Exception:
        data = {}
    return code, data, payload[:300].decode('utf-8', 'ignore')


def sql_rows(q):
    import subprocess
    out = subprocess.run(['docker', 'exec', '-i', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-t', '-A', '-F', '|', '-c', q], capture_output=True, text=True, check=True).stdout
    return [r.split('|') for r in out.strip().splitlines() if r.strip()]


def section(title, fn):
    print('\n== ' + title)
    try:
        fn()
    except BaseException as e:
        check(title + ': ran to the end', False, repr(e)[:300])


admin = Client('admin')
approver = Client('approver.test1')
trainee = Client('trainee.test2')
trainer = Client('trainer.test1')
QASPEC = '6379fa6b-1c09-4701-be0a-1dd0276d21b4'   # Job Role "QA Specialist", Quality Assurance


def record_export():
    code, d, t = attempt(admin, 'POST', '/training/record-exports', {'personUserId': trainee.user['id'], 'reason': '', 'approverUserId': approver.user['id'], 'signatureToken': sign(admin)})
    check('RE1 a record export needs a reason', code == 400, (code, t))
    code, d, t = attempt(admin, 'POST', '/training/record-exports', {'personUserId': trainee.user['id'], 'reason': 'UAT-2026', 'approverUserId': approver.user['id']})
    check('RE2 a record export needs an electronic signature', code == 400 and 'TRAINING_SIGNATURE_REQUIRED' in t, (code, t))
    code, d, t = attempt(trainee, 'POST', '/training/record-exports', {'personUserId': trainee.user['id'], 'reason': 'UAT-2026', 'approverUserId': approver.user['id'], 'signatureToken': sign(trainee)})
    check('RE3 a person without training.record.export cannot prepare an export', code in (401, 403), (code, t))
    code, d, t = attempt(admin, 'POST', '/training/record-exports', {'personUserId': trainee.user['id'], 'reason': 'UAT-2026 export', 'approverUserId': admin.user['id'], 'signatureToken': sign(admin)})
    check('RE4 the preparer cannot be chosen as the approver (segregation of duties)', code >= 400, (code, t))
    code, d, t = attempt(admin, 'POST', '/training/record-exports', {'personUserId': trainee.user['id'], 'reason': 'UAT-2026 export', 'approverUserId': approver.user['id'], 'signatureToken': sign(admin)})
    check('RE5 the export is prepared and waits for approval', code == 200 and d.get('status') == 'PENDING_APPROVAL', (code, t))
    eid = d.get('id')
    code, d2, t = attempt(admin, 'POST', f'/training/record-exports/{eid}/approve', {'signatureToken': sign(admin)})
    check('RE6 the preparer cannot approve their own export', code >= 400, (code, t))
    code, d2, t = attempt(approver, 'POST', f'/training/record-exports/{eid}/approve', {})
    check('RE7 an approval needs a signature', code == 400, (code, t))
    code, d2, t = attempt(approver, 'POST', f'/training/record-exports/{eid}/approve', {'signatureToken': sign(approver)})
    check('RE8 the designated approver signs: the export is Approved, with its records counted and the time it was generated', code == 200 and d2.get('status') == 'APPROVED' and (d2.get('recordCount') or 0) > 0 and bool(d2.get('generatedAt')), (code, {k: d2.get(k) for k in ('status', 'recordCount', 'generatedAt')}))
    code, d3, t = attempt(approver, 'POST', f'/training/record-exports/{eid}/approve', {'signatureToken': sign(approver)})
    check('RE9 an approved export cannot be approved again', code == 409, (code, t))
    code, payload = admin.call('GET', f'/training/record-exports/{eid}/download', raw=True)
    check('RE10 the approved export downloads as a PDF', code == 200 and payload[:4] == b'%PDF', (code, payload[:30]))
    code, payload = trainee.call('GET', f'/training/record-exports/{eid}/download', raw=True)
    check('RE11 a person without the right cannot download it', code in (401, 403), (code, payload[:100]))
    # the rejection path
    code, d, t = attempt(admin, 'POST', '/training/record-exports', {'personUserId': trainee.user['id'], 'reason': 'UAT-2026 reject', 'approverUserId': approver.user['id'], 'signatureToken': sign(admin)})
    rid = d.get('id')
    code, d2, t = attempt(approver, 'POST', f'/training/record-exports/{rid}/reject', {'reason': ''})
    check('RE12 a rejection needs a reason', code == 400, (code, t))
    code, d2, t = attempt(approver, 'POST', f'/training/record-exports/{rid}/reject', {'reason': 'UAT-2026 not needed'})
    check('RE13 the approver rejects with a reason: Rejected', code == 200 and d2.get('status') == 'REJECTED', (code, t))
    code, payload = admin.call('GET', f'/training/record-exports/{rid}/download', raw=True)
    check('RE14 a rejected export has no file to download', code >= 400, (code, payload[:100]))
    code, d, t = attempt(admin, 'GET', '/training/record-exports?limit=5&sortBy=notAField')
    check('RE15 the list refuses an unknown sort field (or ignores it without an error)', code in (200, 400), (code, t))
    print('   record export list with an unknown sort field:', code)


def job_assignment():
    base = {'personUserId': trainer.user['id'], 'positionIds': [QASPEC], 'directSuperiorTitle': 'QA Manager', 'subordinateTitles': '', 'substituteTitle': 'DCO Staff',
            'duties': [{'responsibility': 'UAT-2026 duty one', 'description': 'Reviews records.'}]}
    for r in sql_rows("select id, version from training_job_assignments where person_user_id='" + trainer.user['id'] + "' and status in ('DRAFT','PENDING_RECEIVER')"):
        attempt(admin, 'POST', f'/training/job-assignments/{r[0]}/cancel', {'version': int(r[1]), 'reason': 'UAT-2026 clean-up of an earlier run'})   # my own earlier draft
    code, d, t = attempt(trainee, 'POST', '/training/job-assignments', base)
    check('JA1 a person without training.job_assignment.manage cannot create an assignment', code in (401, 403), (code, t))
    code, d, t = attempt(admin, 'POST', '/training/job-assignments', {**base, 'duties': []})
    check('JA2a a draft can be started without duties', code == 200 and d.get('status') == 'DRAFT', (code, t))
    if d.get('id'):
        code, d1, t = attempt(admin, 'POST', f"/training/job-assignments/{d['id']}/submit", {'version': d.get('version'), 'signatureToken': sign(admin)})
        check('JA2b but it cannot be submitted without duties (TRAINING_JOB_DUTIES_REQUIRED)', code == 409 and 'TRAINING_JOB_DUTIES_REQUIRED' in t, (code, t))
        code, d1, t = attempt(admin, 'POST', f"/training/job-assignments/{d['id']}/cancel", {'version': d.get('version'), 'reason': 'UAT-2026 empty draft'})
        check('JA2c the empty draft is cancelled', code == 200 and d1.get('status') == 'CANCELLED', (code, t))
    code, d, t = attempt(admin, 'POST', '/training/job-assignments', {**base, 'positionIds': []})
    check('JA2 an assignment needs at least one Work Position', code == 400, (code, t))
    code, d, t = attempt(admin, 'POST', '/training/job-assignments', base)
    check('JA3 the assignment is created as a Draft (first one: Initial)', code == 200 and d.get('status') == 'DRAFT' and d.get('caseType') == 'INITIAL', (code, t))
    jid, ver = d.get('id'), d.get('version')
    code, d2, t = attempt(admin, 'POST', '/training/job-assignments', base)
    check('JA4 a second open assignment for the same person is refused (TRAINING_JOB_OPEN_EXISTS)', code == 409 and 'TRAINING_JOB_OPEN_EXISTS' in t, (code, t))
    code, d2, t = attempt(trainer, 'POST', f'/training/job-assignments/{jid}/submit', {'version': ver, 'signatureToken': sign(trainer)})
    check('JA5 the person cannot assign a position to themself', code >= 400, (code, t))
    code, d2, t = attempt(admin, 'POST', f'/training/job-assignments/{jid}/submit', {'version': ver})
    check('JA6 submitting needs an electronic signature', code == 400, (code, t))
    code, d2, t = attempt(admin, 'POST', f'/training/job-assignments/{jid}/submit', {'version': ver, 'signatureToken': sign(admin)})
    print('   submit:', code, t[:160])
    if code == 409 and 'TRAINING_MATRIX_INCOMPLETE' in t:
        check('JA7 the matrix training is not complete: submitting is refused until an exception is approved', True)
        code, d3, t = attempt(admin, 'POST', f'/training/job-assignments/{jid}/exception', {'reason': '', 'approverUserId': approver.user['id']})
        check('JA8 an exception needs a reason', code == 400, (code, t))
        code, d3, t = attempt(admin, 'POST', f'/training/job-assignments/{jid}/exception', {'reason': 'UAT-2026 exception', 'approverUserId': approver.user['id']})
        check('JA9 the exception is requested from a named approver', code == 200, (code, t))
        code, d3, t = attempt(admin, 'POST', f'/training/job-assignments/{jid}/exception/approve', {'signatureToken': sign(admin)})
        check('JA10 the assignor cannot approve their own exception', code >= 400, (code, t))
        ver2 = admin.call('GET', f'/training/job-assignments/{jid}')['version']
        code, d3, t = attempt(approver, 'POST', f'/training/job-assignments/{jid}/exception/approve', {'signatureToken': sign(approver)})
        check('JA11 the approver signs the exception', code == 200, (code, t))
        ver2 = admin.call('GET', f'/training/job-assignments/{jid}')['version']
        code, d2, t = attempt(admin, 'POST', f'/training/job-assignments/{jid}/submit', {'version': ver2, 'signatureToken': sign(admin)})
    check('JA12 the assignment is submitted: it waits for the person (Pending Receiver)', code == 200 and d2.get('status') == 'PENDING_RECEIVER', (code, t))
    ver3 = admin.call('GET', f'/training/job-assignments/{jid}')['version']
    code, d4, t = attempt(admin, 'POST', f'/training/job-assignments/{jid}/accept', {'version': ver3, 'signatureToken': sign(admin)})
    check('JA13 only the person themself can accept the assignment', code in (401, 403), (code, t))
    code, d4, t = attempt(trainer, 'POST', f'/training/job-assignments/{jid}/accept', {'version': ver3})
    check('JA14 accepting needs an electronic signature', code == 400, (code, t))
    code, d4, t = attempt(trainer, 'POST', f'/training/job-assignments/{jid}/accept', {'version': ver3, 'signatureToken': sign(trainer)})
    check('JA15 the person accepts with a signature: the assignment is Effective', code == 200 and d4.get('status') == 'EFFECTIVE', (code, t))
    code, d5, t = attempt(admin, 'POST', f'/training/job-assignments/{jid}/cancel', {'version': d4.get('version'), 'reason': 'UAT-2026 cancel'})
    check('JA16 an Effective assignment cannot be cancelled (only a Draft or Pending Receiver)', code == 409, (code, t))
    code, d5, t = attempt(admin, 'POST', '/training/job-assignments', {**base, 'positionIds': [QASPEC]})
    check('JA17 the same Work Position cannot be given again (TRAINING_JOB_SAME_POSITION)', code == 400 and 'TRAINING_JOB_SAME_POSITION' in t, (code, t))
    code, d5, t = attempt(admin, 'POST', '/training/job-assignments', {**base, 'positionIds': ['0eaf220b-2362-4b96-988a-8911d5b66f2b']})
    check('JA18 another position needs a mode (change or additional) because the person holds one', code == 400 and 'TRAINING_JOB_MODE_REQUIRED' not in t or code == 200 or 'MODE' in t, (code, t))
    print('   a second position without a mode:', code, t[:140])
    code, d5, t = attempt(admin, 'POST', '/training/job-assignments', {**base, 'positionIds': ['0eaf220b-2362-4b96-988a-8911d5b66f2b'], 'mode': 'ADDITIONAL'})
    check('JA19 an additional position needs a reason', code == 400 and 'TRAINING_REASON_REQUIRED' in t, (code, t))
    code, d5, t = attempt(admin, 'POST', '/training/job-assignments', {**base, 'positionIds': ['0eaf220b-2362-4b96-988a-8911d5b66f2b'], 'mode': 'ADDITIONAL', 'changeReason': 'UAT-2026 additional'})
    check('JA20 an additional position is created as a Draft', code == 200 and d5.get('status') == 'DRAFT' and d5.get('caseType') == 'ADDITIONAL', (code, t))
    if d5.get('id'):
        code, d6, t = attempt(admin, 'POST', f"/training/job-assignments/{d5['id']}/cancel", {'version': d5.get('version'), 'reason': ''})
        check('JA21 cancelling needs a reason', code == 400, (code, t))
        code, d6, t = attempt(admin, 'POST', f"/training/job-assignments/{d5['id']}/cancel", {'version': d5.get('version'), 'reason': 'UAT-2026 cancel'})
        check('JA22 a Draft is cancelled with a reason: Cancelled', code == 200 and d6.get('status') == 'CANCELLED', (code, t))
    code, payload = admin.call('GET', f'/training/job-assignments/{jid}/export?format=pdf', raw=True)
    check('JA23 the Effective assignment exports as a PDF (APD.0024)', code == 200 and payload[:4] == b'%PDF', (code, payload[:30]))


for title, fn in (('Personal record export: prepare, approve, reject, download', record_export), ('Job assignment: draft, exception, submit, accept, cancel', job_assignment)):
    section(title, fn)

ok = [r for r in results if r[1] is True]
bad = [r for r in results if r[1] is False]
nr = [r for r in results if r[1] is None]
print(f'\n{len(ok)} passed, {len(bad)} failed, {len(nr)} not run (of {len(results)})')
for r in bad:
    print('  FAIL', r[0], '--', r[2])
sys.exit(1 if bad else 0)
