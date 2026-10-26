"""DEV: the forms of the company written from the system in their real Word templates (docs/training_docs): APD.0118 requirement, APD.0108 self-reading list, FRM.0044 Training Number log,
APD.0024 job assignment, FRM.0007 specimen signatures, APD.0014 personal training record. Steps: (1) each template is uploaded and enabled; (2) each form is exported as Word and PDF and the
content is checked; (3) the PDFs are rendered to PNG to be looked at. The password comes from DEVPW (never written). Files go to E2E_OUT or docs/training_docs/draft/test-run."""
import os, sys, io, re, zipfile, subprocess
sys.path.insert(0, os.path.dirname(__file__))
from api import Client
from e2e21_matrix import check, sign, admin, qa

OUT = os.environ.get('E2E_OUT') or r'D:\edms-project\docs\training_docs\draft\test-run'
os.makedirs(OUT, exist_ok=True)
DOCS = r'D:\edms-project\docs\training_docs'
DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
FORMS = [('APD.0118', 'APD.0118.01 training requirement.docx', 'Training requirement', '1.0.0 (APD.0118.01)'),
         ('APD.0108', 'APD.0108.01 List of personnel for SOP seft_reading.docx', 'SOP self-reading list', '1.0.0 (APD.0108.01)'),
         ('FRM.0044', 'FRM.0044.01 TRN number allocation log.docx', 'TRN number allocation log', '1.0.0 (FRM.0044.01)'),
         ('APD.0024', 'APD.0024.02 Job assignment VIE.docx', 'Job assignment', '2.00 (APD.0024.02)'),
         ('FRM.0007', 'FRM.0007.02 Standard signature of employee.docx', 'Standard signature of employee', '2.0.0 (FRM.0007.02)'),
         ('APD.0014', 'APD.0014.02 Personel training record.docx', 'Personal training record', '2.0.0 (APD.0014.02)')]


def step(t):
    print(chr(10) + '== ' + t)


