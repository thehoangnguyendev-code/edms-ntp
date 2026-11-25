"""T2-A: a training that starts from a NEW SOP with related documents. Two forms (APD and FRM) require training and join the Training Number of the SOP; a third related document is not required
and one more is already in force (it is only read). The documents are written and approved one by one: the activity waits (Reserved) until the last is approved, then opens (Planned) with the Training
Materials taken from Document Control, the first session filled in (the author as trainer), the proposed people on the list. The training is a self-reading (APD.0108); QA completes it and each revision
is completed in Document Control, then published (Effective). Expected results: SOP.0003 5.1.2, 5.1.3, 5.1.4, 5.3.3, 5.3.5-5.3.7 and the decisions DEC-TRAINING-2026-11-24-2 and -3."""
from lib24 import *
import lib31

b = Browser()
P1, P2 = 'uat31.s1.pass1', 'uat31.s1.pass2'
for u in (P1, P2):
    set_status(u, 'Active')
S = load()
IN_FORCE = '0130227c-e4b3-4a89-985f-f26cc507a574'   # SOP.7203, in force on DEV: a related document that has not changed


def new_doc(name, requires=True, related=None, days=14):
    body = {'documentName': name, 'documentType': 'Standard Operating Procedure', 'businessUnit': 'Quality Unit', 'department': 'Quality Control', 'author': admin.user['id'], 'language': 'English',
            'requiresTraining': requires, 'trainingPeriodDays': days if requires else None, 'description': 'RUN24 ' + name, 'isTemplate': False, 'coAuthorIds': [],
            'reviewerUserIds': [dco.user['id']], 'approverUserIds': [qa.user['id']], 'relatedDocumentIds': related or [], 'correlatedDocumentIds': []}
    if not requires:
        body['reasonForSkippingTraining'] = 'RUN24 information sheet: level 4, no change of how the work is done'
    return admin.call('POST', '/documents', body)


def sources(aid):
    return admin.call('GET', f'/training/activities/{aid}/document-sources')


step('T2A.1 the forms first (each opens its own number), then the SOP that lists them as related')
f1 = new_doc('RUN24 APD form of the cleaning log')
f2 = new_doc('RUN24 FRM record of the room status')
f3 = new_doc('RUN24 information sheet (no training)', requires=False)
check('T2A.1 the document that does not require training has no activity', rows_of_document(f3['documentNumber']) == [], rows_of_document(f3['documentNumber']))
sop = new_doc('RUN24 SOP Cleaning of classified rooms', related=[f1['id'], f2['id'], f3['id'], IN_FORCE])
lead = rows_of_document(sop['documentNumber'])
check('T2A.2 the SOP has one Training Number, waiting for the approval of the documents (Reserved)', len(lead) == 1 and lead[0]['status'] == 'RESERVED', lead)
aid = lead[0]['id']
number = lead[0]['trainingNumber']
check('T2A.3 the numbers of the two forms are given up (Cancelled)', all(r['status'] == 'CANCELLED' for r in rows_of_document(f1['documentNumber']) + rows_of_document(f2['documentNumber'])), [r['status'] for r in rows_of_document(f1['documentNumber']) + rows_of_document(f2['documentNumber'])])
a = get(aid)
check('T2A.4 the activity is a new SOP', a['kindReason'] == 'NEW_SOP' and a['kind'] == 'UNPLANNED', (a['kind'], a['kindReason']))
src = sources(aid)
roles = {d['documentNumber']: (d['role'], d.get('approved'), d.get('unchanged')) for d in src['documents']}
print('sources (documents not yet revised):', roles)
check('T2A.5 the Training Materials list the SOP and every related document, also the one that needs no training', {d['documentNumber'] for d in src['documents']} >= {sop['documentNumber'], f1['documentNumber'], f2['documentNumber'], f3['documentNumber']}, roles)
S['t2a'] = {'aid': aid, 'number': number, 'sop': sop['id'], 'f1': f1['id'], 'f2': f2['id'], 'sopNo': sop['documentNumber'], 'f1No': f1['documentNumber'], 'f2No': f2['documentNumber']}
save(S)

