"""DEV UAT suite, 2026-10-29: Document Control and Training Management through the API, written against the system as it is today (one signature at Finish Training, postponement with the
Due Date question). Each section is independent; an error in one is a FAIL of that section and the run goes on. The password comes from DEVPW and is never written; records are titled "UAT-2026 ...";
none is deleted. Exit code 1 when any check fails. Checks that cannot run say NOT RUN with the reason (they are not counted as passed)."""
import os, sys, io, json, zipfile, datetime, calendar
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'training_2026_10_18'))
from api import Client, tick_all

PW = os.environ['DEVPW']
TODAY = datetime.date.today()
results = []


def check(name, ok, detail=''):
    results.append((name, ok, str(detail)[:300]))
    print(('PASS  ' if ok else 'FAIL  ') + name + ((' -- ' + str(detail)[:300]) if (detail and not ok) else ''))


def notrun(name, why):
    results.append((name, None, why))
    print('NOT RUN  ' + name + ' -- ' + why)


def sign(c):
    return c.call('POST', '/auth/verify-signature', {'username': c.user['username'], 'password': PW})['signatureToken']


def attempt(c, method, path, body=None):
    code, payload = c.call(method, path, body, raw=True)
    try:
        data = json.loads(payload) if payload else {}
    except Exception:
        data = {}
    return code, data, payload[:300].decode('utf-8', 'ignore')


def section(title, fn):
    print('\n== ' + title)
    try:
        fn()
    except BaseException as e:  # Client.call raises SystemExit on an HTTP error
        check(title + ': ran to the end', False, repr(e)[:300])


