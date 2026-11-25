"""T15: the related documents a training was read with are written down on the day (DEC-TRAINING-2026-11-25-6): Start Training is refused while a related revision is not approved; the revisions are frozen
when the training starts; the confirmation of QA writes one line for each person and each related document in the personal training records and the evidence on the related revisions; the evidence is
visible as "will be covered" before that."""
from lib24 import *
import lib31

b = Browser()
P1, P2 = 'uat31.s1.pass1', 'uat31.s1.pass2'
for u in (P1, P2):
    set_status(u, 'Active')
IN_FORCE = '0130227c-e4b3-4a89-985f-f26cc507a574'


def new_doc(name, requires=True, related=None, days=14):
    body = {'documentName': name, 'documentType': 'Standard Operating Procedure', 'businessUnit': 'Quality Unit', 'department': 'Quality Assurance', 'author': admin.user['id'], 'language': 'English',
            'requiresTraining': requires, 'trainingPeriodDays': days if requires else None, 'description': 'RUN24 ' + name, 'isTemplate': False, 'coAuthorIds': [],
            'reviewerUserIds': [dco.user['id']], 'approverUserIds': [qa.user['id']], 'relatedDocumentIds': related or [], 'correlatedDocumentIds': []}
    if not requires:
        body['reasonForSkippingTraining'] = 'RUN24 form: level 4, no change of how the work is done'
    return admin.call('POST', '/documents', body)


def sources(aid):
    return admin.call('GET', f'/training/activities/{aid}/document-sources')


def cnt(q):
    r = sql(q)
    return r[0][0] if r else '0'


def info_tab(pg):
    pg.wait_for_timeout(3000)
    [e for e in pg.get_by_text('Training Information', exact=True).all() if e.is_visible()][-1].click()
    pg.wait_for_timeout(2500)


def materials_tab(pg):
    pg.wait_for_timeout(3000)
    [e for e in pg.get_by_text('Training Materials', exact=True).all() if e.is_visible()][-1].click()
    pg.wait_for_timeout(2500)


f1 = new_doc('RUN24 APD form (T15)', requires=False)
f2 = new_doc('RUN24 FRM form (T15)', requires=False)
f3 = new_doc('RUN24 INS sheet (T15)', requires=False)
sop = new_doc('RUN24 SOP read with three forms (T15)', related=[f1['id'], f2['id'], f3['id'], IN_FORCE])
aid = rows_of_document(sop['documentNumber'])[0]['id']
number = get(aid)['trainingNumber']
r_sop = admin.call('POST', f"/documents/{sop['id']}/revisions", {})['id']
r1 = admin.call('POST', f"/documents/{f1['id']}/revisions", {})['id']
r2 = admin.call('POST', f"/documents/{f2['id']}/revisions", {})['id']
r3 = admin.call('POST', f"/documents/{f3['id']}/revisions", {})['id']

step('T15.1 the SOP is approved (the training opens); of the forms only the first is approved')
check('T15.1 the SOP is approved', not approve_revision(r_sop, 'RUN24 SOP', 'RUN24'), '')
check('T15.2 the form 1 is approved', not approve_revision(r1, 'RUN24 APD', 'RUN24'), '')
link = admin.call('GET', f'/training/links/revisions/{r1}')
print('link before:', link)
check('T15.3 before the training is done the form already says it will be covered (COVERING, number, document)', link.get('mode') == 'COVERING' and link.get('trainingNumber') == number and link.get('coveredBy') == sop['documentNumber'], link)
b.shot('admin', f'/documents/revisions/{r1}', 'T15-01', 'Form_will_be_covered', 'T15: Training Information của form trước khi đào tạo xong: sẽ được đào tạo trong đợt của SOP', action=info_tab, tall=False)

step('T15.2 plan the training as a self-reading and bring it to Notified')
admin.call('PUT', f"/training/documents/{sop['id']}/proposed-participants", {'personUserIds': [uid(P1), uid(P2)]})
sid = add_session(aid, 'SELF_READING', 'SELF_READING_CONFIRMATION', f"{sop['documentNumber']} RUN24 SOP read with three forms (T15)", rid=r_sop, venue='Own workstation')
a = get(aid)
pid = {u: p['id'] for p in a['participants'] for u in (P1, P2) if p['personUserId'] == uid(u)}
confirm_list(aid)
approvals(aid)
notify(aid)
prepare(aid)