step('T2A.2 the revisions are created: they are shown at once, but not yet approved (no Open)')
r_sop = admin.call('POST', f"/documents/{sop['id']}/revisions", {})['id']
r1 = admin.call('POST', f"/documents/{f1['id']}/revisions", {})['id']
r2 = admin.call('POST', f"/documents/{f2['id']}/revisions", {})['id']
S['t2a'].update({'r_sop': r_sop, 'r1': r1, 'r2': r2})
save(S)
src = sources(aid)
roles = {d['documentNumber']: (d['role'], d.get('approved'), d.get('unchanged')) for d in src['documents']}
print('sources (revisions in draft):', roles)
check('T2A.6 the SOP and the two forms are in the group (same Training Number), not approved', roles[sop['documentNumber']][0] == 'MAIN' and roles[f1['documentNumber']][0] == 'GROUP' and roles[f2['documentNumber']][0] == 'GROUP' and not any(roles[n][1] for n in (sop['documentNumber'], f1['documentNumber'], f2['documentNumber'])), roles)
check('T2A.7 the document in force is a related document that has not changed', roles['SOP.7203'][0] == 'RELATED' and roles['SOP.7203'][2] is True and roles['SOP.7203'][1] is True, roles.get('SOP.7203'))
shot_tabs(b, aid, 'T2A-01', 'Reserved_materials_draft', 'T2-A: Reserved, Training Materials: SOP + APD + FRM (nháp, chưa duyệt) + tài liệu liên quan', ('General Information', 'Training Materials'))

step('T2A.3 the documents are approved one by one: the activity opens when the last one is approved')
for name, rid in (('SOP', r_sop), ('form 1', r1)):
    bad = approve_revision(rid, 'RUN24 ' + name, 'RUN24')
    check(f'T2A.8 {name} written, reviewed and approved', not bad, bad)
    check(f'T2A.9 after {name}: the training still waits (Reserved)', get(aid)['status'] == 'RESERVED', get(aid)['status'])
shot_tabs(b, aid, 'T2A-02', 'Reserved_two_approved', 'T2-A: SOP và FRM1 đã duyệt, activity vẫn Reserved vì FRM2 chưa duyệt', ('Training Materials',))
bad = approve_revision(r2, 'RUN24 form 2', 'RUN24')
check('T2A.10 form 2 approved', not bad, bad)
a = get(aid)
check('T2A.11 the last approval opens the training: Planned, the due day counts from today', a['status'] == 'PLANNED' and a.get('approvedOn') == TODAY_S and bool(a.get('dueDate')), (a['status'], a.get('approvedOn'), a.get('dueDate')))
src = sources(aid)
roles = {d['documentNumber']: (d['role'], d.get('approved')) for d in src['documents']}
check('T2A.12 all three documents of the group are approved now: they can be opened', all(roles[n][1] for n in (sop['documentNumber'], f1['documentNumber'], f2['documentNumber'])), roles)
sd = src['sessionDefaults']
check('T2A.13 the first session starts as classroom + test, with the author of the SOP as trainer (a first issue)', sd and sd['method'] == 'CLASSROOM' and sd['assessmentMethod'] == 'TEST' and sd['trainerUserId'] == admin.user['id'], sd)
shot_tabs(b, aid, 'T2A-03', 'Planned_materials_approved', 'T2-A: Planned, tài liệu đã duyệt (có nút Open)', ('General Information', 'Training Materials'))

step('T2A.4 the people proposed on the SOP go to the first session when it is added')
code, d, t = attempt(admin, 'PUT', f"/training/documents/{sop['id']}/proposed-participants", {'personUserIds': [uid(P1), uid(P2)]})
check('T2A.14 the people proposed on the document are saved', code == 200, (code, t))
a = get(aid)
check('T2A.15 before the first session they wait as proposed', a.get('proposedParticipantCount') == 2 and a['participants'] == [], (a.get('proposedParticipantCount'), len(a['participants'])))