def mini_docx(text):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        z.writestr('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        z.writestr('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>' + text + '</w:t></w:r></w:p></w:body></w:document>')
    return buf.getvalue()


def mini_pdf(text):
    objs = [b'<< /Type /Catalog /Pages 2 0 R >>', b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>']
    stream = ('BT /F1 14 Tf 60 780 Td (' + text + ') Tj ET').encode()
    objs.append(b'<< /Length ' + str(len(stream)).encode() + b' >>\nstream\n' + stream + b'\nendstream')
    objs.append(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
    out = b'%PDF-1.4\n'
    offs = []
    for i, o in enumerate(objs, 1):
        offs.append(len(out))
        out += str(i).encode() + b' 0 obj\n' + o + b'\nendobj\n'
    x = len(out)
    out += b'xref\n0 ' + str(len(objs) + 1).encode() + b'\n0000000000 65535 f \n'
    for o in offs:
        out += ('%010d 00000 n \n' % o).encode()
    out += b'trailer\n<< /Size ' + str(len(objs) + 1).encode() + b' /Root 1 0 R >>\nstartxref\n' + str(x).encode() + b'\n%%EOF'
    return out


admin = Client('admin')              # author / organizer / conductor, QA Manager
reviewer = Client('dco.test1')       # DCO: reviewer of the document
approver = Client('approver.test1')  # approver; confirms the completion in Training
trainee = Client('user.a.test')
S = {}   # state shared between sections


def doc_body(name):
    return {'documentName': name, 'documentType': 'Standard Operating Procedure', 'businessUnit': 'Quality Unit', 'department': 'Quality Assurance', 'author': admin.user['id'], 'language': 'English',
            'requiresTraining': True, 'trainingPeriodDays': 14, 'description': 'UAT-2026', 'isTemplate': False, 'coAuthorIds': [], 'reviewerUserIds': [reviewer.user['id']],
            'approverUserIds': [approver.user['id']], 'relatedDocumentIds': [], 'correlatedDocumentIds': []}


def step(c, rid, name, body=None):
    body = {'signatureToken': sign(c), 'comment': 'UAT-2026', 'reason': 'UAT-2026', **(body or {})}
    return attempt(c, 'POST', f'/revisions/{rid}/{name}', body)


# ---------------------------------------------------------------------------------------------- Document Control
def dc_create_and_lifecycle():
    doc = admin.call('POST', '/documents', doc_body('UAT-2026 SOP lifecycle'))
    S['doc'] = doc
    check('DC1 a document is created with a number and a status', bool(doc.get('documentNumber')) and bool(doc.get('status')), doc.get('status'))
    lst = admin.call('GET', '/training/activities?limit=5&search=' + doc['documentNumber'])
    rows = [r for r in lst['data'] if r.get('documentNumber') == doc['documentNumber']]
    check('DC2 a document that requires training gets a Training Number at once', len(rows) == 1, lst['data'])
    S['aid'] = rows[0]['id'] if rows else None
    rev = admin.call('POST', f"/documents/{doc['id']}/revisions", {})
    rid = rev['id']
    S['rid'] = rid
    admin.upload(f'/revisions/{rid}/upload', 'file', 'uat.docx', mini_docx('UAT-2026'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    code, d, t = attempt(admin, 'POST', f'/revisions/{rid}/complete-editing', {'comment': 'UAT-2026', 'reason': 'UAT-2026'})
    check('DC3 an action without an electronic signature is refused', code in (400, 401, 403), (code, t))
    code, d, t = step(admin, rid, 'complete-editing')
    check('DC4 editing completed with a signature', code == 200, (code, t))
    code, d, t = step(reviewer, rid, 'review/complete')
    check('DC5 a review cannot be completed before the revision is submitted', code >= 400, (code, t))
    code, d, t = step(admin, rid, 'submit-review')
    check('DC6 submitted for review', code == 200, (code, t))
    code, d, t = step(admin, rid, 'review/complete')
    check('DC7 the author cannot review their own revision (segregation of duties)', code >= 400, (code, t))
    code, d, t = step(approver, rid, 'approve/complete')
    check('DC8 approval cannot come before the review', code >= 400, (code, t))
    code, d, t = step(reviewer, rid, 'review/complete')
    check('DC9 reviewed by the assigned reviewer', code == 200, (code, t))
    code, d, t = step(admin, rid, 'approve/complete')
    check('DC10 the author cannot approve their own revision', code >= 400, (code, t))
    code, d, t = step(approver, rid, 'approve/complete')
    check('DC11 approved by the assigned approver', code == 200, (code, t))
    r = admin.call('GET', f'/revisions/{rid}')
    S['rev_status'] = r.get('status')
    print('   revision status after the approval:', r.get('status'))
    check('DC12 the revision has a status after the approval', bool(r.get('status')), r.get('status'))


def dc_publish_and_after():
    rid = S.get('rid')
    if not rid:
        return notrun('DC13 Complete Training refused early', 'DC lifecycle did not create a revision')
    code, d, t = step(admin, rid, 'training/complete')
    check('DC13 Complete Training of the revision is refused while the training is not finished', code >= 400, (code, t))


def dc_cancel_branch():
    doc = admin.call('POST', '/documents', doc_body('UAT-2026 SOP cancelled'))
    rev = admin.call('POST', f"/documents/{doc['id']}/revisions", {})
    rid = rev['id']
    code, d, t = attempt(admin, 'POST', f'/revisions/{rid}/cancel', {'signatureToken': sign(admin), 'comment': '', 'reason': ''})
    check('DC14 a cancellation needs a reason', code >= 400, (code, t))
    code, d, t = attempt(admin, 'POST', f'/revisions/{rid}/cancel', {'signatureToken': sign(admin), 'comment': 'UAT-2026 cancelled', 'reason': 'UAT-2026 cancelled'})
    check('DC15 a revision is cancelled with a reason and a signature', code == 200, (code, t))
    r = admin.call('GET', f'/revisions/{rid}')
    check('DC16 the revision is closed as cancelled', 'CANCEL' in str(r.get('status')).upper(), r.get('status'))


# ---------------------------------------------------------------------------------------------- Training
def tr_full_flow():
    aid = S.get('aid')
    if not aid:
        return notrun('TR1.. full flow', 'no Training Number from the document')
    get = lambda: admin.call('GET', f'/training/activities/{aid}')
    a = get()
    check('TR1 the activity is Planned after the approval, with a due date', a['status'] == 'PLANNED' and bool(a.get('dueDate')), (a['status'], a.get('dueDate')))
    a = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'UAT Trainer', 'scheduledOn': TODAY.isoformat(), 'venue': 'Room 1', 'topics': [{'topicText': 'UAT-2026 SOP'}]})
    sid = a['sessions'][0]['id']
    admin.upload(f'/training/activities/{aid}/materials', 'file', 'uat.pdf', mini_pdf('UAT-2026'), 'application/pdf', '?purpose=EXAM&title=UAT-2026%20test')
    a = admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': [trainee.user['id']], 'reason': 'UAT-2026'})
    pid = a['participants'][0]['id']
    admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'UAT-2026'})
    admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': approver.user['id']})
    admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': trainee.user['id']})
    approver.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(approver)})
    trainee.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(trainee)})
    code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/notify', {'version': get()['version']})
    check('TR2 the notice needs a signature', code == 400 and 'TRAINING_SIGNATURE_REQUIRED' in t, (code, t))
    admin.call('POST', f'/training/activities/{aid}/notify', {'version': get()['version'], 'signatureToken': sign(admin)})
    check('TR3 notified', get()['status'] == 'NOTIFIED', get()['status'])
    tick_all(admin, sid)
    admin.call('POST', f'/training/sessions/{sid}/hold', {'signatureToken': sign(admin)})
    a = get()
    check('TR4 In Progress after the session is started', a['status'] == 'IN_PROGRESS', a['status'])
    code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/finish-training', {'version': a['version'], 'signatureToken': sign(admin)})
    check('TR5 Finish Training is refused before the attendance list is sent', code == 409 and 'TRAINING_ATTENDANCE_NOT_SENT' in t, (code, t))
    admin.call('POST', f'/training/participants/{pid}/attendance', {'state': 'ATTENDED'})
    admin.call('POST', f'/training/activities/{aid}/send-attendance-list', {'version': get()['version'], 'signatureToken': sign(admin)})
    a = get()
    check('TR6 the attendance list is sent (date and person kept)', bool(a.get('attendanceSentAt')) and bool(a.get('attendanceSentByName')), a.get('attendanceSentAt'))
    code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/finish-training', {'version': a['version'], 'signatureToken': sign(admin)})
    check('TR7 Finish Training is refused while a result is missing', code == 409 and 'TRAINING_RESULT_PENDING' in t, (code, t))
    admin.call('POST', f'/training/participants/{pid}/assessments', {'scoreObtained': 9, 'scoreMax': 10})
    a = get()
    check('TR8 every result in: Finish Training is offered', a['capabilities'].get('finishTraining') is True, a['capabilities'])
    code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/finish-training', {'version': a['version']})
    check('TR9 Finish Training needs a signature', code == 400 and 'TRAINING_SIGNATURE_REQUIRED' in t, (code, t))
    code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/submit-for-confirmation', {'version': a['version'], 'signatureToken': sign(admin)})
    check('TR10 the separate "Send results to QA" step no longer exists', code in (404, 405), (code, t))
    a = admin.call('POST', f'/training/activities/{aid}/finish-training', {'version': a['version'], 'signatureToken': sign(admin)})
    check('TR11 one signature finishes the training and sends the results to QA (Pending QA Confirmation)', a['status'] == 'PENDING_QA_CONFIRMATION' and bool(a.get('resultsFinishedAt')), (a['status'], a.get('resultsFinishedAt')))
    check('TR12 Training Completed On is set at the finish', bool(a.get('completedOn')), a.get('completedOn'))
    code, d, t = attempt(admin, 'POST', f'/training/participants/{pid}/assessments', {'scoreObtained': 10, 'scoreMax': 10})
    check('TR13 no result can be changed after the finish', code == 409, (code, t))
    code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/confirm-completion', {'version': get()['version'], 'signatureToken': sign(admin)})
    check('TR14 the organizer cannot confirm the completion (it is for QA)', code >= 400, (code, t))
    a = approver.call('POST', f'/training/activities/{aid}/confirm-completion', {'version': get()['version'], 'signatureToken': sign(approver)})
    check('TR15 QA confirms: Completed', a['status'] == 'COMPLETED', a['status'])
    check('TR16 the confirmations keep who and when', len(a['confirmations']) >= 1 and all(x.get('confirmedByName') for x in a['confirmations']), a['confirmations'][:2])


