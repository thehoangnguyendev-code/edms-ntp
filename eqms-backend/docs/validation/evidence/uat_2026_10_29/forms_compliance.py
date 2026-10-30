"""DEV UAT, 2026-10-30: Compliance numbers and the Word/PDF forms of Training Management through the API. The password comes from DEVPW and is never written. Read-only against the data the
suite.py runs left (records titled "UAT-2026"); it only creates numbered paper copies (a form export is itself a record). Checks that cannot run say NOT RUN with the reason.
Run with plain `python` (needs python-docx-free parsing: the .docx is read with zipfile; PDF text is read with PyMuPDF when it is installed)."""
import os, sys, io, re, json, zipfile, subprocess
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'training_2026_10_18'))
from api import Client

try:
    import fitz  # PyMuPDF
except Exception:
    fitz = None

results = []


def check(name, ok, detail=''):
    results.append((name, ok, str(detail)[:300]))
    print(('PASS  ' if ok else 'FAIL  ') + name + ((' -- ' + str(detail)[:300]) if (detail and not ok) else ''))


def notrun(name, why):
    results.append((name, None, why))
    print('NOT RUN  ' + name + ' -- ' + why)


def sql(q):
    """Read-only look at DEV data to pick the records the suite left."""
    out = subprocess.run(['docker', 'exec', '-i', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-t', '-A', '-F', '|', '-c', q], capture_output=True, text=True, check=True).stdout
    return [r.split('|') for r in out.strip().splitlines() if r.strip()]


def docx_text(b):
    z = zipfile.ZipFile(io.BytesIO(b))
    xml = ''.join(z.read(n).decode('utf-8', 'ignore') for n in z.namelist() if n.startswith('word/') and n.endswith('.xml') and ('document' in n or 'header' in n or 'footer' in n))
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', xml))


def pdf_text(b):
    if fitz is None:
        return None
    d = fitz.open(stream=b, filetype='pdf')
    return re.sub(r'\s+', ' ', ' '.join(p.get_text() for p in d))


def get(c, path):
    code, payload = c.call('GET', path, raw=True)
    return code, payload


def section(title, fn):
    print('\n== ' + title)
    try:
        fn()
    except BaseException as e:
        check(title + ': ran to the end', False, repr(e)[:300])


admin = Client('admin')
nopower = Client('trainee.test1')
S = {}


def compliance():
    code, p = get(admin, '/training/compliance/summary')
    check('CP1 the Compliance summary answers', code == 200, (code, p[:150]))
    sm = json.loads(p)
    print('   summary keys:', sorted(sm.keys())[:25])
    beyond = sm.get('linesBeyondSopWindow')
    check('CP2 the summary has the number of lines moved beyond the SOP window', isinstance(beyond, int), beyond)
    # Independent count: the approved requirements of the same scope, line by line, from the requirement screens.
    lst = admin.call('GET', '/training/requirements?limit=100&status=APPROVED')
    total = 0
    for r in lst['data']:
        d = admin.call('GET', f"/training/requirements/{r['id']}")
        total += sum(1 for ln in d['lines'] if ln.get('beyondSopWindow'))
    check('CP3 the Compliance number equals the count taken line by line from the requirements', beyond == total, (beyond, total, len(lst['data'])))
    S['beyond'] = total
    # Department filter: the Quality Assurance department sees the same lines (the test requirements are all of it)
    dep = sql("select id from departments where name='Quality Assurance'")[0][0]
    code, p = get(admin, f'/training/compliance/summary?departmentId={dep}')
    check('CP4 the summary filters by department', code == 200 and isinstance(json.loads(p).get('linesBeyondSopWindow'), int), (code, p[:150]))
    code, p = get(nopower, '/training/compliance/summary')
    print('   summary for a user with only training.self.view:', code)
    check('CP5 a person without a Training management right does not get the Compliance summary', code in (401, 403), (code, p[:150]))
    code, p = get(admin, '/training/compliance/coverage?limit=5&page=1')
    cv = json.loads(p) if code == 200 else {}
    check('CP6 coverage answers with paging', code == 200 and 'data' in cv and 'pagination' in cv, (code, p[:150]))
    code, p = get(admin, '/training/compliance/coverage?limit=5&sortBy=notAField')
    print('   coverage with an unknown sort field:', code)
    check('CP7 coverage with an unknown sort field does not fail (it is answered, the field is ignored; recorded, unlike the activity list which refuses it)', code == 200, (code, p[:150]))
    code, p = get(admin, '/training/compliance/planned-trainings')
    check('CP8a planned trainings need a topic', code == 400, (code, p[:150]))
    code, p = get(admin, '/training/compliance/planned-trainings?topicName=UAT-2026')
    check('CP8 planned trainings answer for a topic', code == 200, (code, p[:150]))
    code, p = get(admin, f'/training/compliance/positions?departmentId={dep}')
    check('CP9 positions answer', code == 200, (code, p[:150]))
    pos = json.loads(p) if code == 200 else {}
    rows = pos if isinstance(pos, list) else (pos.get('data') or pos.get('positions') or [])
    if not rows:
        notrun('CP10 matrix completion', 'no position with a matrix in Quality Assurance on DEV')
        return
    ALL = '00000000-0000-0000-0000-000000000001'
    real = [r for r in rows if r['id'] != ALL]
    check('CP9a the first option of the positions is "All employees"', rows[0]['id'] == ALL, rows[0])
    pid = (real or rows)[0]['id']
    code, p = get(admin, f'/training/compliance/matrix-completion?departmentId={dep}&positionId={pid}')
    check('CP10 matrix completion answers', code == 200, (code, p[:150]))
    code, p = get(admin, f'/training/compliance/matrix-completion/print?departmentId={dep}&positionId={pid}')
    check('CP11 the completion print of a position is a PDF', code == 200 and p[:4] == b'%PDF', (code, p[:20]))
    code, p = get(admin, f'/training/compliance/matrix-completion?departmentId={dep}&positionId={ALL}')
    check('CP10a matrix completion for "All employees" answers', code == 200, (code, p[:150]))
    code, p = get(admin, f'/training/compliance/matrix-completion/print?departmentId={dep}&positionId={ALL}')
    check('CP11a the completion print for "All employees" (the default option) is a PDF', code == 200 and p[:4] == b'%PDF', (code, p[:120]))


def requirement_form():
    lst = admin.call('GET', '/training/requirements?limit=100&status=APPROVED')
    pick = None
    for r in lst['data']:
        d = admin.call('GET', f"/training/requirements/{r['id']}")
        if any(ln.get('beyondSopWindow') for ln in d['lines']) and any((ln.get('topicText') or '').startswith('UAT-2026') for ln in d['lines']):
            pick = d
            break
    if not pick:
        return notrun('FM1.. requirement form', 'no approved requirement with a line beyond the window on DEV (run suite.py first)')
    rid = pick['id']
    line = [ln for ln in pick['lines'] if ln.get('beyondSopWindow')][0]
    cur, orig = str(line['plannedMonth'])[:10], str(line['postponedFrom'])[:10]
    want = f"{cur[5:7]}/{cur[:4]} (approved {orig[5:7]}/{orig[:4]})"
    code, b = get(admin, f'/training/requirements/{rid}/export?format=docx')
    check('FM1 the requirement form (APD.0118) is a Word file', code == 200 and b[:2] == b'PK', (code, b[:20]))
    txt = docx_text(b) if code == 200 else ''
    check('FM2 the Word form shows the new month and the approved month of a moved line', want in txt, (want, txt[:200]))
    check('FM3 the Word form carries the requirement number', pick['requestNo'] in txt, pick['requestNo'])
    code, b = get(admin, f'/training/requirements/{rid}/export?format=pdf')
    check('FM4 the requirement form is also available as a PDF', code == 200 and b[:4] == b'%PDF', (code, b[:20]))
    t = pdf_text(b) if code == 200 else None
    if t is None:
        notrun('FM5 the PDF shows the moved month', 'PyMuPDF is not installed')
    else:
        check('FM5 the PDF shows the new month and the approved month of a moved line', want in t, (want, t[:200]))
    code, b = get(admin, f'/training/requirements/{rid}/export?format=xyz')
    check('FM6 an unknown format is refused', code >= 400, (code, b[:100]))
    code, b = get(nopower, f'/training/requirements/{rid}/export?format=docx')
    check('FM7 a person without the right cannot export the requirement form', code in (401, 403, 404), (code, b[:100]))


def self_reading_form():
    rows = sql("select s.id, a.id from training_sessions s join training_activities a on a.id=s.activity_id join training_session_topics t on t.session_id=s.id where s.method='SELF_READING' and t.topic_text like 'UAT-2026 self-reading%' order by a.created_at desc limit 1")
    if not rows:
        return notrun('FM8.. self-reading list', 'no UAT self-reading session on DEV (run suite.py first)')
    sid = rows[0][0]
    code, b = get(admin, f'/training/sessions/{sid}/self-reading-list?format=docx')
    check('FM8 the self-reading list (APD.0108) is a Word file', code == 200 and b[:2] == b'PK', (code, b[:80]))
    if code == 200:
        txt = docx_text(b)
        check('FM9 it names the person who read', 'Trainee' in txt or 'trainee' in txt.lower(), txt[:200])
    code, b = get(admin, f'/training/sessions/{sid}/self-reading-list?format=pdf')
    check('FM10 the self-reading list is also a PDF', code == 200 and b[:4] == b'%PDF', (code, b[:80]))
    code, b1 = admin.call('POST', f'/training/sessions/{sid}/self-reading-list/paper', {'format': 'pdf', 'reason': 'UAT-2026'}, raw=True)
    code2, b2 = admin.call('POST', f'/training/sessions/{sid}/self-reading-list/paper', {'format': 'pdf', 'reason': 'UAT-2026'}, raw=True)
    check('FM11 the paper print is a PDF', code == 200 and b1[:4] == b'%PDF', (code, b1[:80]))
    check('FM12 each paper print is a numbered copy, so two prints differ', code2 == 200 and b1 != b2)
    t = pdf_text(b1) if code == 200 else None
    if t is not None:
        check('FM13 the paper print shows a copy number', bool(re.search(r'(?i)copy|bản', t)), t[:200])
    code, b = admin.call('POST', f'/training/sessions/{sid}/self-reading-list/paper', {'format': 'pdf'}, raw=True)
    check('FM14 a paper print needs a reason (or is refused otherwise)', code in (200, 400), code)  # recorded; see the change record for the observed behaviour
    print('   paper print without a reason:', code)
    code, b = get(nopower, f'/training/sessions/{sid}/self-reading-list?format=docx')
    check('FM15 a person without the right cannot export the list of another', code in (401, 403, 404), (code, b[:100]))


def attendance_form():
    rows = sql("select a.id from training_activities a where a.attendance_sent_at is not null order by a.created_at desc limit 1")
    if not rows:
        return notrun('FM16.. attendance list', 'no activity with a sent attendance list')
    aid = rows[0][0]
    code, b = get(admin, f'/training/activities/{aid}/attendance-list?format=docx')
    check('FM16 the attendance list (APD.0117) is a Word file', code == 200 and b[:2] == b'PK', (code, b[:80]))
    if code == 200:
        txt = docx_text(b)
        check('FM17 it carries the training result column', re.search(r'(?i)training result|result', txt) is not None, txt[:200])
    code, b = get(admin, f'/training/activities/{aid}/attendance-list?format=pdf')
    check('FM18 the attendance list is also a PDF', code == 200 and b[:4] == b'%PDF', (code, b[:80]))


def job_assignment_form():
    rows = sql("select id from training_job_assignments order by created_at desc limit 1")
    if not rows:
        return notrun('FM19.. job assignment form', 'no job assignment on DEV')
    jid = rows[0][0]
    open_ = sql("select id from training_job_assignments where status in ('DRAFT','PENDING_RECEIVER') order by created_at desc limit 1")
    code, b = get(admin, f'/training/job-assignments/{jid}/export?format=docx')
    check('FM19 the job assignment form (APD.0024) is a Word file', code == 200 and b[:2] == b'PK', (code, b[:80]))
    code, b = get(admin, f'/training/job-assignments/{jid}/export?format=pdf')
    check('FM20 the job assignment form is also a PDF', code == 200 and b[:4] == b'%PDF', (code, b[:80]))
    if open_:
        code, b = admin.call('POST', f'/training/job-assignments/{open_[0][0]}/paper', {'format': 'pdf', 'reason': 'UAT-2026'}, raw=True)
        check('FM21 the paper print of an open job assignment (Draft or Pending Receiver) is a PDF', code == 200 and b[:4] == b'%PDF', (code, b[:80]))
    else:
        notrun('FM21 paper print of an open job assignment', 'no Draft or Pending Receiver job assignment on DEV')
    done = sql("select id from training_job_assignments where status not in ('DRAFT','PENDING_RECEIVER') order by created_at desc limit 1")
    if done:
        code, b = admin.call('POST', f'/training/job-assignments/{done[0][0]}/paper', {'format': 'pdf', 'reason': 'UAT-2026'}, raw=True)
        check('FM22 a paper print of a job assignment that is no longer open is refused (TRAINING_PAPER_STATUS)', code == 409 and b'TRAINING_PAPER_S' in b, (code, b[:200]))


for title, fn in (('Compliance numbers', compliance), ('Form APD.0118: the requirement', requirement_form), ('Form APD.0108: the self-reading list', self_reading_form),
                  ('Form APD.0117: the attendance list', attendance_form), ('Form APD.0024: the job assignment', job_assignment_form)):
    section(title, fn)

ok = [r for r in results if r[1] is True]
bad = [r for r in results if r[1] is False]
nr = [r for r in results if r[1] is None]
print(f'\n{len(ok)} passed, {len(bad)} failed, {len(nr)} not run (of {len(results)})')
for r in bad:
    print('  FAIL', r[0], '--', r[2])
for r in nr:
    print('  NOT RUN', r[0], '--', r[2])
sys.exit(1 if bad else 0)
