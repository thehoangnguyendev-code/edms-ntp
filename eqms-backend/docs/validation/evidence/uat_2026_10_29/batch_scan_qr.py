"""DEV check, 2026-10-30, of the scanned batch sorted by the QR code of each page. A real paper pack of TRN/QA/26-054 (a UAT record, IN_PROGRESS) is printed with a reason 'UAT-2026'; its page carries the code.
A messy batch is made of it (a blank page before and after, and a page that is not ours) and uploaded: the page is found and stored, the copy is closed as Returned, the blank pages are listed as not
recognised, and the same batch sent twice stores nothing twice. Password from DEVPW, never written. Plain `python` (needs PyMuPDF). Run once: the new copy stays Returned."""
import os, sys, subprocess
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'training_2026_10_18'))
from api import Client
import fitz

results = []
def check(name, ok, detail=''):
    results.append(bool(ok)); print(('PASS  ' if ok else 'FAIL  ') + name + ((' -- ' + str(detail)[:300]) if (detail and not ok) else ''))
def sql(q):
    out = subprocess.run(['docker', 'exec', '-i', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-t', '-A', '-F', '|', '-c', q], capture_output=True, text=True).stdout
    return [r.split('|') for r in out.strip().splitlines() if r.strip()]

ACT, SES = sql("select a.id, s.id from training_activities a join training_sessions s on s.activity_id=a.id where a.training_number='TRN/QA/26-054' limit 1")[0]
admin = Client('admin')
code, pdf = admin.call('POST', '/training/sessions/%s/paper-pack' % SES, {'reason': 'UAT-2026 QR batch'}, raw=True)
check('QB0 the paper pack is printed', code == 200 and pdf[:4] == b'%PDF', (code, pdf[:150]))
new = sql("select pack_code, id from training_paper_packs where session_id='%s' and pack_kind='ATTENDANCE' order by copy_no desc limit 1" % SES)[0]
pack_code, pack_id = new
src = fitz.open(stream=pdf, filetype='pdf')
batch = fitz.open()
batch.new_page(width=595, height=842)                       # a blank page
batch.insert_pdf(src, from_page=0, to_page=0)                # our page
batch.new_page(width=595, height=842)                       # another blank page
data = batch.tobytes()
res = admin.upload('/training/activities/%s/paper-evidence/batch' % ACT, 'file', 'UAT-2026-batch.pdf', data, 'application/pdf')
check('QB2 3 pages read, 1 file stored', res['totalPages'] == 3 and res['stored'] == 1, res)
check('QB3 the file is of the new copy and complete', len(res['files']) == 1 and res['files'][0]['packCode'] == pack_code and res['files'][0]['state'] == 'STORED', res)
check('QB4 the two blank pages are listed as not recognised (pages 1 and 3)', res['unrecognisedPages'] == [1, 3], res)
check('QB5 the copy is Returned by the scan', sql("select status from training_paper_pack_events where pack_id='%s'" % pack_id) == [['RETURNED']])
check('QB6 the evidence row names the copy', sql("select count(*) from training_paper_evidence where pack_id='%s'" % pack_id)[0][0] == '1')
check('QB7 the batch is in the Audit Trail', sql("select count(*) from audit_logs where action_type='TRAINING_PAPER_SCAN_BATCH' and comment like '%UAT-2026-batch.pdf%'")[0][0] != '0')
res2 = admin.upload('/training/activities/%s/paper-evidence/batch' % ACT, 'file', 'UAT-2026-batch.pdf', data, 'application/pdf')
check('QB8 the same batch again stores nothing twice', res2['stored'] == 0 and res2['files'][0]['state'] == 'ALREADY_UPLOADED', res2)
check('QB9 still one evidence row', sql("select count(*) from training_paper_evidence where pack_id='%s'" % pack_id)[0][0] == '1')
print('%d passed, %d failed' % (sum(results), len(results) - sum(results))); sys.exit(0 if all(results) else 1)
