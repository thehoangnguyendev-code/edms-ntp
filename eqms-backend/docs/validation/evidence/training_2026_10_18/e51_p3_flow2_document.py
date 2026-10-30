"""Phase 3, flow 2: a training that starts from a NEW DOCUMENT in Document Control (an SOP that requires training), for three employees by self-reading: the document is written, reviewed and approved
(Effective); the activity opens; the three employees confirm the reading with a signature; the head of the department verifies; QA completes; "Complete Training" of the revision. APD.0108 (the
self-reading list) is made at each milestone. Password from DEVPW (never written)."""
from e51_lib import *

state = load()
b = Browser()
S = {}
reviewer = reviewer_doc
approver = qa

RESUME = os.environ.get('RESUME')   # "activityId,revisionId,documentNumber": go on with a document that was already approved
if RESUME:
    aid, rid, S['doc'] = RESUME.split(',')
    S['aid'], S['rid'] = aid, rid
else:
    step('3.1 the new document (SOP) requiring training: written, reviewed, approved')
    body = {'documentName': 'E2E51 SOP Cleaning of the QC laboratory B', 'documentType': 'Standard Operating Procedure', 'businessUnit': 'Quality Unit', 'department': 'Quality Assurance',
            'author': admin.user['id'], 'language': 'English', 'requiresTraining': True, 'trainingPeriodDays': 14, 'description': 'E2E51', 'isTemplate': False,
            'coAuthorIds': [], 'reviewerUserIds': [reviewer.user['id']], 'approverUserIds': [approver.user['id']], 'relatedDocumentIds': [], 'correlatedDocumentIds': []}
    doc = admin.call('POST', '/documents', body)
    S['doc'] = doc['documentNumber']
    rows = [r for r in admin.call('GET', '/training/activities?limit=5&search=' + doc['documentNumber'])['data'] if r.get('documentNumber') == doc['documentNumber']]
    check('3.1 a Training Number is given with the document; the activity waits for the approval', len(rows) == 1 and rows[0]['status'] == 'RESERVED', rows)
    aid = rows[0]['id']
    S['aid'] = aid
    rev = admin.call('POST', f"/documents/{doc['id']}/revisions", {})
    rid = rev['id']
    S['rid'] = rid
    admin.upload(f'/revisions/{rid}/upload', 'file', 'e2e51-sop.docx', mini_docx('E2E51 SOP Cleaning of the QC laboratory B'), DOCX)
    for who, st in ((admin, 'complete-editing'), (admin, 'submit-review'), (reviewer, 'review/complete'), (approver, 'approve/complete')):
        code, data, text = attempt(who, 'POST', f'/revisions/{rid}/{st}', {'signatureToken': sign(who), 'comment': 'E2E51', 'reason': 'E2E51'})
        check(f'3.2 {st}', code == 200, (code, text))
    a = get(aid)
    check('3.3 approved: the activity opens (Planned)', a['status'] == 'PLANNED', a['status'])
    b.shot('admin', f'/training-management/activities/{aid}', 'p3_01_activity_from_document', wait=5000)

