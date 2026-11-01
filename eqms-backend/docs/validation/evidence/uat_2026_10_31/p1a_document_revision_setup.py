"""Scenario 1, part a: a document of Quality Control goes to Effective on revision 1 (trained by self-reading, completed, published), then the document is UPGRADED to revision 2, which is written,
reviewed and approved; the activity of revision 2 opens (Planned). Part b trains five people on revision 2 (absent, fail, left). State is kept in state31.json (key s1)."""
from flows31 import *

state = load()
S = state.setdefault('s1', {})
b = Browser()

step('S1-a.1 the document and its first revision')
if 'rid1' not in S:
    doc = new_document('UAT31 SOP Handling of QC samples')
    S.update(doc=doc['id'], number=doc['documentNumber'])
    rows = rows_of_document(doc['documentNumber'])
    check('S1-a.1 a Training Number is given with the document; the activity waits for the approval', len(rows) == 1 and rows[0]['status'] == 'RESERVED', rows)
    S['aid1'] = rows[0]['id']
    S['rid1'] = admin.call('POST', f"/documents/{doc['id']}/revisions", {})['id']
    save(state)
print('document', S['number'], 'rev1', S['rid1'])

step('S1-a.2 revision 1: written, reviewed, approved')
if not S.get('rev1_approved'):
    bad = approve_revision(S['rid1'], 'UAT31 SOP Handling of QC samples, revision 1', 'UAT31 rev1')
    check('S1-a.2 revision 1 goes through editing, review and approval', not bad, bad)
    S['rev1_approved'] = True
    save(state)
a = get(S['aid1'])
check('S1-a.3 the approval opens the activity (Planned)', a['status'] == 'PLANNED', a['status'])

step('S1-a.4 revision 1 is trained by self-reading (two people), completed and published')
if not S.get('rev1_trained'):
    people = ['uat31.s1.pass1', 'uat31.s1.pass2']
    a = get(S['aid1'])
    if a['status'] == 'PLANNED':
        sid, pid = run_to_start(S['aid1'], 'SELF_READING', 'SELF_READING_CONFIRMATION', people, 'UAT31 SOP Handling of QC samples', rid=S['rid1'])
    else:   # a run that stopped half way: the activity is already started
        sid = a['sessions'][0]['id']
        by_id = {p['personUserId']: p['id'] for p in a['participants']}
        pid = {u: by_id[uid(u)] for u in people}
    bad = self_reading_all(S['aid1'], sid, pid, 'uat31.head.qc')
    ok = check('S1-a.4 two people sign the reading, the head of Quality Control confirms', not bad, bad)
    f, c = finish_and_confirm(S['aid1'])
    ok &= check('S1-a.5 Finish Training, then QA confirms: Completed', f[0] == 200 and c[0] == 200 and get(S['aid1'])['status'] == 'COMPLETED', (f[0], f[2], c[0], c[2]))
    code, d, t = attempt(admin, 'POST', f"/revisions/{S['rid1']}/training/complete", {'signatureToken': sign(admin), 'comment': 'UAT31', 'reason': 'UAT31'})
    ok &= check('S1-a.6 Complete Training of revision 1', code == 200, (code, t))
    S['rev1_trained'] = bool(ok)
    save(state)

step('S1-a.7 revision 1 is published: Effective')
if not S.get('rev1_published'):
    status, problems = publish_revision(S['rid1'])
    ok = check('S1-a.7 revision 1 is Effective after publishing', str(status).upper() in ('EFFECTIVE', 'ACTIVE') or str(status).upper().startswith('PUBLISH'), (status, problems))
    S['rev1_published'] = bool(ok)
    save(state)
r1 = admin.call('GET', f"/revisions/{S['rid1']}")
print('revision 1 status:', r1.get('status'), r1.get('revisionNumber') or r1.get('revision'))
b.shot('admin', f"/documents/revisions/{S['rid1']}", 'S1-01', 'Revision_1_effective', 'Revision 1 của tài liệu UAT31 SOP Handling of QC samples đã Effective (trước khi nâng revision)')

step('S1-a.8 the document is upgraded to revision 2')
if 'rid2' not in S:
    code, d, t = attempt(admin, 'POST', f"/documents/{S['doc']}/upgrade-revision")
    if not check('S1-a.8 Upgrade Revision creates revision 2', code == 200 and d.get('id') and d['id'] != S['rid1'], (code, t)):
        finish('p1a', b)
    S['rid2'] = d['id']
    save(state)
print('rev2', S['rid2'])
b.shot('admin', f"/documents/revisions/{S['rid2']}", 'S1-02', 'Revision_2_created_by_Upgrade', 'Revision 2 vừa được tạo bằng Upgrade Revision từ revision 1 đã Effective')

step('S1-a.9 revision 2: written, reviewed, approved; the activity of revision 2 opens')
if not S.get('rev2_approved'):
    bad = approve_revision(S['rid2'], 'UAT31 SOP Handling of QC samples, revision 2', 'UAT31 rev2')
    check('S1-a.9 revision 2 goes through editing, review and approval', not bad, bad)
    S['rev2_approved'] = True
    save(state)
link = admin.call('GET', f"/training/links/revisions/{S['rid2']}")
print('link of revision 2:', {k: link.get(k) for k in ('trainingActivityId', 'trainingNumber', 'status', 'statusLabel', 'mode')})
rows = rows_of_document(S['number'])
print('activities of the document:', [(r['trainingNumber'], r['status'], r.get('revisionNumber'), r['id'][:8]) for r in rows])
cand = [r for r in rows if r['id'] != S['aid1']]
check('S1-a.10 revision 2 has its own activity (not the one of revision 1)', len(cand) == 1, [(r['trainingNumber'], r['status']) for r in rows])
if cand:
    S['aid2'] = cand[0]['id']
    save(state)
    a2 = get(S['aid2'])
    print('activity of revision 2:', a2['trainingNumber'], a2['status'], a2.get('kind'), a2.get('kindReason'), a2.get('dueDate'))
    b.shot('admin', f"/training-management/activities/{S['aid2']}", 'S1-03', 'Activity_of_revision_2_Planned', f"Activity đào tạo của revision 2 ({a2['trainingNumber']}) ở trạng thái Planned sau khi revision 2 được phê duyệt")
finish('p1a', b)
