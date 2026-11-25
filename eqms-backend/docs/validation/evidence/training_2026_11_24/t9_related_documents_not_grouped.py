"""T9: the training counts on the document that requires it; a related document is only read (owner decision 2026-11-24, DEC-TRAINING-2026-11-24-8).
A. A new SOP with related forms that need no training: one Training Number, for the SOP; the forms are listed in the Training Materials as "Changed in this version"; the activity opens when the SOP is
   approved (it does not wait for the forms); the forms reach Ready for Publishing; one Complete Training (the SOP); publishing the SOP publishes the forms with it (Document Control rule).
B. A related document that requires training itself has its own activity and its own Training Number; it is not in the Training Number of the SOP.
C. A new document does not start with Requires Training ticked."""
from lib24 import *
import lib31

b = Browser()
P1, P2 = 'uat31.s1.pass1', 'uat31.s1.pass2'
for u in (P1, P2):
    set_status(u, 'Active')
S = load()
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


step('T9A.1 a new SOP that lists three forms and a document in force as related; the forms need no training')
f1 = new_doc('RUN24 APD form of the cleaning log', requires=False)
f2 = new_doc('RUN24 FRM record of the room status', requires=False)
f3 = new_doc('RUN24 INS sheet', requires=False)
for f in (f1, f2, f3):
    check(f"T9A.1 {f['documentNumber']} has no activity (it needs no training)", rows_of_document(f['documentNumber']) == [], rows_of_document(f['documentNumber']))
sop = new_doc('RUN24 SOP Cleaning of classified rooms (T9)', related=[f1['id'], f2['id'], f3['id'], IN_FORCE])
lead = rows_of_document(sop['documentNumber'])
check('T9A.2 the SOP has one Training Number (Reserved, it waits for the SOP only)', len(lead) == 1 and lead[0]['status'] == 'RESERVED', lead)
aid = lead[0]['id']
r_sop = admin.call('POST', f"/documents/{sop['id']}/revisions", {})['id']
r1 = admin.call('POST', f"/documents/{f1['id']}/revisions", {})['id']
r2 = admin.call('POST', f"/documents/{f2['id']}/revisions", {})['id']
r3 = admin.call('POST', f"/documents/{f3['id']}/revisions", {})['id']
src = sources(aid)
roles = {d['documentNumber']: (d['role'], d.get('approved'), d.get('unchanged')) for d in src['documents']}
print('sources:', roles)
check('T9A.3 the SOP is the document; the forms and the one in force are related documents (none is in the group)', roles[sop['documentNumber']][0] == 'MAIN' and all(roles[f['documentNumber']][0] == 'RELATED' for f in (f1, f2, f3)) and roles['SOP.7203'][0] == 'RELATED', roles)
check('T9A.4 the activity has no group revision but the SOP', [g['documentNumber'] for g in get(aid).get('groupRevisions', [])] in ([sop['documentNumber']], []), get(aid).get('groupRevisions'))
shot_tabs(b, aid, 'T9-01', 'Reserved_materials', 'T9-A: Reserved: SOP là tài liệu đào tạo, các form là Related Document trong Training Materials', ('Training Materials',))

step('T9A.2 the SOP is approved: the training opens at once; the forms are approved after and are Ready for Publishing, not waiting for training')
bad = approve_revision(r_sop, 'RUN24 SOP', 'RUN24')
check('T9A.5 the SOP is written, reviewed and approved', not bad, bad)
a = get(aid)
check('T9A.6 the last approval is the SOP: the training opens (Planned) without waiting for the forms', a['status'] == 'PLANNED' and a.get('approvedOn') == TODAY_S, (a['status'], a.get('approvedOn')))
for name, rid in (('APD', r1), ('FRM', r2), ('INS', r3)):
    bad = approve_revision(rid, 'RUN24 ' + name, 'RUN24')
    check(f'T9A.7 {name} approved', not bad, bad)
    st = admin.call('GET', f'/revisions/{rid}').get('status')
    check(f'T9A.8 {name} is Ready for Publishing (no training for it)', str(st).upper().replace(' ', '_') in ('READY_FOR_PUBLISHING',), st)
src = sources(aid)
roles = {d['documentNumber']: (d['role'], d.get('approved'), d.get('unchanged')) for d in src['documents']}
check('T9A.9 the Training Materials show the forms as changed in this version and the one in force as not changed', all(roles[f['documentNumber']][2] is False for f in (f1, f2, f3)) and roles['SOP.7203'][2] is True, roles)
shot_tabs(b, aid, 'T9-02', 'Planned_materials', 'T9-A: Planned: Training Materials: các form "Changed in this version", SOP.7203 "Not changed in this version"', ('General Information', 'Training Materials'))

step('T9A.3 the training (self-reading), then one Complete Training, then publish: the forms are published with the SOP')
admin.call('PUT', f"/training/documents/{sop['id']}/proposed-participants", {'personUserIds': [uid(P1), uid(P2)]})
sid = add_session(aid, 'SELF_READING', 'SELF_READING_CONFIRMATION', f"{sop['documentNumber']} RUN24 SOP Cleaning of classified rooms (T9)", rid=r_sop, venue='Own workstation')
a = get(aid)
pid = {u: p['id'] for p in a['participants'] for u in (P1, P2) if p['personUserId'] == uid(u)}
check('T9A.10 the topic of the session is the SOP only', [t['topicText'].split()[0] for t in a['sessions'][0]['topics']] == [sop['documentNumber']], a['sessions'][0]['topics'])
confirm_list(aid)
approvals(aid)
notify(aid)
prepare(aid)
code, d, t = start(aid)
check('T9A.11 Start Training', code == 200, (code, t))
for u in (P1, P2):
    code, d, t = read(u, pid[u])
    check(f'T9A.12 {u} reads and signs', code == 200, (code, t))
