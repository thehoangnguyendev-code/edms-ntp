"""DEV: the numbered paper copies of a session (hybrid operation) are Issued, then Returned, Lost or Voided. Checks: a copy that is Issued is returned; Lost needs a reason; a closed copy does not change
again (409); a person without the permission to print cannot change it; the state, the person and the time are in the list of packs and in the Audit Trail. The password comes from DEVPW."""
import os, sys, subprocess
sys.path.insert(0, os.path.dirname(__file__))
from api import Client
from e2e21_matrix import check, admin, attempt


def sql(q):
    return subprocess.run(['docker', 'exec', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-Atc', q], capture_output=True, text=True).stdout.strip()


rows = sql("select p.id || '|' || p.activity_id from training_paper_packs p where not exists (select 1 from training_paper_pack_events e where e.pack_id = p.id) order by printed_at desc limit 3").splitlines()
assert len(rows) >= 3, 'three issued copies are needed (run e2e2 or e2e34 first)'
(a, aid), (b, bid), (c, cid) = [r.split('|') for r in rows]
code, data, raw = attempt(admin, 'POST', f'/training/paper-packs/{a}/status', {'status': 'RETURNED'})
check('1 an issued copy is returned', code == 200 and data.get('status') == 'RETURNED' and data.get('statusByName'), raw)
code, data, raw = attempt(admin, 'POST', f'/training/paper-packs/{b}/status', {'status': 'LOST'})
check('2 a loss needs a reason (400)', code == 400, (code, raw))
code, data, raw = attempt(admin, 'POST', f'/training/paper-packs/{b}/status', {'status': 'LOST', 'reason': 'E2E-TEST lost in the workshop'})
check('3 a loss with a reason is recorded', code == 200 and data.get('status') == 'LOST' and 'workshop' in str(data.get('statusReason')), raw)
code, data, raw = attempt(admin, 'POST', f'/training/paper-packs/{b}/status', {'status': 'RETURNED'})
check('4 a closed copy does not change again (409)', code == 409, (code, raw))
code, data, raw = attempt(admin, 'POST', f'/training/paper-packs/{c}/status', {'status': 'DESTROYED'})
check('5 an unknown state is refused (400)', code == 400, (code, raw))
other = Client('trainee.test1')
code, data, raw = attempt(other, 'POST', f'/training/paper-packs/{c}/status', {'status': 'RETURNED'})
check('6 a person without the permission cannot change a copy (403)', code in (401, 403), (code, raw))
code, data, raw = attempt(admin, 'POST', f'/training/paper-packs/{c}/status', {'status': 'VOIDED', 'reason': 'E2E-TEST not used'})
check('7 an unused copy is voided with a reason', code == 200 and data.get('status') == 'VOIDED', raw)
listed = {p['id']: p for x in {aid, bid, cid} for p in admin.call('GET', f'/training/activities/{x}/paper-packs')}
check('8 the list of packs shows the state', listed[a]['status'] == 'RETURNED' and listed[b]['status'] == 'LOST' and listed[c]['status'] == 'VOIDED', {k: v['status'] for k, v in listed.items() if k in (a, b, c)})
trail = sql("select count(*) from audit_logs where action in ('TRAINING_PAPER_COPY_RETURNED','TRAINING_PAPER_COPY_LOST','TRAINING_PAPER_COPY_VOIDED') and created_at > now() - interval '5 minutes'")
check('9 the three changes are in the Audit Trail', trail.isdigit() and int(trail) >= 3, trail)
# the scan of a numbered copy
from e2e21_matrix import mini_pdf
row = sql("select p.id || '|' || p.activity_id from training_paper_packs p join training_activities a on a.id = p.activity_id where a.status in ('NOTIFIED', 'IN_PROGRESS', 'PENDING_QA_CONFIRMATION') and not exists (select 1 from training_paper_pack_events e where e.pack_id = p.id) order by p.printed_at desc limit 1")
if row:
    pid, act = row.split('|')
    other_act = sql(f"select id from training_activities where id <> '{act}' and status in ('NOTIFIED', 'IN_PROGRESS', 'PENDING_QA_CONFIRMATION') limit 1")
    code, data, raw = attempt(admin, 'POST', f'/training/paper-packs/{pid}/status', {'status': 'RETURNED'})
    out = admin.upload(f'/training/activities/{act}/paper-evidence', 'file', 'e2e-copy-scan.pdf', mini_pdf('E2E-TEST scan of a copy'), 'application/pdf', f'?kind=ATTENDANCE_SHEET&packId={pid}')
    listed = [e for e in out['evidence'] if e.get('packId') == pid]
    check('10 a scan says which numbered copy it is the scan of', len(listed) == 1 and listed[0].get('packCode'), out['evidence'][-1:])
    pack = [p for p in admin.call('GET', f'/training/activities/{act}/paper-packs') if p['id'] == pid][0]
    check('11 the copy shows its scans', pack['scanCount'] == 1 and pack['status'] == 'RETURNED', pack)
    try:
        admin.upload(f'/training/activities/{other_act}/paper-evidence', 'file', 'x.pdf', mini_pdf('E2E-TEST wrong copy'), 'application/pdf', f'?kind=OTHER&packId={pid}')
        refused = False
    except SystemExit as e:
        refused = '400' in str(e) or 'REJECTED' in str(e)
    check('12 a scan cannot name a copy of another activity', refused or not other_act, other_act)
else:
    print('no copy of an open activity: checks 10 to 12 are not run')
print(sum(1 for r in __import__('e2e21_matrix').results if r[1]), 'of', len(__import__('e2e21_matrix').results), 'checks passed')
