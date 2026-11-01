"""DEV check, 2026-10-30, of the rule 'a numbered paper copy comes back only by its scan': a hand-made Returned is refused, Lost needs a reason, and the upload of a scan for an Issued copy closes it as Returned
(once). The copy used is an Issued copy of TRN/QA/26-053 (a UAT record, IN_PROGRESS); the scan is a tiny PDF named UAT-2026. Password from DEVPW, never written. Plain `python`."""
import os, sys, json, subprocess
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'training_2026_10_18'))
from api import Client

results = []
def check(name, ok, detail=''):
    results.append((name, ok)); print(('PASS  ' if ok else 'FAIL  ') + name + ((' -- ' + str(detail)[:300]) if (detail and not ok) else ''))
def sql(q):
    out = subprocess.run(['docker', 'exec', '-i', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-t', '-A', '-F', '|', '-c', q], capture_output=True, text=True).stdout
    return [r.split('|') for r in out.strip().splitlines() if r.strip()]

# Run once: the copy stays Returned afterwards (a closing event cannot be changed).
PACK = 'c5bd9cb7-91c7-4997-bba0-3ffa582f20a3'
ACT = sql("select activity_id from training_paper_packs where id='%s'" % PACK)[0][0]
admin = Client('admin')
def mark(status, reason=None):
    code, payload = admin.call('POST', '/training/paper-packs/%s/status' % PACK, {'status': status, 'reason': reason}, raw=True)
    return code, payload[:200].decode('utf-8', 'ignore')
state = lambda: sql("select coalesce((select status from training_paper_pack_events where pack_id='%s'),'ISSUED')" % PACK)[0][0]

check('RS0 the copy starts Issued', state() == 'ISSUED', state())
code, body = mark('RETURNED')
check('RS1 a hand-made Returned is refused (TRAINING_PAPER_RETURN_BY_SCAN)', code >= 400 and 'TRAINING_PAPER_RETURN_BY_SCAN' in body, (code, body))
check('RS2 the copy is still Issued', state() == 'ISSUED', state())
code, body = mark('LOST')
check('RS3 Lost without a reason is refused', code >= 400 and 'TRAINING_REASON_REQUIRED' in body, (code, body))
pdf = b'%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'
try:
    admin.upload('/training/activities/%s/paper-evidence' % ACT, 'file', 'UAT-2026-scan.pdf', pdf, 'application/pdf', '?kind=ATTENDANCE_SHEET&packId=' + PACK)
    check('RS4 the scan is accepted', True)
except SystemExit as e:
    check('RS4 the scan is accepted', False, e)
check('RS5 the copy is now Returned, by the scan', state() == 'RETURNED', state())
audit = sql("select count(*) from audit_logs where action_type='TRAINING_PAPER_COPY_RETURNED' and comment like '%TRN/QA/26-053/S1/P1%Returned by the scan UAT-2026-scan.pdf%'")
check('RS6 the change is in the Audit Trail with the name of the scan', audit and audit[0][0] != '0', audit)
try:
    admin.upload('/training/activities/%s/paper-evidence' % ACT, 'file', 'UAT-2026-scan2.pdf', pdf, 'application/pdf', '?kind=ATTENDANCE_SHEET&packId=' + PACK)
except SystemExit:
    pass
check('RS7 a second scan does not make a second closing event', sql("select count(*) from training_paper_pack_events where pack_id='%s'" % PACK)[0][0] == '1')
bad = [r for r in results if not r[1]]
print('%d passed, %d failed' % (len(results) - len(bad), len(bad))); sys.exit(1 if bad else 0)