step('3.4 the session: self-reading for three employees')
a = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'SELF_READING', 'assessmentMethod': 'SELF_READING_CONFIRMATION', 'externalTrainerName': 'Self-reading', 'scheduledOn': TODAY, 'venue': 'At the workplace', 'topics': [{'topicText': 'E2E51 SOP Cleaning of the QC laboratory B', 'documentRevisionId': rid}]})
sid = a['sessions'][0]['id']
S['sid'] = sid
a = admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': [x.user['id'] for x in TRAINEES], 'reason': 'E2E51 three employees'})
pid = {p['personUserId']: p['id'] for p in a['participants']}
S['pid'] = pid
check('3.4 three employees on the list', len(pid) == 3, list(pid))
admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'E2E51 list prepared'})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': qa.user['id']})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': t3.user['id']})
check('3.5 the document is the material; nothing else is asked for a self-reading', get(aid)['contentRules']['missing'] == [], get(aid)['contentRules'])
qa.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(qa)})
t3.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(t3)})
a = admin.call('POST', f'/training/activities/{aid}/notify', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
check('3.6 notified', a['status'] == 'NOTIFIED', a['status'])
tick_all(admin, sid)
a = admin.call('POST', f'/training/sessions/{sid}/hold', {'signatureToken': sign(admin)})
check('3.7 started', a['status'] == 'IN_PROGRESS', a['status'])


def list_0108(name, label):
    st, w = fetch(admin, f'/training/sessions/{sid}/self-reading-list?format=docx', name + '.docx')
    st2, p = fetch(admin, f'/training/sessions/{sid}/self-reading-list?format=pdf', name + '.pdf')
    check(f'{label}: APD.0108 as Word and PDF', st == 200 and st2 == 200 and w[:2] == b'PK' and p[:4] == b'%PDF', (st, st2, w[:200]))
    if st == 200:
        t = words(w)
        check(f'{label}: no token is left, no note of the template', '{{' not in t and 'HISTORY REVISION' not in t and 'Header:' not in t, t[:200])
        return t, p
    return '', b''


t, p = list_0108('f2_M1_before_reading', '3.8 before the reading')
if t:
    check('3.9 the department, the document and the three people are written; nobody has signed', S['doc'] in t and all(x.user['fullName'] in t for x in TRAINEES) and '(UTC+' not in t, t[:400])
    print('   pages', render_pdf(p, 'p3_02_APD0108_M1_before_reading'))

step('3.10 each employee confirms the reading with a signature')
b.shot('trainee.test1', '/training-management/my-training', 'p3_03_trainee_my_training', wait=5000)
for who in TRAINEES:
    code, data, text = attempt(who, 'POST', f"/training/me/participations/{pid[who.user['id']]}/confirm-read", {'signatureToken': sign(who)})
    check(f"3.10 {who.user['fullName']} confirms the reading", code == 200, (code, text))
t, p = list_0108('f2_M2_after_reading', '3.11 after the three readings')
if t:
    check('3.12 the reading day and the three signatures (Read, signed electronically) are written', t.count('Read, signed electronically') == 3, t.count('Read, signed electronically'))
    print('   pages', render_pdf(p, 'p3_04_APD0108_M2_after_reading'))
b.shot('admin', f'/training-management/activities/{aid}', 'p3_05_activity_read', wait=5000)

step('3.13 the head of the department verifies (APD.0108 item: confirmed by head)')
a = admin.call('POST', f'/training/activities/{aid}/verify-self-reading', {'signatureToken': sign(admin), 'reason': 'E2E51 the head verifies the reading'})
res = {p['personUserId']: p['result'] for p in a['participants']}
check('3.13 verified: the three have passed', all(v == 'PASSED' for v in res.values()), res)
t, p = list_0108('f2_M3_head_verified', '3.14 after the head verified')
if t:
    check('3.15 the head name, position, date and the signature (Self-reading Verified) are written', admin.user['fullName'] in t and 'Self-reading Verified' in t and 'QA Manager' in t, t[:300])
    print('   pages', render_pdf(p, 'p3_06_APD0108_M3_head_verified'))

step('3.16 the results to QA, completion, Complete Training of the revision')
finish_for_qa(admin, aid, lambda: sign(admin))
code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/submit-for-confirmation', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
check('3.16 sent to QA', code == 200 and data.get('status') == 'PENDING_QA_CONFIRMATION', (code, text))
code, data, text = attempt(qa, 'POST', f'/training/activities/{aid}/confirm-completion', {'version': get(aid)['version'], 'signatureToken': sign(qa)})
check('3.17 QA confirms: Completed', code == 200 and data.get('status') == 'COMPLETED', (code, text))
a = get(aid)
check('3.18 Complete Training is offered for the revision', a['capabilities'].get('completeTraining') is True, a['capabilities'].get('completeTraining'))
b.shot('admin', f'/training-management/activities/{aid}', 'p3_07_activity_completed', wait=5000)
code, data, text = attempt(admin, 'POST', f'/revisions/{rid}/training/complete', {'signatureToken': sign(admin), 'comment': 'E2E51', 'reason': 'E2E51'})
check('3.19 Complete Training of the revision', code == 200, (code, text))
link = admin.call('GET', f'/training/links/revisions/{rid}')
check('3.20 the revision sees the status "Completed"', link.get('statusLabel') == 'Completed', link)
state['flow2'] = S
save(state)
finish(b)
