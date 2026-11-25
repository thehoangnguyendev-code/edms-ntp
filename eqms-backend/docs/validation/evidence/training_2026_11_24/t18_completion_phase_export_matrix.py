"""T18: the three checks left open after T15 (DEC-TRAINING-2026-11-25-6):
 (a) a related document that has NO revision when the training starts gets one that is approved before QA confirms: it is frozen in phase COMPLETION, has its lines and its evidence;
 (b) the personal training record APD.0014 (export, QA approval, PDF) shows the new "(read with ...)" lines;
 (c) the matrix/compliance count: the lines are found by the SAME predicate the coverage query uses (document number, not voided)."""
from lib24 import *
import lib31

b = Browser()
P1 = 'uat31.s1.pass1'
set_status(P1, 'Active')


def new_doc(name, requires=True, related=None, days=14):
    body = {'documentName': name, 'documentType': 'Standard Operating Procedure', 'businessUnit': 'Quality Unit', 'department': 'Quality Assurance', 'author': admin.user['id'], 'language': 'English',
            'requiresTraining': requires, 'trainingPeriodDays': days if requires else None, 'description': 'RUN24 ' + name, 'isTemplate': False, 'coAuthorIds': [],
            'reviewerUserIds': [dco.user['id']], 'approverUserIds': [qa.user['id']], 'relatedDocumentIds': related or [], 'correlatedDocumentIds': []}
    if not requires:
        body['reasonForSkippingTraining'] = 'RUN24 form: level 4, no change of how the work is done'
    return admin.call('POST', '/documents', body)


def cnt(q):
    r = sql(q)
    return r[0][0] if r else '0'


def tab(label):
    def go(pg):
        pg.wait_for_timeout(3000)
        [e for e in pg.get_by_text(label, exact=True).all() if e.is_visible()][-1].click()
        pg.wait_for_timeout(2500)
    return go


# (a) the form is created WITHOUT a revision; only the SOP gets one before the start
form = new_doc('RUN24 late form (T18)', requires=False)
sop = new_doc('RUN24 SOP with a late form (T18)', related=[form['id']])
aid = rows_of_document(sop['documentNumber'])[0]['id']
r_sop = admin.call('POST', f"/documents/{sop['id']}/revisions", {})['id']
check('T18.1 the SOP is approved', not approve_revision(r_sop, 'RUN24 SOP', 'RUN24'), '')
admin.call('PUT', f"/training/documents/{sop['id']}/proposed-participants", {'personUserIds': [uid(P1)]})
sid = add_session(aid, 'SELF_READING', 'SELF_READING_CONFIRMATION', f"{sop['documentNumber']} RUN24 SOP with a late form (T18)", rid=r_sop, venue='Own workstation')
a = get(aid)
pid = [p['id'] for p in a['participants'] if p['personUserId'] == uid(P1)][0]
confirm_list(aid); approvals(aid); notify(aid); prepare(aid)
check('T18.2 no blocker: the form has no revision yet', not (get(aid)['capabilities'].get('startBlockers') or []), get(aid)['capabilities'].get('startBlockers'))
code, d, t = start(aid)
check('T18.3 Start Training', code == 200, (code, t[:150]))
check('T18.4 nothing is frozen at the start (the form has no revision)', cnt(f"select count(*) from training_activity_documents where activity_id = '{aid}'") == '0', '')

