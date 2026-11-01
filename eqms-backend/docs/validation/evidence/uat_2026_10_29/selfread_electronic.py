"""DEV check, 2026-10-31, of the self-reading that is confirmed by electronic signature only (owner decision TRAINING-SELFREAD-ELECTRONIC-2026-10-31). On TRN/QA/26-780 (IN_PROGRESS, a self-reading session already held, three people still
INVITED): the trainer cannot record that a person read (Attended / Online), cannot record Absent either (the owner removed Did Not Read on 2026-10-31: every invited person must read), cannot correct it; the filled list APD.0108 is downloaded (one file for each department);
the paper print of the list no longer exists. Password from DEVPW, never written. Plain `python`. One person (User A (DCO Test)) stays Absent afterwards: a record that is not removed."""
import os, sys, subprocess
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'training_2026_10_18'))
from api import Client

results = []
def check(name, ok, detail=''):
    results.append(bool(ok)); print(('PASS  ' if ok else 'FAIL  ') + name + ((' -- ' + str(detail)[:300]) if (detail and not ok) else ''))
def sql(q):
    out = subprocess.run(['docker', 'exec', '-i', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-t', '-A', '-F', '|', '-c', q], capture_output=True, text=True).stdout
    return [r.split('|') for r in out.strip().splitlines() if r.strip()]

ACT, SES = sql("select a.id, s.id from training_activities a join training_sessions s on s.activity_id=a.id where a.training_number='TRN/QA/26-780'")[0]
PID = sql("select id from training_participants where session_id='%s' and full_name='User A (DCO Test)'" % SES)[0][0]
admin = Client('admin')

def attendance(state, reason=None):
    return admin.call('POST', '/training/participants/%s/attendance' % PID, {'state': state, 'absenceReason': reason}, raw=True)

code, body = attendance('ATTENDED')
check('SE1 the trainer cannot record that a self-reader attended', code == 409 and b'TRAINING_SELF_READING_ELECTRONIC_ONLY' in body, (code, body[:200]))
code, body = attendance('ONLINE')
check('SE2 nor that they attended online', code == 409 and b'TRAINING_SELF_READING_ELECTRONIC_ONLY' in body, (code, body[:200]))
STATE0 = sql("select state from training_participants where id='%s'" % PID)[0][0]
check('SE3 neither attempt changed the person (INVITED, or ABSENT from the run before the owner removed Did Not Read)', STATE0 in ('INVITED', 'ABSENT'), STATE0)
code, body = attendance('ABSENT', 'UAT-2026 did not read the document before the list was closed')
check('SE4 "did not read" is gone: Absent is refused too, with a reason or without', code == 409 and b'TRAINING_SELF_READING_ELECTRONIC_ONLY' in body, (code, body[:200]))
check('SE5 the state of the person did not change', sql("select state from training_participants where id='%s'" % PID)[0][0] == STATE0)
code, body = admin.call('POST', '/training/participants/%s/attendance/correct' % PID, {'state': 'ATTENDED', 'reason': 'UAT-2026 test'}, raw=True)
check('SE7 it cannot be corrected to Attended either', code == 409 and b'TRAINING_SELF_READING_ELECTRONIC_ONLY' in body, (code, body[:200]))
code, pdf = admin.call('GET', '/training/sessions/%s/self-reading-list?format=pdf' % SES, raw=True)
check('SE9 the filled list APD.0108 is downloaded as a PDF', code == 200 and pdf[:4] == b'%PDF', (code, pdf[:120]))
code, body = admin.call('POST', '/training/sessions/%s/self-reading-list/paper' % SES, {'format': 'pdf'}, raw=True)
check('SE10 the paper print of the list is gone', code in (404, 405), (code, body[:120]))
print('%d passed, %d failed' % (sum(results), len(results) - sum(results))); sys.exit(0 if all(results) else 1)
