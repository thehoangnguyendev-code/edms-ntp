"""DEV: the states of a specimen signature (FRM.0007, SOP.0003 5.3.9) are three: Pending Confirmation, Approved, Obsoleted. Checks: a new one is Pending Confirmation; a second one for the same person is refused while
one is pending; the confirmer approves it (Approved); a newer one that is approved makes the older Obsoleted (only one Approved for a person); a rejected one is Obsoleted and keeps its reason; the old
names (Pending, Superseded, Rejected) are not in the answers or in the database; the status filter takes the new values; the form FRM.0007 lists the approved ones and the obsoleted ones that were in force,
not the one that was rejected. The password comes from DEVPW. Needs PyMuPDF (to make the images)."""
import os, sys, io, json, subprocess, zipfile, re
sys.path.insert(0, os.path.dirname(__file__))
import fitz
from api import Client, BASE
from e2e21_matrix import admin, qa, check, sign, attempt, results


def sql(q):
    return subprocess.run(['docker', 'exec', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-Atc', q], capture_output=True, text=True).stdout.strip()


def png(shade):
    pix = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, 160, 70), False)
    pix.set_rect(pix.irect, (shade, shade, shade))
    pix.set_rect(fitz.IRect(10, 30, 150, 36), (0, 0, 0))
    return pix.tobytes('png')


def upload(client, person, confirmer, reason, shade):
    boundary = '----e2espec'
    nl = '\r\n'
    body = b''
    for name, data in (('file', png(shade)), ('file2', png(shade + 20))):
        body += (f'--{boundary}{nl}Content-Disposition: form-data; name="{name}"; filename="{name}.png"{nl}Content-Type: image/png{nl}{nl}').encode() + data + nl.encode()
    body += f'--{boundary}--{nl}'.encode()
    import urllib.request, urllib.error
    q = f'?personId={person}&confirmerId={confirmer}' + (f'&reason={reason.replace(" ", "%20")}' if reason else '')
    req = urllib.request.Request(BASE + '/training/specimen-signatures' + q, data=body, method='POST')
    req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')
    req.add_header('Authorization', 'Bearer ' + client.token)
    try:
        with client.opener.open(req) as r:
            return r.status, json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:300].decode('utf8', 'ignore')


# a person with no specimen signature at all (the one of the test)
person = sql("select id from app_users u where status='Active' and not exists (select 1 from training_specimen_signatures s where s.person_user_id=u.id) and id <> '%s' and id <> '%s' limit 1" % (admin.user['id'], qa.user['id']))
assert person, 'a person without a specimen signature is needed'
confirmer = qa.user['id']
st, first = upload(admin, person, confirmer, None, 200)
check('1 a new specimen signature is Pending Confirmation', st == 200 and first.get('status') == 'PENDING_CONFIRMATION', (st, first))
st, again = upload(admin, person, confirmer, 'second while the first waits', 190)
check('2 a second one while one is pending is refused (409)', st == 409, (st, again))
code, done, raw = attempt(qa, 'POST', f"/training/specimen-signatures/{first['id']}/confirm", {'signatureToken': sign(qa)}); st = code
check('3 the confirmer approves it: Approved, with the day it came in force', st == 200 and done.get('status') == 'APPROVED' and done.get('effectiveDate'), (st, done))
st, second = upload(admin, person, confirmer, 'E2E-TEST the signature changed', 120)
check('4 a newer one is Pending Confirmation and the first stays Approved', st == 200 and second.get('status') == 'PENDING_CONFIRMATION' and admin.call('GET', f"/training/specimen-signatures/{first['id']}")['status'] == 'APPROVED', (st, second))
attempt(qa, 'POST', f"/training/specimen-signatures/{second['id']}/confirm", {'signatureToken': sign(qa)})
check('5 when the newer one is approved the older one is Obsoleted (one Approved only)', admin.call('GET', f"/training/specimen-signatures/{first['id']}")['status'] == 'OBSOLETED'
      and admin.call('GET', f"/training/specimen-signatures/{second['id']}")['status'] == 'APPROVED'
      and sql(f"select count(*) from training_specimen_signatures where person_user_id='{person}' and status='APPROVED'") == '1', '')
st, third = upload(admin, person, confirmer, 'E2E-TEST a third one that is not confirmed', 60)
code, rej, raw = attempt(qa, 'POST', f"/training/specimen-signatures/{third['id']}/reject", {'reason': 'E2E-TEST it is only the name'})
check('6 a rejected one goes back to Pending Confirmation and keeps its reason (to be uploaded again)', code == 200 and rej.get('status') == 'PENDING_CONFIRMATION' and 'only the name' in str(rej.get('rejectReason')), raw)
shown = admin.call('GET', f"/training/specimen-signatures/{third['id']}")
check('6b it cannot be confirmed or rejected again; Upload Again is offered', not shown['capabilities']['confirm'] and not shown['capabilities']['reject'] and shown['capabilities']['reupload'], shown['capabilities'])
code, again, raw = attempt(qa, 'POST', f"/training/specimen-signatures/{third['id']}/confirm", {'signatureToken': sign(qa)})
check('6c confirming it before it is uploaded again is refused (409)', code == 409, (code, raw))
st, up = upload(admin, person, confirmer, None, 90)
check('6d uploading again keeps the same row and version, clears the reason, waits for a confirmer', st == 200 and up.get('id') == third['id'] and up.get('versionNo') == third['versionNo'] and not up.get('rejectReason') and up.get('status') == 'PENDING_CONFIRMATION', (st, up))
check('6e only one row is pending for the person', sql(f"select count(*) from training_specimen_signatures where person_user_id='{person}' and status='PENDING_CONFIRMATION'") == '1', '')
code, done3, raw = attempt(qa, 'POST', f"/training/specimen-signatures/{third['id']}/confirm", {'signatureToken': sign(qa)})
check('6f then it can be approved, and the one before is Obsoleted', code == 200 and done3.get('status') == 'APPROVED' and admin.call('GET', f"/training/specimen-signatures/{second['id']}")['status'] == 'OBSOLETED', raw)
used = sql("select string_agg(distinct status, ',' order by status) from training_specimen_signatures")
check('7 the old names are not in the database any more', not re.search(r'SUPERSEDED|REJECTED|(^|,)PENDING(,|$)', used or ''), used)
page = admin.call('GET', f'/training/specimen-signatures?status=OBSOLETED&search={person}&limit=20')
check('8 the status filter takes the new value', page['pagination']['total'] >= 0 and all(r['status'] == 'OBSOLETED' for r in page['data']), page['pagination'])
page = admin.call('GET', '/training/specimen-signatures?status=PENDING_CONFIRMATION&limit=50')
check('9 the filter Pending Confirmation lists only those', page['pagination']['total'] >= 1 and all(r['status'] == 'PENDING_CONFIRMATION' for r in page['data']), page['pagination'])
st, docx = admin.call('GET', f'/training/specimen-signatures/person/{person}/export?format=docx', raw=True)
media = [n for n in zipfile.ZipFile(io.BytesIO(docx)).namelist() if n.startswith('word/media/')] if st == 200 else []
check('10 the form FRM.0007 has the images of the versions that were in force (two each)', st == 200 and 4 <= len(media) <= 8, (st, len(media)))
print(sum(1 for r in results if r[1]), 'of', len(results), 'checks passed')