step('T15.3 Start Training is refused while a related revision is not approved')
caps = get(aid)['capabilities']
check('T15.4 the screen lists the reason', 'TRAINING_RELATED_NOT_APPROVED' in (caps.get('startBlockers') or []), caps.get('startBlockers'))
code, d, t = start(aid)
check('T15.5 the server refuses (409 TRAINING_RELATED_NOT_APPROVED)', code == 409 and 'TRAINING_RELATED_NOT_APPROVED' in t, (code, t[:150]))
check('T15.6 nothing is written down yet', cnt(f"select count(*) from training_activity_documents where activity_id = '{aid}'") == '0', '')
check('T15.7 the other two forms are approved', not approve_revision(r2, 'RUN24 FRM', 'RUN24') and not approve_revision(r3, 'RUN24 INS', 'RUN24'), '')
code, d, t = start(aid)
check('T15.8 Start Training now', code == 200, (code, t[:150]))
rows = sql(f"select document_number, revision_number, frozen_phase from training_activity_documents where activity_id = '{aid}' order by 1")
print('frozen:', rows)
check('T15.9 the three forms and the one in force are written down, with their revision, on the day the training starts', len(rows) == 4 and all(r[2] == 'START' for r in rows), rows)
src = sources(aid)
check('T15.10 the Training Materials show the frozen revisions', all(d.get('frozen') for d in src['documents'] if d['role'] == 'RELATED'), [(d['documentNumber'], d.get('frozen')) for d in src['documents']])
b.shot('admin', f'/training-management/activities/{aid}', 'T15-02', 'Frozen_materials', 'T15: Training Materials sau khi bắt đầu: các form được đánh dấu "Đã đọc trong đợt đào tạo này"', action=materials_tab, tall=False)

step('T15.4 the reading, the confirmation of the head, QA completes: the records and the evidence are written')
for u in (P1, P2):
    code, d, t = read(u, pid[u])
    check(f'T15.11 {u} reads and signs', code == 200, (code, t[:120]))
code, d, t = head_verifies(aid, HEAD_QC)
check('T15.12 the head confirms', code == 200, (code, t[:120]))
f = finish_training(aid)
before_stamp = admin.call('GET', f'/training/links/revisions/{r1}')
check('T15.13 before QA confirms the form is still only "covering"', before_stamp.get('mode') == 'COVERING', before_stamp.get('mode'))
c = confirm_completion(aid)
check('T15.14 QA confirms: Completed', get(aid)['status'] == 'COMPLETED', get(aid)['status'])
lines = sql(f"select full_name, document_number, document_revision, result from training_records where activity_id = '{aid}' and topic_text like '%(read with%' order by 1, 2")
print('records of related documents:', lines)
check('T15.15 each of the two people has a line for each of the four related documents (8 lines), result READ, with the frozen revision', len(lines) == 8 and all(l[3] == 'READ' and l[2] for l in lines), lines)
check('T15.16 the SOP itself has its own lines as before', int(cnt(f"select count(*) from training_records where activity_id = '{aid}' and topic_text not like '%(read with%' and result <> 'TRAINER'")) >= 2, '')
for name, rid in (('APD', r1), ('FRM', r2), ('INS', r3)):
    lk = admin.call('GET', f'/training/links/revisions/{rid}')
    check(f'T15.17 the {name} is covered as soon as QA confirms (before the publication)', lk.get('mode') == 'COVERED' and lk.get('trainingNumber') == number, lk)
    check(f'T15.18 the Audit Trail of the {name} has TRAINING_COVERED once', cnt(f"select count(*) from audit_logs where entity_id = '{rid}' and action_type = 'TRAINING_COVERED'") == '1', '')
check('T15.19 the revision in force (SOP.7203) is not stamped: it is not a revision of this release', cnt("select count(*) from document_revisions where training_mode = 'COVERED' and document_number = 'SOP.7203'") == '0', '')

step('T15.5 Complete Training of the SOP and publish: the evidence is not written twice')
code, d, t = attempt(admin, 'POST', f'/revisions/{r_sop}/training/complete', {'signatureToken': sign(admin), 'comment': 'RUN24', 'reason': 'RUN24 training completed'})
check('T15.20 Complete Training of the SOP', code == 200, (code, t[:120]))
st, problems = publish_revision(r_sop)
sts = {n: str(admin.call('GET', f'/revisions/{r}').get('status')).upper() for n, r in (('SOP', r_sop), ('APD', r1), ('FRM', r2), ('INS', r3))}
print('statuses:', sts)
check('T15.21 the SOP and the forms are Effective', all(v == 'EFFECTIVE' for v in sts.values()), sts)
check('T15.22 the entry TRAINING_COVERED is still one for each form', all(cnt(f"select count(*) from audit_logs where entity_id = '{rid}' and action_type = 'TRAINING_COVERED'") == '1' for rid in (r1, r2, r3)), '')
b.shot('admin', f'/documents/revisions/{r2}', 'T15-03', 'Form_covered_after_completion', 'T15: Training Information của form sau khi QA xác nhận: Covered by, ngày hoàn tất', action=info_tab, tall=False)
lib31.finish('T15', b)