# the form gets its revision and it is approved while the training is running
r_form = admin.call('POST', f"/documents/{form['id']}/revisions", {})['id']
check('T18.5 the form revision is approved during the training', not approve_revision(r_form, 'RUN24 late form', 'RUN24'), '')
code, d, t = read(P1, pid)
check('T18.6 the person reads and signs', code == 200, (code, t[:120]))
code, d, t = head_verifies(aid, HEAD_QC)
check('T18.7 the head confirms', code == 200, (code, t[:120]))
finish_training(aid)
confirm_completion(aid)
check('T18.8 Completed', get(aid)['status'] == 'COMPLETED', get(aid)['status'])
rows = sql(f"select document_number, frozen_phase from training_activity_documents where activity_id = '{aid}'")
print('frozen:', rows)
check('T18.9 the form is frozen in phase COMPLETION', len(rows) == 1 and rows[0][0] == form['documentNumber'] and rows[0][1] == 'COMPLETION', rows)
lines = sql(f"select document_number, result from training_records where activity_id = '{aid}' and topic_text like '%(read with%'")
check('T18.10 the person has the line of the late form', len(lines) == 1 and lines[0][0] == form['documentNumber'] and lines[0][1] == 'READ', lines)
lk = admin.call('GET', f'/training/links/revisions/{r_form}')
check('T18.11 the form revision is COVERED by the training', lk.get('mode') == 'COVERED', lk)
check('T18.12 TRAINING_COVERED is in its Audit Trail once', cnt(f"select count(*) from audit_logs where entity_id = '{r_form}' and action_type = 'TRAINING_COVERED'") == '1', '')
b.shot('admin', f'/documents/revisions/{r_form}', 'T18-01', 'Late_form_covered', 'T18: Training Information của form được duyệt SAU khi đào tạo bắt đầu: vẫn được ghi là đã đào tạo (Covered by)', action=tab('Training Information'), tall=False)
b.shot('admin', f'/training-management/activities/{aid}', 'T18-02', 'Late_form_in_materials', 'T18: Training Materials: form duyệt muộn hiện là "Đã đọc trong đợt đào tạo này"', action=tab('Training Materials'), tall=False)

# (b) APD.0014 of the person
code, exp, text = attempt(admin, 'POST', '/training/record-exports', {'personUserId': uid(P1), 'reason': 'RUN24 T18 personal record', 'approverUserId': qa.user['id'], 'signatureToken': sign(admin)})
check('T18.13 the export of the personal record is asked for', code == 200, (code, text[:200]))
if code == 200:
    code, d, text = attempt(qa, 'POST', f"/training/record-exports/{exp['id']}/approve", {'signatureToken': sign(qa)})
    check('T18.14 approved by QA', code == 200, (code, text[:200]))
    pdf = get_bytes(admin, f"/training/record-exports/{exp['id']}/download")
    st = 200 if isinstance(pdf, (bytes, bytearray)) and pdf[:4] == b'%PDF' else 0
    if isinstance(pdf, tuple):
        st, pdf = pdf[0], pdf[1]
    check('T18.15 PDF of the record', st == 200 and pdf[:4] == b'%PDF', st)
    if st == 200:
        txt = pdf_text(pdf)
        check('T18.16 the PDF lists the late form line "(read with <SOP>)"', form['documentNumber'] in txt and 'read with' in txt and sop['documentNumber'] in txt, txt[:400])
        check('T18.17 the PDF has no template token', '{{' not in txt, '')
        save_apd('T18-03', 'APD0014 with related lines', 'T18: hồ sơ đào tạo cá nhân APD.0014 có dòng của tài liệu liên quan', pdf, 'pdf', pages=3)
b.shot('admin', '/training-management/record-exports', 'T18-04', 'Record_exports', 'T18: màn xuất hồ sơ đào tạo cá nhân APD.0014', wait=4000)

# (c) the matrix / compliance count: the same predicate as TrainingComplianceService.BASE
n = cnt(f"""select count(*) from training_records r left join training_record_voids v on v.record_id = r.id
             where r.person_user_id = '{uid(P1)}' and v.id is null and r.document_number = '{form['documentNumber']}'""")
check('T18.18 the compliance predicate (document number, not voided) finds the line of the form', n == '1', n)
last = cnt(f"""select max(r.completed_on) from training_records r left join training_record_voids v on v.record_id = r.id
             where r.person_user_id = '{uid(P1)}' and v.id is null and r.document_number = '{form['documentNumber']}'""")
check('T18.19 last_done is set (the person is OK, not MISSING, for a matrix row of this form)', last not in ('', '0', 'None'), last)
cov = admin.call('GET', '/training/compliance/coverage?limit=5')
check('T18.20 the coverage endpoint still answers', 'data' in cov or 'items' in cov or isinstance(cov, dict), list(cov)[:5] if isinstance(cov, dict) else cov)
b.shot('admin', '/training-management/compliance', 'T18-05', 'Compliance', 'T18: màn tuân thủ/ma trận đào tạo vẫn hiển thị bình thường', wait=4500)
lib31.finish('T18', b)