def tr_dc_link():
    rid = S.get('rid')
    if not rid:
        return notrun('TR17 revision completes after training', 'no revision')
    link = admin.call('GET', f'/training/links/revisions/{rid}')
    check('TR17 the revision sees the day the training was finished', bool(link.get('finishedOn')) or bool(link.get('completedOn')), link)
    code, d, t = step(admin, rid, 'training/complete')
    check('TR18 Complete Training (Revision) works after the training is finished', code == 200, (code, t))
    r = admin.call('GET', f'/revisions/{rid}')
    print('   revision status after Complete Training:', r.get('status'))
    check('TR19 the revision moved on after the training', r.get('status') != S.get('rev_status'), (S.get('rev_status'), r.get('status')))


def dc_publish_upgrade_obsolete():
    """After Complete Training the revision is Ready for Publishing: publish it through the Publishing Workspace (asynchronous job), upgrade the document to a new revision, obsolete it."""
    import time
    rid, doc = S.get('rid'), S.get('doc')
    if not rid or not doc:
        return notrun('PB1.. publish, upgrade, obsolete', 'no revision/document from the earlier sections')
    base = f'/revisions/{rid}/publishing-workspace'
    code, ws, t = attempt(admin, 'GET', base)
    check('PB1 the Publishing Workspace opens for a revision that is Ready for Publishing', code == 200, (code, t))
    print('   workspace keys:', sorted(ws.keys())[:20] if isinstance(ws, dict) else ws)
    tmpl = ws.get('publishingTemplateId') or ws.get('selectedTemplateId') or (ws.get('selectedTemplate') or {}).get('id')
    if not tmpl and ws.get('templates'):
        tmpl = ws['templates'][0].get('id')
    body = {'publishingTemplateId': tmpl, 'changeSummary': 'UAT-2026 first issue', 'reason': 'UAT-2026'}
    code, d, t = attempt(admin, 'POST', base + '/publish', body)
    check('PB2 publishing without an electronic signature is refused', code >= 400, (code, t))
    nopub = Client('trainee.test1')   # holds no documents.revision.publish (checked in the DB before the run)
    code, d, t = attempt(nopub, 'POST', base + '/publish', {**body, 'signatureToken': sign(nopub)})
    check('PB3 a person without the publish right cannot publish', code in (401, 403), (code, t))
    code, d, t = attempt(admin, 'POST', base + '/generate-preview', body)
    check('PB3b the publishing preview is generated', code == 200, (code, t))
    for _ in range(20):
        w = admin.call('GET', base)
        if w.get('previewReady'):
            break
        time.sleep(3)
    check('PB3c the preview is ready and not stale', bool(w.get('previewReady')) and not w.get('previewStale'), {k: w.get(k) for k in ('previewReady', 'previewStale', 'publishReady')})
    code, d, t = attempt(admin, 'POST', base + '/publish', {**body, 'signatureToken': sign(admin)})
    check('PB4 publish is accepted (asynchronous job)', code in (200, 202), (code, t))
    status = None
    for _ in range(40):
        time.sleep(3)
        status = admin.call('GET', f'/revisions/{rid}').get('status')
        if str(status).upper().startswith('PUBLISH') or str(status).upper() in ('EFFECTIVE', 'ACTIVE'):
            break
    print('   revision status after publishing:', status)
    check('PB5 the revision is Published/Effective when the job ends', str(status).upper().startswith('PUBLISH') or str(status).upper() in ('EFFECTIVE', 'ACTIVE'), status)
    dd = admin.call('GET', f"/documents/{doc['id']}")
    print('   document status after publishing:', dd.get('status'))
    check('PB6 the document has a status after publishing', bool(dd.get('status')), dd.get('status'))
    code, d, t = attempt(admin, 'POST', f"/documents/{doc['id']}/obsolete", {'reason': ''})
    check('PB7 Obsolete needs a reason (and a signature)', code >= 400, (code, t))
    code, d, t = attempt(admin, 'POST', f"/documents/{doc['id']}/upgrade-revision")
    check('PB8 Upgrade Revision creates the next revision of a published document', code == 200 and bool(d.get('id')) and d.get('id') != rid, (code, t))
    S['rid2'] = d.get('id')
    print('   upgraded revision:', d.get('revisionNumber') or d.get('revision'), d.get('status'))
    code, d, t = attempt(admin, 'POST', f"/documents/{doc['id']}/upgrade-revision")
    check('PB9 a second Upgrade Revision while one is open is refused', code >= 400, (code, t))
    code, d, t = attempt(admin, 'POST', f"/documents/{doc['id']}/obsolete", {'reason': 'UAT-2026 obsolete', 'signatureToken': sign(admin)})
    check('PB10 Obsolete is refused while a newer revision is open', code == 409 and 'DOCUMENT_OBSOLETE_REVISION_IN_PROGRESS' in t, (code, t))
    code, d, t = attempt(admin, 'POST', f"/revisions/{S['rid2']}/cancel", {'signatureToken': sign(admin), 'comment': 'UAT-2026 cancel', 'reason': 'UAT-2026 cancel'})
    check('PB11 the open revision is cancelled', code == 200, (code, t))
    code, d, t = attempt(admin, 'POST', f"/documents/{doc['id']}/obsolete", {'reason': 'UAT-2026 obsolete', 'signatureToken': sign(admin)})
    check('PB12 Obsolete works once no revision is open', code == 200, (code, t))
    dd = admin.call('GET', f"/documents/{doc['id']}")
    check('PB13 the document is Obsolete', 'OBSOLET' in str(dd.get('status')).upper(), dd.get('status'))


