from lib7 import *
import urllib.request, sys
import api as _api
sys.path.insert(0, 'D:/tmp/pymupdf')
import fitz
state = load()
p8 = state.get('p8', {})
t1 = trainees[0]
approver_id = sql("select id from app_users where username = 'approver.test1'")[0][0]
code, data, text = attempt(admin, 'POST', '/training/record-exports', {'personUserId': t1, 'reason': 'UAT8 debug', 'approverUserId': approver_id, 'signatureToken': sign(admin)})
print('request', code, text[:120])
appr = U('approver.test1')
print('approve', attempt(appr, 'POST', f"/training/record-exports/{data['id']}/approve", {'signatureToken': sign(appr)})[0])
req = urllib.request.Request(_api.BASE + f"/training/record-exports/{data['id']}/download"); req.add_header('Authorization', 'Bearer ' + admin.token)
pdf = admin.opener.open(req).read()
doc = fitz.open(stream=pdf, filetype='pdf')
txt = ' '.join(p.get_text() for p in doc)
print('pages', len(doc), 'chars', len(txt))
print('has Gowning', 'Gowning in grade B' in txt, 'count TRN/QA/26', txt.count('TRN/QA/26'))
idx = txt.find('TRN/QA/26')
print(repr(txt[idx-200: idx+400]))
print('records of t1 in db', sql(f"select count(*), count(*) filter (where source='LEGACY_IMPORT') from training_records where person_user_id = '{t1}'"))
pix = doc[0].get_pixmap(dpi=110)
pix.save(os.path.join(SHOTS, 'F-60__personal_record_with_legacy.png'))
print('saved picture')
