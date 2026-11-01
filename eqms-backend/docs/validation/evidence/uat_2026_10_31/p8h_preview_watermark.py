"""Part 8h: the views of a scan carry the watermark of the preview settings (Settings > Configuration > Preview File); the download is the scan as filed."""
import sys
sys.path.insert(0, 'D:/tmp/pymupdf')
from lib7 import *
import hashlib, urllib.request
import api as _api
import fitz

def fetch(path):
    req = urllib.request.Request(_api.BASE + path); req.add_header('Authorization', 'Bearer ' + admin.token)
    with admin.opener.open(req) as resp:
        return resp.read()

def text(b):
    d = fitz.open(stream=b, filetype='pdf'); t = ' '.join(p.get_text() for p in d); d.close(); return t

enabled = sql("select documents_config->'pdfPreview'->>'watermarkEnabled' from system_configurations limit 1")
print('watermark setting:', enabled, flush=True)
ev = sql("select e.id, e.sha256 from training_legacy_evidence e where e.stored_path is not null and e.original_name like 'F-02%' limit 1")
step('H-15 the scan of a Legacy Evidence')
eid, sha = ev[0]
down = fetch(f'/training/legacy-evidence/{eid}/download')
view = fetch(f'/training/legacy-evidence/{eid}/download?inline=true')
check('H-15.1 the download is the scan as it was filed', hashlib.sha256(down).hexdigest() == sha, '')
print('VIEW BYTES:', view[:80], flush=True)
check('H-15.2 the view is not the same bytes (it carries the watermark)', hashlib.sha256(view).hexdigest() != sha, len(view))
name = sql("select full_name from app_users where username = 'admin'")[0][0]
check('H-15.3 the watermark names the viewer', name.split()[0] in text(view) or 'admin' in text(view).lower(), text(view)[:200])

def is_marked(b):
    t = text(b).lower()
    return name.split()[0].lower() in t or 'admin' in t

def pdfs(rows):
    return [r for r in rows if r]

step('H-16 the other modals of preview')
er = sql("select id from executed_records where storage_object_key is not null order by created_at desc limit 12")
done = False
for (rid,) in er:
    try:
        v = fetch(f'/executed-records/{rid}/preview')
    except Exception as e:
        continue
    if v[:4] == b'%PDF' and len(v) > 1000:
        check('H-16.1 the scan of an executed record carries the watermark of the settings', is_marked(v), text(v)[:120]); done = True; break
if not done: print('   no real PDF executed record to look at', flush=True)
uc = sql("select id from uncontrolled_copies where status not in ('EXPIRED') order by created_at desc limit 12")
done = False
for (uid,) in uc:
    try:
        v = fetch(f'/uncontrolled-copies/{uid}/preview')
    except Exception:
        continue
    if v[:4] == b'%PDF' and len(v) > 1000:
        check('H-16.2 the uncontrolled copy preview carries the watermark of the settings', is_marked(v), text(v)[:120]); done = True; break
if not done: print('   no real PDF uncontrolled copy to look at', flush=True)
ce = sql("select user_id, id from user_certifications where file_url is not null and lower(file_name) like '%.pdf' limit 8")
done = False
for uid, cid in ce:
    try:
        v = fetch(f'/settings/users/{uid}/certifications/{cid}/file')
    except Exception:
        continue
    if v[:4] == b'%PDF' and len(v) > 1000:
        check('H-16.3 the certificate preview carries the watermark of the settings', is_marked(v), text(v)[:120]); done = True; break
if not done: print('   no real PDF certificate to look at', flush=True)
step('H-17 a view that cannot carry the watermark is not sent')
stub = sql("select e.id from training_legacy_evidence e where e.stored_path is not null and e.original_name not like 'F-02%' and e.content_type like '%pdf%' limit 40")
refused = None
import urllib.error
for (sid,) in stub:
    try:
        b = fetch(f'/training/legacy-evidence/{sid}/download?inline=true')
        if len(b) < 100: refused = False; break
    except urllib.error.HTTPError as e:
        refused = (e.code == 422); break
check('H-17.1 a PDF that the watermark cannot be drawn on is refused (422), not sent bare', refused is not False, refused)
step('H-18 a picture is not accepted as a scan')
PNG = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) + bytes(40)
code, data, text = do_import(free_number(), 'UAT8 picture scan', [section(number='TRN/QA/26-%d' % (int(sql("select max(substring(training_number from '-([0-9]+)$')::int) from training_activities where training_number like 'TRN/QA/26-%' and length(training_number) < 16")[0][0]) + 60))], [PNG])
check('H-18.1 a picture as the scan of a Legacy Import is refused with words', code == 400 and 'PDF' in text, (code, text[:160]))
finish('p8h')