def _set_qa_head(user_id):
    """DEV only: the Department Head of Quality Assurance (the master data). The original is NULL; the runner script and the finally below put it back."""
    import subprocess
    val = "'" + user_id + "'" if user_id else 'null'
    subprocess.run(['docker', 'exec', '-i', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-q', '-v', 'ON_ERROR_STOP=1', '-c',
                    f"update departments set department_head_id = {val} where name = 'Quality Assurance'"], check=True, capture_output=True)


def _self_reading_activity(label, person):
    due = TODAY.replace(day=calendar.monthrange(TODAY.year, TODAY.month)[1])
    a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'dueDate': due.isoformat()})
    aid = a['id']
    get = lambda: admin.call('GET', f'/training/activities/{aid}')
    a = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'SELF_READING', 'assessmentMethod': 'SELF_READING_CONFIRMATION', 'externalTrainerName': 'External Trainer', 'scheduledOn': TODAY.isoformat(), 'venue': 'Room 1', 'topics': [{'topicText': 'UAT-2026 self-reading ' + label}]})
    sid = a['sessions'][0]['id']
    try:
        admin.call('POST', f'/training/activities/{aid}/material-links', {'title': 'UAT-2026 material', 'url': 'https://example.com/uat'})
    except BaseException:
        pass
    a = admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': [person.user['id']], 'reason': 'UAT-2026'})
    pid = a['participants'][0]['id']
    admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'UAT-2026'})
    admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': approver.user['id']})
    admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': trainee.user['id']})
    approver.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(approver)})
    trainee.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(trainee)})
    admin.call('POST', f'/training/activities/{aid}/notify', {'version': get()['version'], 'signatureToken': sign(admin)})
    tick_all(admin, sid)
    admin.call('POST', f'/training/sessions/{sid}/hold', {'signatureToken': sign(admin)})
    attempt_ok = attempt(person, 'POST', f'/training/me/participations/{pid}/confirm-read', {'signatureToken': sign(person)})
    return aid, pid, attempt_ok


