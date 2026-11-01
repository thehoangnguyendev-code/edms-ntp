"""Flows shared by the scenarios of the UAT run of 2026-10-31: a document through review and approval, publishing, a training activity from the first session to the start, the self-reading,
the classroom test. Each function does the calls and returns what the next step needs; the checks are the caller's."""
from lib31 import *

# the heads of the three departments are set for every run (the harness puts the departments back to no head when the run ends)
for _dept, _head in (('Quality Assurance', 'uat31.head.qa'), ('Quality Control', 'uat31.head.qc'), ('Production', 'uat31.head.prod')):
    set_head(_dept, _head)

admin = U('admin')
qa = U('approver.test1')        # QA: reviews the content of a training, confirms the completion; approves documents
dco = U('dco.test1')            # reviews documents
approve2 = U('user.a.test')     # approves the content of a training


def get(aid):
    return admin.call('GET', f'/training/activities/{aid}')


def rows_of_document(number):
    return [r for r in admin.call('GET', '/training/activities?limit=20&search=' + number)['data'] if r.get('documentNumber') == number]


# ------------------------------------------------------------------ documents
def new_document(name, dept='Quality Control', days=14):
    body = {'documentName': name, 'documentType': 'Standard Operating Procedure', 'businessUnit': 'Quality Unit', 'department': dept, 'author': admin.user['id'], 'language': 'English',
            'requiresTraining': True, 'trainingPeriodDays': days, 'description': 'UAT31 ' + name, 'isTemplate': False, 'coAuthorIds': [], 'reviewerUserIds': [dco.user['id']],
            'approverUserIds': [qa.user['id']], 'relatedDocumentIds': [], 'correlatedDocumentIds': []}
    return admin.call('POST', '/documents', body)


def approve_revision(rid, text, label):
    """Upload the file, finish editing, review, approve (each signed). Returns the failed steps (empty list = all done)."""
    admin.upload(f'/revisions/{rid}/upload', 'file', 'uat31-sop.docx', mini_docx(text, ('Purpose', 'Scope', 'Procedure step 1: prepare the sample', 'Procedure step 2: record the result')), DOCX)
    bad = []
    for who, st in ((admin, 'complete-editing'), (admin, 'submit-review'), (dco, 'review/complete'), (qa, 'approve/complete')):
        code, data, t = attempt(who, 'POST', f'/revisions/{rid}/{st}', {'signatureToken': sign(who), 'comment': label, 'reason': label})
        if code != 200:
            bad.append((st, code, t))
    return bad


def publish_revision(rid):
    """Publishing Workspace: preview, then Publish with a signature (an asynchronous job). Returns (status after the job, list of problems)."""
    base = f'/revisions/{rid}/publishing-workspace'
    problems = []
    code, ws, t = attempt(admin, 'GET', base)
    if code != 200:
        return None, [('workspace', code, t)]
    tmpl = ws.get('publishingTemplateId') or ws.get('selectedTemplateId') or (ws.get('selectedTemplate') or {}).get('id')
    if not tmpl and ws.get('templates'):
        tmpl = ws['templates'][0].get('id')
    body = {'publishingTemplateId': tmpl, 'changeSummary': 'UAT31 publish', 'reason': 'UAT31 publish'}
    code, d, t = attempt(admin, 'POST', base + '/generate-preview', body)
    if code != 200:
        problems.append(('generate-preview', code, t))
    for _ in range(30):
        w = admin.call('GET', base)
        if w.get('previewReady'):
            break
        time.sleep(3)
    code, d, t = attempt(admin, 'POST', base + '/publish', {**body, 'signatureToken': sign(admin)})
    if code not in (200, 202):
        problems.append(('publish', code, t))
    status = None
    for _ in range(60):
        time.sleep(3)
        status = admin.call('GET', f'/revisions/{rid}').get('status')
        if str(status).upper() in ('EFFECTIVE', 'ACTIVE') or str(status).upper().startswith('PUBLISH'):
            break
    return status, problems


# ------------------------------------------------------------------ a training activity
def run_to_start(aid, method, assessment, people, topic, rid=None, scheduled=None, trainer_name='External Trainer', exam=None, material_link=True):
    """Session, participants, confirmed list, approvers and their signatures, notice, preparation, start. `people` = usernames. Returns (sid, {username: participantId})."""
    t = {'topicText': topic}
    if rid:
        t['documentRevisionId'] = rid
    a = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': method, 'assessmentMethod': assessment, 'externalTrainerName': trainer_name, 'scheduledOn': scheduled or TODAY.isoformat(),
                                                                       'venue': 'Training room 1', 'topics': [t]})
    sid = a['sessions'][0]['id']
    if exam:
        admin.upload(f'/training/activities/{aid}/materials', 'file', 'uat31-exam.pdf', mini_pdf(exam), 'application/pdf', '?purpose=EXAM&title=' + exam.replace(' ', '%20'))
    if material_link and not rid:
        admin.call('POST', f'/training/activities/{aid}/material-links', {'title': 'UAT31 material', 'url': 'https://example.com/uat31'})
    if people is None:   # a supplementary activity: the people were proposed by the system and are on the list of the first session already
        a = get(aid)
        by_id = {p['personUserId']: p['id'] for p in a['participants']}
        by_name = {x: by_id[uid(x)] for x in PEOPLE if uid(x) in by_id}
        pid = by_name
    else:
        a = admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': [uid(u) for u in people], 'reason': 'UAT31 invited people'})
        by_user = {p['personUserId']: p['id'] for p in a['participants']}
        pid = {u: by_user[uid(u)] for u in people}
    admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'UAT31 list prepared'})
    admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': qa.user['id']})
    admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': approve2.user['id']})
    qa.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(qa)})
    approve2.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(approve2)})
    admin.call('POST', f'/training/activities/{aid}/notify', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
    tick_all(admin, sid)
    admin.call('POST', f'/training/sessions/{sid}/hold', {'signatureToken': sign(admin)})
    return sid, pid


def self_reading_all(aid, sid, pid, head_user, reason='UAT31 I read the document and understood it'):
    """Every person signs the reading; the head of the department confirms. Returns the list of problems."""
    bad = []
    state_of = {p['id']: p['state'] for p in get(aid)['participants']}
    for u, p in pid.items():
        if state_of.get(p) == 'READ_CONFIRMED':
            continue
        c = U(u)
        code, d, t = attempt(c, 'POST', f'/training/me/participations/{p}/confirm-read', {'signatureToken': sign(c), 'reason': reason})
        if code != 200:
            bad.append((u, code, t))
    h = U(head_user)
    code, d, t = attempt(h, 'POST', f'/training/activities/{aid}/verify-self-reading', {'signatureToken': sign(h), 'reason': 'UAT31 head: the people of the department read the document'})
    if code != 200 and 'ALREADY' not in t:
        bad.append(('head', code, t))
    return bad


def finish_and_confirm(aid):
    """Finish Training (one signature, results go to QA) and QA confirms. Returns (finish response, confirm response) as (code, data, text) tuples."""
    a = get(aid)
    if a.get('resultsFinishedAt'):
        f = (200, a, 'already finished')
    else:
        f = attempt(admin, 'POST', f'/training/activities/{aid}/finish-training', {'version': a['version'], 'signatureToken': sign(admin)})
    a = get(aid)
    if a['status'] == 'COMPLETED':
        c = (200, a, 'already completed')
    else:
        c = attempt(qa, 'POST', f'/training/activities/{aid}/confirm-completion', {'version': a['version'], 'signatureToken': sign(qa)})
    return f, c
