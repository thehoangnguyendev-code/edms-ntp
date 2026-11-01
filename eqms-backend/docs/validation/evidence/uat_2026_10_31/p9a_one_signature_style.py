"""Part 9a: a signed signature is written in one way only, the Standard frame: the sample of the settings, the catalog of placeholders, the preview PDF, and the old endpoint/style choice gone."""
import sys
sys.path.insert(0, 'D:/tmp/pymupdf')
from lib7 import *
import urllib.request, urllib.error
import api as _api
import fitz

def fetch(path):
    req = urllib.request.Request(_api.BASE + path); req.add_header('Authorization', 'Bearer ' + admin.token)
    with admin.opener.open(req) as resp:
        return resp.read()

step('J-1 the sample of the settings screen')
d = admin.call('GET', '/settings/electronic-signature/display-style')
check('J-1.1 one sample, the Standard frame', d.get('style') == 'STANDARD' and 'Electronically' in d.get('text', '') and d['text'].count('\n') == 2, d)
code, data, text = attempt(admin, 'GET', '/settings/electronic-signature/display-styles')
check('J-1.2 the endpoint of the three styles is gone', code in (404, 405), (code, text[:100]))

step('J-2 the catalog of placeholders')
cat = admin.call('GET', '/documents/administration/publishing-templates/placeholders')
groups = [g for g in cat['groups'] if g['title'].startswith('Signature')]
values = [i['value'] for g in groups for i in g['items']]
check('J-2.1 the signature placeholders are listed with no style', sorted(values) == sorted(['{{PREPARED_SIGNATURE}}', '{{REVIEWED_SIGNATURE}}', '{{APPROVED_SIGNATURE}}', '{{PUBLISHED_SIGNATURE}}', '{{REVIEWER_SIGNATURES}}', '{{APPROVER_SIGNATURES}}']), values)
allv = [i['value'].upper() for g in cat['groups'] for i in g['items']]
check('J-2.2 no placeholder of the catalog ends with Compact, Standard or Detailed', not [v for v in allv if v.rstrip('}').endswith(('COMPACT', 'STANDARD', 'DETAILED'))], '')

step('J-3 the preview PDF of the settings')
pdf = fetch('/settings/electronic-signature/pdf-preview')
doc = fitz.open(stream=pdf, filetype='pdf'); t = ' '.join(p.get_text() for p in doc); doc.close()
print('PDF TEXT:', repr(t[:400]), flush=True)
check('J-3.1 it shows the signature of the sample in the Standard frame, not the label of an unfilled placeholder', 'Nguyen Van A' in t and 'Electron' in t and 'approved' in t and 'signature block' not in t.lower(), t[:300])
check('J-3.2 and not the old full block (Meaning:, Reason:, Signature ID:)', 'Signature ID' not in t and 'Reason:' not in t and 'Meaning:' not in t, t[:300])

step('J-4 the Training Annex has no style of a slot')
annex = admin.call('GET', '/training/annex/APD.0117')
slots = annex['contract']['slots']
check('J-4.1 a slot has no style', slots and all('style' not in s for s in slots), slots[:1])
code, data, text = attempt(admin, 'PUT', '/training/annex/APD.0117/slots/' + slots[0]['name'] + '/style', {'style': 'COMPACT', 'reason': 'x'})
check('J-4.2 the endpoint that chose it is gone', code in (404, 405), (code, text[:100]))
step('J-5 a published document (Legacy Import, cover template of the system)')
base = int(sql("select max(substring(training_number from '-([0-9]+)$')::int) from training_activities where training_number like 'TRN/QA/26-%' and length(training_number) < 16")[0][0]) + 70
num = free_number()
reviewer_id = sql("select id from app_users where username = 'reviewer.test1'")[0][0]
approver_id = sql("select id from app_users where username = 'approver.test1'")[0][0]
import docx as _docx, io as _io
_d = _docx.Document(); _d.add_paragraph('UAT9 body of the document'); _b = _io.BytesIO(); _d.save(_b)
code, data, text = do_import(num, 'UAT9 one signature style', [section(number='TRN/QA/26-%d' % base)], [SCAN], reviewers=[reviewer_id], approvers=[approver_id], source=_b.getvalue(), source_docx=True)
check('J-5.1 the document is imported and published', code == 200, (code, text[:200]))
rev = revision_of(num)[-1][0]
tid = sql("select t.id from publishing_templates t join publishing_template_components c on c.template_id = t.id where c.component_type = 'COVER' and c.status = 'ACTIVE' order by t.created_at limit 1")
check('J-5.2 a publishing template with a cover is active', bool(tid), tid)
signed_rev = sql("select s.revision_id from electronic_signatures s where s.status = 'SIGNED' and s.meaning = 'APPROVED' and s.revision_id is not null order by s.signed_at desc limit 1")[0][0]
cover = fetch(f'/documents/administration/publishing-templates/{tid[0][0]}/components/COVER/preview?revisionId={signed_rev}')
doc = fitz.open(stream=cover, filetype='pdf'); ct = ' '.join(p.get_text() for p in doc); doc.close()
print('COVER TEXT:', repr(ct[:900]), flush=True)
check('J-5.3 the signature cells of the cover are written in the Standard frame (name, Electronically and the meaning, date and time)', ct.count('Electron') >= 1 and 'UTC+07' in ct, ct[:300])
check('J-5.4 none carries the reason, the signature ID or the Meaning line of the old block', 'SIG-20' not in ct and 'Reason:' not in ct and 'Signature ID' not in ct and 'Meaning:' not in ct, ct[:300])
finish('p9a')