def tr_self_reading_by_department():
    """APD.0108: one confirmation per department. The people are in Quality Assurance (master data). First it has no Department Head, then trainer.test1 is made the head."""
    t1, t2, head = Client('trainee.test1'), Client('trainee.test2'), Client('trainer.test1')
    try:
        _set_qa_head(None)
        aid, pid, (code, d, t) = _self_reading_activity('no head', t1)
        check('SR1 the employee confirms the reading with a signature', code == 200, (code, t))
        a = admin.call('GET', f'/training/activities/{aid}')
        dep = [x for x in a['selfReadingDepartments'] if x.get('departmentName') == 'Quality Assurance']
        check('SR2 the department with no head is listed and waiting', len(dep) == 1 and dep[0]['waiting'] == 1 and dep[0].get('headName') is None, dep)
        code, d, t = attempt(t1, 'POST', f'/training/activities/{aid}/verify-self-reading', {'signatureToken': sign(t1), 'reason': 'UAT-2026'})
        check('SR3 an ordinary participant cannot verify a self-reading', code >= 400, (code, t))
        code, d, t = attempt(head, 'POST', f'/training/activities/{aid}/verify-self-reading', {'signatureToken': sign(head), 'reason': 'UAT-2026'})
        check('SR4 a person who is no head and cannot close a training cannot verify (no head set yet)', code >= 400, (code, t))
        code, d, t = attempt(approver, 'POST', f'/training/activities/{aid}/verify-self-reading', {'signatureToken': sign(approver), 'reason': 'UAT-2026'})
        check('SR5 a department with no head is confirmed by a holder of training.activity.close', code == 200, (code, t))
        a = admin.call('GET', f'/training/activities/{aid}')
        p = [x for x in a['participants'] if x['id'] == pid][0]
        conf = [c for c in a['confirmations'] if c.get('kind') == 'HEAD_SELF_READING']
        check('SR6 the participant is Passed and the record says it was done in place of the head',
              p['result'] == 'PASSED' and len(conf) == 1 and 'in place of the department head' in str(conf[0].get('remark')), (p['result'], conf))

        _set_qa_head(head.user['id'])
        aid, pid, (code, d, t) = _self_reading_activity('with head', t2)
        check('SR7 (with a head) the employee confirms the reading', code == 200, (code, t))
        code, d, t = attempt(head, 'GET', f'/training/activities/{aid}')
        check('SR8 the Department Head can open the activity of their department', code == 200, (code, t))
        lst = attempt(head, 'GET', '/training/activities?limit=50&search=' + str(admin.call('GET', f'/training/activities/{aid}').get('trainingNumber')))[1]
        check('SR9 the activity is in the Department Head\'s list', any(r.get('id') == aid for r in lst.get('data', [])), lst.get('data', [])[:2])
        h = head.call('GET', f'/training/activities/{aid}')
        dep = [x for x in h['selfReadingDepartments'] if x.get('departmentName') == 'Quality Assurance']
        check('SR10 the head sees their department as theirs, not as a substitute', len(dep) == 1 and dep[0].get('mine') is True and not dep[0].get('substitute'), dep)
        code, d, t = attempt(approver, 'POST', f'/training/activities/{aid}/verify-self-reading', {'signatureToken': sign(approver), 'reason': 'UAT-2026'})
        check('SR11 once the department has a head, a holder of close cannot confirm in their place', code == 403, (code, t))
        code, d, t = attempt(head, 'POST', f'/training/activities/{aid}/verify-self-reading', {'signatureToken': sign(head), 'reason': 'UAT-2026'})
        check('SR12 the Department Head confirms their department', code == 200, (code, t))
        a = admin.call('GET', f'/training/activities/{aid}')
        p = [x for x in a['participants'] if x['id'] == pid][0]
        conf = [c for c in a['confirmations'] if c.get('kind') == 'HEAD_SELF_READING']
        check('SR13 Passed, confirmed by the head with no "in place" remark', p['result'] == 'PASSED' and len(conf) == 1 and 'in place' not in str(conf[0].get('remark')) and conf[0].get('confirmedByName') == head.user['fullName'], (p['result'], conf))
    finally:
        _set_qa_head(None)


