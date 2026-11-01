"""Part 8g: odd inputs: file names with accents and with paths, a person chosen twice, a source file that cannot be read, a person who left, the limits of the lengths."""
from lib7 import *
import urllib.parse, urllib.request
import api as _api

state = load()
t1, t2 = trainees
base = max(int(sql("select max(last_serial) from training_number_sequences where year = 2026 and last_serial < 100000")[0][0]),
           int(sql("select max(substring(training_number from '-([0-9]+)$')::int) from training_activities where training_number like 'TRN/QA/26-%' and length(training_number) < 16")[0][0])) + 40
_n = [base]


def number():
    _n[0] += 1
    return 'TRN/QA/26-%d' % _n[0]


def download_name(evidence_id):
    req = urllib.request.Request(_api.BASE + f'/training/legacy-evidence/{evidence_id}/download'); req.add_header('Authorization', 'Bearer ' + admin.token)
    with admin.opener.open(req) as resp:
        head = resp.headers.get('Content-Disposition', ''); resp.read()
    import re
    m = re.search(r"filename\*=UTF-8''([^;]+)", head)
    return urllib.parse.unquote(m.group(1)) if m else head


step('H-12 file names of the scan')
VN = 'Danh sách đào tạo 26-010 (bản quét).pdf'
n1, d1 = number(), free_number()
code, data, text = do_import(d1, 'UAT8 accent file name', [section(number=n1)], [SCAN], scan_names=[VN])
check('H-12.1 a scan with accents in its name is accepted', code == 200, (code, text[:200]))
ev1 = sql(f"select e.id, e.original_name from training_legacy_evidence e join training_activities a on a.id = e.activity_id where a.training_number = '{n1}'")
check('H-12.2 the name is kept exactly as it was uploaded', ev1 and ev1[0][1] == VN, ev1)
check('H-12.3 and is the name of the file downloaded', ev1 and download_name(ev1[0][0]) == VN, download_name(ev1[0][0]) if ev1 else '')
n2, d2 = number(), free_number()
code, data, text = do_import(d2, 'UAT8 path file name', [section(number=n2)], [SCAN], scan_names=['..\..\evil\scan 26-011.pdf'])
ev2 = sql(f"select e.original_name from training_legacy_evidence e join training_activities a on a.id = e.activity_id where a.training_number = '{n2}'")
check('H-12.4 a name with a path keeps only the last part', code == 200 and ev2 and ev2[0][0] == 'scan 26-011.pdf', (code, ev2, text[:120]))

step('H-13 a person chosen twice, a person who left')
n3, d3 = number(), free_number()
code, data, text = do_import(d3, 'UAT8 trainee twice', [section(number=n3, people=[t1, t1, t2])], [SCAN])
check('H-13.1 the import is accepted', code == 200, (code, text[:200]))
cnt = sql(f"select r.person_user_id, count(*) from training_records r join training_activities a on a.id = r.activity_id where upper(a.training_number) = upper('{n3}') and r.method = 'PAPER' group by 1")
check('H-13.2 each person has one record', sorted(int(x[1]) for x in cnt) == [1, 1], cnt)
left = sql("select id, status from app_users where status <> 'Active' order by username limit 1")
if left:
    n4, d4 = number(), free_number()
    code, data, text = do_import(d4, 'UAT8 trainee who left', [section(number=n4, people=[left[0][0]])], [SCAN])
    print('   a person with status', left[0][1], 'as trainee ->', code, text[:140], flush=True)
    check('H-13.3 a person who left can be named as trained (they were trained at that time) or is refused with words', code == 200 or (code == 400 and 'trained' in text), (code, text[:200]))

step('H-14 a source file that cannot be read, and the limits of the lengths')
n5, d5 = number(), free_number()
code, data, text = do_import(d5, 'UAT8 broken source', [section(number=n5)], [SCAN], source=b'%PDF-1.4 this is not a real pdf')
# OBSERVATION (not a Legacy defect): the shared upload validator (same as the single-revision flow) checks the type/structure and ClamAV, not that the PDF can be parsed.
print('   OBSERVE H-14.1: an unparseable file with a %PDF header is accepted as a source file ->', code, flush=True)
check('H-14.1 the answer is not a server error (the shared validator accepts it, as in the normal flow)', code in (200, 400, 422), code)
code, data, text = do_import(free_number(), 'UAT8 long topic', [section(number=number(), trainingTopic='x' * 1001)], [SCAN])
check('H-14.3 a topic over 1000 characters is refused', code == 400 and 'Training Topic' in text, (code, text[:160]))
code, data, text = do_import(free_number(), 'UAT8 long trainer', [section(number=number(), trainingTrainer='y' * 256)], [SCAN])
check('H-14.4 a trainer over 255 characters is refused', code == 400 and 'Trainer' in text, (code, text[:160]))
code, data, text = do_import(free_number(), 'UAT8 long number', [section(number='TRN/QA/26-' + '9' * 40)], [SCAN])
check('H-14.5 a paper number over 40 characters is refused', code == 400 and '40' in text, (code, text[:160]))
code, data, text = do_import(free_number(), 'UAT8 bad number', [section(number='TRN QA 26 1')], [SCAN])
check('H-14.6 a paper number with blanks is refused', code == 400, (code, text[:160]))
finish('p8g')