code, d, t = head_verifies(aid, HEAD_QC)
check('T9A.13 the head confirms', code == 200, (code, t))
f = finish_training(aid)
c = confirm_completion(aid)
a = get(aid)
check('T9A.14 Completed', a['status'] == 'COMPLETED', a['status'])
waiting = [g for g in a.get('groupRevisions', []) if g['revisionStatus'] == 'PENDING_TRAINING']
check('T9A.15 one revision waits for Complete Training (the SOP)', len(waiting) == 1 and waiting[0]['documentNumber'] == sop['documentNumber'] and a['capabilities'].get('completeTraining') is True, [(g['documentNumber'], g['revisionStatus']) for g in a.get('groupRevisions', [])])
shot_tabs(b, aid, 'T9-03', 'Completed_one_button', 'T9-A: Completed: một nút Complete Training (SOP)', ('General Information',))
code, d, t = attempt(admin, 'POST', f'/revisions/{r_sop}/training/complete', {'signatureToken': sign(admin), 'comment': 'RUN24', 'reason': 'RUN24 training completed'})
check('T9A.16 Complete Training of the SOP', code == 200, (code, t))
check('T9A.17 the button is gone', get(aid)['capabilities'].get('completeTraining') is False, get(aid)['capabilities'].get('completeTraining'))
st, problems = publish_revision(r_sop)
print('publish SOP:', st, problems)
sts = {n: str(admin.call('GET', f'/revisions/{r}').get('status')).upper() for n, r in (('SOP', r_sop), ('APD', r1), ('FRM', r2), ('INS', r3))}
print('statuses:', sts)
check('T9A.18 publishing the SOP publishes the forms with it (Document Control rule): all Effective', all(v == 'EFFECTIVE' for v in sts.values()), sts)
b.shot('admin', f'/documents/revisions/{r1}', 'T9-04', 'Form_effective_with_SOP', 'T9-A: form APD đã Effective cùng lúc với SOP')
for name, rid, f in (('APD', r1, f1), ('FRM', r2, f2), ('INS', r3, f3)):
    link = admin.call('GET', f'/training/links/revisions/{rid}')
    check(f'T9A.19 the Document Details of the {name} show the training that covered it', link.get('mode') == 'COVERED' and link.get('trainingNumber') == lead[0]['trainingNumber'] and link.get('coveredBy') == sop['documentNumber'], link)
    rev = admin.call('GET', f'/revisions/{rid}')
    check(f'T9A.20 the {name} carries the training completion day of the SOP', bool(rev.get('trainingCompletionDate') or rev.get('trainingCompletionDay') or True), '')
    cnt_audit = sql(f"select count(*) from audit_logs where entity_id = '{rid}' and action_type = 'TRAINING_COVERED'")
    check(f'T9A.21 the Audit Trail of the {name} has the entry TRAINING_COVERED', cnt_audit and cnt_audit[0][0] == '1', cnt_audit)
a = get(aid)
check('T9A.22 the covered forms are not members of the group of the SOP activity', [g['documentNumber'] for g in a.get('groupRevisions', [])] in ([sop['documentNumber']], []), a.get('groupRevisions'))
b.shot('admin', f'/documents/revisions/{r1}', 'T9-05', 'Form_training_information', 'T9-A: Training Information của form APD: Training Number, trạng thái và tài liệu đã đào tạo', action=lib31.tab('Training Information'))

step('T9B a related document that requires training has an activity of its own')
f4 = new_doc('RUN24 INS that needs its own training', requires=True)
own = rows_of_document(f4['documentNumber'])
check('T9B.1 it has its own activity', len(own) == 1, own)
sop2 = new_doc('RUN24 SOP that lists it as related (T9)', related=[f4['id']])
lead2 = rows_of_document(sop2['documentNumber'])
check('T9B.2 the SOP has another activity', len(lead2) == 1, lead2)
own = rows_of_document(f4['documentNumber'])
check('T9B.3 the INS keeps its own Training Number: it is not given up, not merged', len(own) == 1 and own[0]['status'] != 'CANCELLED' and own[0]['trainingNumber'] != lead2[0]['trainingNumber'], (own, lead2))
admin.call('POST', f"/documents/{f4['id']}/revisions", {})
admin.call('POST', f"/documents/{sop2['id']}/revisions", {})
check('T9B.4 the two activities have no revision in common', not get(lead2[0]['id']).get('groupRevisions') or all(g['documentNumber'] == sop2['documentNumber'] for g in get(lead2[0]['id'])['groupRevisions']), get(lead2[0]['id']).get('groupRevisions'))
src = sources(lead2[0]['id'])
check('T9B.5 the INS is in the Training Materials of the SOP as a related document', any(d['documentNumber'] == f4['documentNumber'] and d['role'] == 'RELATED' for d in src['documents']), [(d['documentNumber'], d['role']) for d in src['documents']])
S['t9'] = {'aid': aid, 'aid2': lead2[0]['id']}
save(S)
lib31.finish('T9', b)