def tr_requirement_line_follows():
    """A requirement line follows its activity when the session is postponed past the Due Date and the user agrees; the approved month stays; a move of more than a month is marked."""
    month = TODAY.replace(day=1)
    plus = lambda n: (month + datetime.timedelta(days=31 * n)).replace(day=1)
    due = TODAY.replace(day=calendar.monthrange(TODAY.year, TODAY.month)[1])
    req = admin.call('POST', '/training/requirements', {'year': TODAY.year, 'kind': 'ANNUAL'})
    rid = req['id']
    S['req'] = rid
    check('RQ1 a requirement is created as a draft with a number', req['status'] == 'DRAFT' and bool(req.get('requestNo')), (req.get('status'), req.get('requestNo')))
    req = admin.call('PUT', f'/training/requirements/{rid}', {'version': req['version'], 'lines': [
        {'plannedMonth': month.isoformat(), 'topicText': 'UAT-2026 line one month'},
        {'plannedMonth': month.isoformat(), 'topicText': 'UAT-2026 line two months'}]})
    check('RQ2 two lines are saved', len(req['lines']) == 2, req.get('lines'))
    req = admin.call('POST', f'/training/requirements/{rid}/submit', {'version': req['version'], 'signatureToken': sign(admin), 'nextApproverUserId': approver.user['id']})
    check('RQ3 submitted for review', req['status'] == 'PENDING_REVIEW', req['status'])
    req = approver.call('POST', f'/training/requirements/{rid}/review', {'version': req['version'], 'signatureToken': sign(approver), 'nextApproverUserId': trainee.user['id']})
    check('RQ4 reviewed, sent for approval', req['status'] == 'PENDING_APPROVAL', req['status'])
    code, d, t = attempt(admin, 'POST', f'/training/requirements/{rid}/approve', {'version': req['version'], 'signatureToken': sign(admin)})
    check('RQ5 the preparer cannot approve their own requirement', code >= 400, (code, t))
    req = trainee.call('POST', f'/training/requirements/{rid}/approve', {'version': req['version'], 'signatureToken': sign(trainee)})
    check('RQ6 approved', req['status'] == 'APPROVED', req['status'])
    acts = []
    for ln in sorted(req['lines'], key=lambda x: x['lineNo']):
        req = admin.call('POST', f"/training/requirements/lines/{ln['id']}/open-activity")
        line = [x for x in req['lines'] if x['id'] == ln['id']][0]
        acts.append((ln['id'], line.get('activityId')))
    check('RQ7 an activity is opened for each line', all(a for _, a in acts), acts)
    head = Client('trainer.test1')
    _set_qa_head(head.user['id'])   # temporary; the runner and the line after the loop put it back to empty
    for (lid, aid), n, label in ((acts[0], 1, 'one month'), (acts[1], 2, 'two months')):
        a = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'UAT Trainer', 'scheduledOn': TODAY.isoformat(), 'venue': 'Room 1', 'topics': [{'topicText': 'UAT-2026 ' + label}]})
        sid = a['sessions'][0]['id']
        newdate = plus(n).replace(day=12)
        a = admin.call('POST', f'/training/sessions/{sid}/postpone', {'newDate': newdate.isoformat(), 'reason': 'UAT-2026 ' + label, 'moveDueDate': True})
        r = admin.call('GET', f'/training/requirements/{rid}')
        line = [x for x in r['lines'] if x['id'] == lid][0]
        print('   line after', label, {k: line.get(k) for k in ('plannedMonth', 'postponedFrom', 'postponeReason', 'beyondSopWindow')})
        check(f'RQ8.{n} ({label}) the line follows the new Due Date month', str(line.get('plannedMonth'))[:10] == plus(n).isoformat(), line.get('plannedMonth'))
        check(f'RQ9.{n} ({label}) the approved month is kept', str(line.get('postponedFrom'))[:10] == month.isoformat(), line.get('postponedFrom'))
        check(f'RQ10.{n} ({label}) the reason is kept', 'UAT-2026' in str(line.get('postponeReason')), line.get('postponeReason'))
        check(f'RQ11.{n} ({label}) "Beyond SOP window" is {n > 1}', bool(line.get('beyondSopWindow')) == (n > 1), line.get('beyondSopWindow'))
    _set_qa_head(None)
    code, nd, t = attempt(head, 'GET', '/notifications?type=training-requirement-line-moved&limit=50')
    print('   notifications to the department head:', [str(x.get('description'))[:140] for x in nd.get('data', [])[:3]])
    check('RQ12 the organizing department head is told when a line moves', code == 200 and len(nd.get('data', [])) >= 2, (code, t))
    check('RQ13 the notice of a move of more than one month says it is later than the window', any('later than' in str(x.get('description')) for x in nd.get('data', [])), [str(x.get('description'))[:120] for x in nd.get('data', [])[:3]])
    check('RQ14 the notice of a one-month move does not say it', sum('later than' in str(x.get('description')) for x in nd.get('data', [])[:2]) == 1, [str(x.get('description'))[:80] for x in nd.get('data', [])[:2]])


