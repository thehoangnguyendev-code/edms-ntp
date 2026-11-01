"""DEV check, 2026-10-31, of the training of self-reading only that is finished with no attendance list (owner decision TRAINING-SELFREAD-NO-APD0117-2026-10-31): on TRN/QA/26-856 (IN_PROGRESS, one self-reading
session, one person read and was confirmed by the head), "Send attendance list" is not offered and not needed, check-in and roll-call are refused, Finish Training works with one signature, QA is told with the list APD.0108
(not APD.0117), and the activity goes to Pending QA Confirmation. Password from DEVPW, never written. Plain `python`. Run once: the activity stays Pending QA Confirmation (not removed)."""
import os, sys, subprocess
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'training_2026_10_18'))
from api import Client

PW = os.environ['DEVPW']
results = []
def check(name, ok, detail=''):
    results.append(bool(ok)); print(('PASS  ' if ok else 'FAIL  ') + name + ((' -- ' + str(detail)[:300]) if (detail and not ok) else ''))
def sql(q):
    out = subprocess.run(['docker', 'exec', '-i', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-t', '-A', '-F', '|', '-c', q], capture_output=True, text=True).stdout
    return [r.split('|') for r in out.strip().splitlines() if r.strip()]

ACT, SES = sql("select a.id, s.id from training_activities a join training_sessions s on s.activity_id=a.id where a.training_number='TRN/QA/26-856'")[0]
admin = Client('admin')
sign = lambda: admin.call('POST', '/auth/verify-signature', {'username': 'admin', 'password': PW})['signatureToken']
a = admin.call('GET', '/training/activities/%s' % ACT)
caps = a.get('capabilities') or a.get('caps') or {}
check('SF1 "Send attendance list to QA" is not offered for a self-reading', caps.get('sendAttendanceList') is False, caps.get('sendAttendanceList'))
check('SF2 Finish Training is offered without it', caps.get('finishTraining') is True, caps.get('finishTraining'))
code, body = admin.call('POST', '/training/sessions/%s/check-in/open' % SES, raw=True)
check('SF3 a check-in cannot be opened', code == 409 and b'TRAINING_SELF_READING_NO_ATTENDANCE' in body, (code, body[:150]))
code, body = admin.call('POST', '/training/sessions/%s/roll-call' % SES, {'present': [], 'absent': [], 'signatureToken': 'x'}, raw=True)
check('SF4 a roll-call is refused', code == 409 and b'TRAINING_SELF_READING_NO_ATTENDANCE' in body, (code, body[:150]))
code, body = admin.call('POST', '/training/activities/%s/finish-training' % ACT, {'version': a['version'], 'signatureToken': sign()}, raw=True)
check('SF5 Finish Training works with one signature and no attendance list', code == 200, (code, body[:200]))
st = sql("select status, attendance_sent_at is null from training_activities where id='%s'" % ACT)
check('SF6 the activity is Pending QA Confirmation and the list was never sent', st == [['PENDING_QA_CONFIRMATION', 't']], st)
check('SF7 the Audit Trail has the finish', sql("select count(*) from audit_logs where action_type='TRAINING_FINISHED' and entity_id::text='%s'" % ACT)[0][0] != '0')
print('%d passed, %d failed' % (sum(results), len(results) - sum(results))); sys.exit(0 if all(results) else 1)