def sql(q):
    return subprocess.run(['docker', 'exec', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-Atc', q], capture_output=True, text=True).stdout.strip()


def words(docx):
    z = zipfile.ZipFile(io.BytesIO(docx))
    xml = ''.join(z.read(n).decode('utf8') for n in z.namelist() if n.startswith('word/') and n.endswith('.xml') and ('document' in n or 'header' in n or 'footer' in n))
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', xml))


def pages(pdf, name):
    try:
        import fitz
    except ImportError:
        return 0
    d = fitz.open(stream=pdf, filetype='pdf')
    for i, p in enumerate(d):
        p.get_pixmap(dpi=70).save(os.path.join(OUT, f'{name}-page{i + 1}.png'))
    return len(d)


def get(client, path, name):
    st, body = client.call('GET', path, raw=True)
    if st == 200:
        open(os.path.join(OUT, name), 'wb').write(body)
    return st, body


step('1. the templates are uploaded and enabled')
for code, file, title, label in FORMS:
    mine = [t for t in admin.call('GET', f'/training/form-templates?search={code}&limit=20')['data'] if t['versionLabel'] == label]
    if not mine:
        with open(os.path.join(DOCS, file), 'rb') as f:
            mine = [admin.upload('/training/form-templates', 'file', file, f.read(), DOCX,
                                 f'?code={code}&title={title.replace(" ", "%20")}&versionLabel={label.replace(" ", "%20")}&remark=The%20form%20of%20the%20company')]
    t = mine[0]
    if t['status'] != 'ENABLED':
        t = admin.call('POST', f"/training/form-templates/{t['id']}/enable", {'signatureToken': sign(admin), 'reason': f'E2E-TEST the real form {code}'})
    check(f'1.{code} the form is enabled', t['status'] == 'ENABLED', t)

step('2. APD.0118 the training requirement')
reqs = admin.call('GET', '/training/requirements?limit=20')['data']
req = next(r for r in reqs if r['status'] == 'APPROVED')
st, w = get(admin, f"/training/requirements/{req['id']}/export?format=docx", 'APD0118.docx')
check('2.1 Word of the requirement', st == 200 and w[:2] == b'PK', (st, w[:200]))
if st == 200:
    t = words(w)
    check('2.2 the year, the number and the lines are written', req['requestNo'] in t and str(req['year']) in t and 'Execution date' in t, t[:300])
    check('2.3 the notes of the template are not written', 'Header:' not in t and 'HISTORY REVISION' not in t and 'APD.0027' not in t, t[:200])
    check('2.4 the kind is ticked', '\u2612' in t, t[:300])
    st, p = get(admin, f"/training/requirements/{req['id']}/export?format=pdf", 'APD0118.pdf')
    check('2.5 PDF of the requirement', st == 200 and p[:4] == b'%PDF', st)
    print('   pages', pages(p, 'APD0118'))
draft = [r for r in reqs if r['status'] != 'APPROVED']
if draft:
    st, _ = admin.call('GET', f"/training/requirements/{draft[0]['id']}/export?format=docx", raw=True)
    check('2.6 a requirement that is not approved is refused (409)', st == 409, st)

step('3. APD.0108 the self-reading list')
sid = sql("select s.id from training_sessions s join training_activities a on a.id=s.activity_id where s.method='SELF_READING' order by a.created_at desc limit 1")
st, w = get(admin, f'/training/sessions/{sid}/self-reading-list?format=docx', 'APD0108.docx')
check('3.1 Word of the self-reading list', st == 200 and w[:2] == b'PK', (st, w[:200]))
if st == 200:
    t = words(w)
    check('3.2 the department and the Training Number are written', 'Department' in t and 'TRN/' in t, t[:400])
    st, p = get(admin, f'/training/sessions/{sid}/self-reading-list?format=pdf', 'APD0108.pdf')
    check('3.3 PDF of the self-reading list', st == 200 and p[:4] == b'%PDF', st)
    print('   pages', pages(p, 'APD0108'))
other = sql("select s.id from training_sessions s where s.method<>'SELF_READING' limit 1")
st, _ = admin.call('GET', f'/training/sessions/{other}/self-reading-list?format=docx', raw=True)
check('3.4 a session that is not a self-reading is refused (409)', st == 409, st)

step('4. FRM.0044 the Training Number log')
st, w = get(admin, '/training/number-log/export?year=2026&format=docx', 'FRM0044.docx')
check('4.1 Word of the log', st == 200 and w[:2] == b'PK', (st, w[:200]))
if st == 200:
    t = words(w)
    check('4.2 the numbers of the year are in the log', 'TRN/QA/26-' in t, t[:300])
    st, p = get(admin, '/training/number-log/export?year=2026&format=pdf', 'FRM0044.pdf')
    check('4.3 PDF of the log', st == 200 and p[:4] == b'%PDF', st)
    print('   pages', pages(p, 'FRM0044'))

step('5. APD.0024 the job assignment')
jobs = admin.call('GET', '/training/job-assignments?limit=100')['data']
# an effective assignment of a person who has a specimen signature in force, so that step 6 has something to write
job = next(j for j in (admin.call('GET', f"/training/job-assignments/{x['id']}") for x in jobs if x['status'] == 'EFFECTIVE') if admin.call('GET', f"/training/specimen-signatures/person/{j['personUserId']}/current"))
st, w = get(admin, f"/training/job-assignments/{job['id']}/export?format=docx", 'APD0024.docx')
check('5.1 Word of the job assignment', st == 200 and w[:2] == b'PK', (st, w[:200]))
if st == 200:
    t = words(w)
    check('5.2 the person and the case are written', job['personName'] in t and '\u2612' in t, t[:400])
    st, p = get(admin, f"/training/job-assignments/{job['id']}/export?format=pdf", 'APD0024.pdf')
    check('5.3 PDF of the job assignment', st == 200 and p[:4] == b'%PDF', st)
    print('   pages', pages(p, 'APD0024'))

step('6. FRM.0007 the specimen signatures')
person = job['personUserId']
st, w = get(admin, f'/training/specimen-signatures/person/{person}/export?format=docx', 'FRM0007.docx')
check('6.1 Word of the specimen signatures', st == 200 and w[:2] == b'PK', (st, w[:200]))
if st == 200:
    z = zipfile.ZipFile(io.BytesIO(w))
    check('6.2 the images are in the file', len([n for n in z.namelist() if n.startswith('word/media/')]) >= 2, z.namelist())
    st, p = get(admin, f'/training/specimen-signatures/person/{person}/export?format=pdf', 'FRM0007.pdf')
    check('6.3 PDF of the specimen signatures', st == 200 and p[:4] == b'%PDF', st)
    print('   pages', pages(p, 'FRM0007'))

step('7. APD.0014 the personal training record')
holder = sql("select person_user_id from training_records group by person_user_id order by count(*) desc limit 1")
print('   person', holder)
if holder:
    exp = admin.call('POST', '/training/record-exports', {'personUserId': holder, 'reason': 'E2E-TEST APD.0014', 'approverUserId': qa.user['id'], 'signatureToken': sign(admin)})
    exp = qa.call('POST', f"/training/record-exports/{exp['id']}/approve", {'signatureToken': sign(qa)})
    check('7.1 the export is approved', exp['status'] == 'APPROVED', exp)
    st, pdf = get(admin, f"/training/record-exports/{exp['id']}/download", 'APD0014.pdf')
    check('7.2 the PDF of the record', st == 200 and pdf[:4] == b'%PDF', st)
    print('   pages', pages(pdf, 'APD0014'))