def tr_postpone():
    due = TODAY.replace(day=calendar.monthrange(TODAY.year, TODAY.month)[1])
    nxt = (TODAY.replace(day=1) + datetime.timedelta(days=32)).replace(day=12)
    nxt_end = nxt.replace(day=calendar.monthrange(nxt.year, nxt.month)[1])
    for label, move in (('move', True), ('keep', False), ('within', True)):
        a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'dueDate': due.isoformat()})
        aid = a['id']
        a = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'UAT Trainer', 'scheduledOn': TODAY.isoformat(), 'venue': 'Room 1', 'topics': [{'topicText': 'UAT-2026 postpone ' + label}]})
        sid = a['sessions'][0]['id']
        if label == 'move':
            code, d, t = attempt(admin, 'POST', f'/training/sessions/{sid}/postpone', {'newDate': nxt.isoformat()})
            check('PO1 a postponement without a reason is refused', code == 400, (code, t))
        new = nxt if label != 'within' else due
        a = admin.call('POST', f'/training/sessions/{sid}/postpone', {'newDate': new.isoformat(), 'reason': 'UAT-2026 ' + label, 'moveDueDate': move})
        got = str(a.get('dueDate'))[:10]
        if label == 'move':
            check('PO2 postponed past the due date and the user agrees: Due Date moves to the end of that month', got == nxt_end.isoformat(), (got, nxt_end))
        elif label == 'keep':
            check('PO3 postponed past the due date and the user keeps it: Due Date unchanged', got == due.isoformat(), (got, due))
        else:
            check('PO4 postponed within the due date: Due Date never touched', got == due.isoformat(), (got, due))