def open_dialog(pg):
    pg.get_by_role('button', name='Add session').first.click()
    pg.wait_for_timeout(2500)


b.shot('admin', f'/training-management/activities/{aid}', 'T2A-04', 'Add_session_prefilled', 'T2-A: hộp thoại Thêm buổi đã điền sẵn: chủ đề là SOP, Tập trung + Kiểm tra, giảng viên là tác giả', action=open_dialog, tall=False)

step('T2A.5 the session is a self-reading (the organizer changed the default), the proposed people appear on its list')
sid = add_session(aid, 'SELF_READING', 'SELF_READING_CONFIRMATION', f"{sop['documentNumber']} RUN24 SOP Cleaning of classified rooms", rid=r_sop, venue='Own workstation')
a = get(aid)
people = {p['personUserId'] for p in a['participants']}
check('T2A.16 the two proposed people are on the list of session 1', people == {uid(P1), uid(P2)}, people)
check('T2A.17 the document is the material: nothing is missing', a['contentRules']['missing'] == [] and a['contentRules']['materialsSource'] in ('DOCUMENT', 'FILES'), a['contentRules'])
shot_tabs(b, aid, 'T2A-05', 'Session_added', 'T2-A: buổi Tự đọc đã thêm, 2 người đề xuất đã nằm trong danh sách', ('General Information', 'Participants'))
pid = {u: p['id'] for p in a['participants'] for u in (P1, P2) if p['personUserId'] == uid(u)}
confirm_list(aid)
approvals(aid)
notify(aid)
prepare(aid)
code, d, t = start(aid)
check('T2A.18 Start Training: In Progress', code == 200 and d.get('status') == 'IN_PROGRESS', (code, t))
for u in (P1, P2):
    code, d, t = read(u, pid[u])
    check(f'T2A.19 {u} reads and signs', code == 200, (code, t))
code, d, t = head_verifies(aid, HEAD_QC)
check('T2A.20 the head of Quality Control confirms', code == 200, (code, t))
shot_tabs(b, aid, 'T2A-06', 'Read_and_confirmed', 'T2-A: đã đọc, ký và trưởng bộ phận xác nhận', ('Participants',))
f = finish_training(aid)
check('T2A.21 Finish Training', f[0] == 200, (f[0], f[2]))
c = confirm_completion(aid)
check('T2A.22 QA confirms: Completed', c[0] == 200 and get(aid)['status'] == 'COMPLETED', (c[0], c[2]))
a = get(aid)
check('T2A.23 the three revisions of the group wait for Complete Training', len([g for g in a['groupRevisions'] if g['revisionStatus'] == 'PENDING_TRAINING']) == 3 and a['capabilities'].get('completeTraining') is True, [(g['documentNumber'], g['revisionStatus']) for g in a['groupRevisions']])
shot_tabs(b, aid, 'T2A-07', 'Completed_revisions_waiting', 'T2-A: Completed, ba revision chờ Complete Training', ('General Information',))

step('T2A.6 Complete Training of each revision, then publish: the three documents become Effective')
for g in a['groupRevisions']:
    code, d, t = attempt(admin, 'POST', f"/revisions/{g['revisionId']}/training/complete", {'signatureToken': sign(admin), 'comment': 'RUN24', 'reason': 'RUN24 training completed'})
    check(f"T2A.24 Complete Training of {g['documentNumber']}", code == 200, (code, t))
for name, rid in (('SOP', r_sop), ('form 1', r1), ('form 2', r2)):
    st, problems = publish_revision(rid)
    check(f'T2A.25 {name} published: Effective', str(st).upper() in ('EFFECTIVE', 'ACTIVE') or str(st).upper().startswith('PUBLISH'), (st, problems))
b.shot('admin', f'/documents/revisions/{r_sop}', 'T2A-08', 'SOP_effective', 'T2-A: SOP đã Effective')
S['t2a']['published'] = True
save(S)
lib31.finish('T2A', b)
