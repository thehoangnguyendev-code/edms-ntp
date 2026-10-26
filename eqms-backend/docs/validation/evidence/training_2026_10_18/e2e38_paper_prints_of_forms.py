"""DEV: the paper prints of the forms that are signed by hand: APD.0024 (job assignment draft) and APD.0108 (self-reading list of a session). Checks: the data is written and the signatures are not;
the copy is numbered and the first line says so; a reprint needs a reason (400) and is the next copy; a job assignment that is effective cannot be printed for signing (409); the prints are recorded
(table, Audit Trail); APD.0108 copies are in the list of packs; a person without the permission is refused. The password comes from DEVPW (never written)."""
import os, sys, io, re, zipfile, subprocess, json
sys.path.insert(0, os.path.dirname(__file__))
from api import Client
from e2e21_matrix import check, admin, attempt, results


def sql(q):
    return subprocess.run(['docker', 'exec', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-Atc', q], capture_output=True, text=True).stdout.strip()


def words(docx):
    z = zipfile.ZipFile(io.BytesIO(docx))
    xml = ''.join(z.read(n).decode('utf8') for n in z.namelist() if re.match(r'word/(document|header\d*|footer\d*)\.xml$', n))
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', xml))


print('== APD.0024')
person = Client('dco.test1')
pid = person.user['id']
position = sql(f"select p.id from positions p join departments d on d.id = p.department_id where p.is_active order by p.name limit 1")
job = sql(f"select id from training_job_assignments where person_user_id = '{pid}' and status in ('DRAFT', 'PENDING_RECEIVER') limit 1")
if not job:
    made = admin.call('POST', '/training/job-assignments', {'personUserId': pid, 'positionId': position, 'directSuperiorTitle': 'E2E-TEST Head of QA', 'subordinateTitles': 'none', 'substituteTitle': 'E2E-TEST deputy',
                                                          'jurisdiction': 'E2E-TEST jurisdiction', 'duties': [{'responsibility': 'E2E-TEST duty', 'description': 'E2E-TEST description'}]})
    job = made['id']
before = int(sql(f"select count(*) from training_job_prints where assignment_id = '{job}'") or 0)
first = {'format': 'docx'} if before == 0 else {'format': 'docx', 'reason': 'E2E-TEST another run'}
code, body = admin.call('POST', f'/training/job-assignments/{job}/paper', first, raw=True)
check('1 a paper print of a draft job assignment', code == 200 and body[:2] == b'PK', (code, body[:200]))
t = words(body) if code == 200 else ''
check('2 the data is written and the signatures are not', 'E2E-TEST jurisdiction' in t and 'Electronically Signed' not in t, t[:300])
check('3 the first line is the code of the copy', 'Controlled print: APD.0024/' in t and f'/P{before + 1}' in t, t[:200])
code, body, raw = attempt(admin, 'POST', f'/training/job-assignments/{job}/paper', {'format': 'docx'})
check('4 a reprint needs a reason (400)', code == 400, (code, raw))
code, body = admin.call('POST', f'/training/job-assignments/{job}/paper', {'format': 'docx', 'reason': 'E2E-TEST torn'}, raw=True)
check('5 a reprint with a reason is the next copy', code == 200 and f'/P{before + 2}' in words(body), code)
code, body = admin.call('POST', f'/training/job-assignments/{job}/paper', {'format': 'pdf', 'reason': 'E2E-TEST third'}, raw=True)
check('6 the PDF of a paper print', code == 200 and body[:4] == b'%PDF', code)
check('7 the prints are recorded', sql(f"select count(*) from training_job_prints where assignment_id = '{job}'") == str(before + 3), '')
effective = sql("select id from training_job_assignments where status = 'EFFECTIVE' limit 1")
code, body, raw = attempt(admin, 'POST', f'/training/job-assignments/{effective}/paper', {'format': 'docx'})
check('8 an effective job assignment is not printed for signing (409)', code == 409, (code, raw))
outsider = Client('trainee.test1')
code, body, raw = attempt(outsider, 'POST', f'/training/job-assignments/{job}/paper', {'format': 'docx'})
check('9 a person without the permission is refused', code in (401, 403), (code, raw))
check('10 the Audit Trail has the prints', int(sql("select count(*) from audit_logs where action = 'TRAINING_JOB_ASSIGNMENT_PRINTED_ON_PAPER' and created_at > now() - interval '10 minutes'") or 0) >= 3, '')

print('== APD.0108')
from e2e21_matrix import sign, qa, trainee, TODAY, body_of
spec = dict(name='paper self-reading', kind='PERIODIC', reason='SOP_VERSION', method='SELF_READING', assessment='SELF_READING_CONFIRMATION')
made = admin.call('POST', '/training/activities', {'kind': 'PERIODIC', 'kindReason': 'SOP_VERSION', 'trainingTitle': 'E2E-TEST paper self-reading'})
aid = made['id']
sid = admin.call('POST', f'/training/activities/{aid}/sessions', body_of(spec))['sessions'][0]['id']
admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': [trainee.user['id']], 'reason': 'E2E-TEST'})
admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'E2E-TEST'})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': qa.user['id']})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': trainee.user['id']})
admin.call('POST', f'/training/activities/{aid}/material-links', {'title': 'E2E-TEST material', 'url': 'https://example.com/e2e'})
qa.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(qa)})
trainee.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(trainee)})
admin.call('POST', f'/training/activities/{aid}/notify', {'version': admin.call('GET', f'/training/activities/{aid}')['version'], 'signatureToken': sign(admin)})
if sid:
    code, body = admin.call('POST', f'/training/sessions/{sid}/self-reading-list/paper', {'format': 'docx'}, raw=True)
    first = code == 200
    if code == 200:
        t = words(body)
        check('11 first paper print of the self-reading list', 'Controlled print:' in t and '/L1' in t and 'Electronically Signed' not in t, t[:300])
    else:
        # a copy was printed before (earlier run): the next one needs a reason
        code, body = admin.call('POST', f'/training/sessions/{sid}/self-reading-list/paper', {'format': 'docx', 'reason': 'E2E-TEST again'}, raw=True)
        check('11 a paper print of the self-reading list (a reprint, with a reason)', code == 200 and 'Controlled print:' in words(body), code)
    code, body, raw = attempt(admin, 'POST', f'/training/sessions/{sid}/self-reading-list/paper', {'format': 'docx'})
    check('12 a reprint needs a reason (400)', code == 400, (code, raw))
    act = sql(f"select activity_id from training_sessions where id = '{sid}'")
    packs = admin.call('GET', f'/training/activities/{act}/paper-packs')
    check('13 the copies are in the list of packs', any(p['packKind'] == 'SELFREAD' for p in packs), [p['packCode'] for p in packs])
else:
    print('no open self-reading session on DEV: checks 11 to 13 are not run')
print(sum(1 for r in results if r[1]), 'of', len(results), 'checks passed')