def tr_access_and_lists():
    aid = S.get('aid')
    code, d, t = attempt(trainee, 'POST', f'/training/activities/{aid}/finish-training', {'version': 1, 'signatureToken': 'bad'})
    check('SE1 a person without the right cannot finish a training', code >= 400, (code, t))
    code, d, t = attempt(admin, 'GET', '/training/activities?limit=10&sortBy=dueDate&sortDirection=asc')
    check('LS1 the activity list answers with paging and sorting', code == 200 and 'data' in d, (code, t))
    code, d, t = attempt(admin, 'GET', '/training/activities?limit=10&sortBy=notAField')
    check('LS2 an unknown sort field is refused', code >= 400, (code, t))


for title, fn in (('Document Control: create, review, approve and the refusals', dc_create_and_lifecycle),
                  ('Document Control: the revision cannot complete its training early', dc_publish_and_after),
                  ('Document Control: cancel a revision', dc_cancel_branch),
                  ('Training: from the document to the completion by QA', tr_full_flow),
                  ('Training and Document Control: the revision after the training', tr_dc_link),
                  ('Document Control: publish, upgrade revision, obsolete', dc_publish_upgrade_obsolete),
                  ('Training: APD.0108 self-reading by department (Department Head)', tr_self_reading_by_department),
                  ('Training: a requirement line follows a postponed activity', tr_requirement_line_follows),
                  ('Training: postponing a session past the Due Date', tr_postpone),
                  ('Training: access and lists', tr_access_and_lists)):
    section(title, fn)

ok = [r for r in results if r[1] is True]
bad = [r for r in results if r[1] is False]
nr = [r for r in results if r[1] is None]
print(f'\n{len(ok)} passed, {len(bad)} failed, {len(nr)} not run (of {len(results)})')
for r in bad:
    print('  FAIL', r[0], '--', r[2])
sys.exit(1 if bad else 0)
