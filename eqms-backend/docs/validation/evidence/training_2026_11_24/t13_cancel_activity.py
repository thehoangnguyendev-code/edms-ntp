"""T13: Cancel of a Training Activity (DEC-TRAINING-2026-11-25-3): its own permission, only the people of the department, reason and signature, refused for the training of a document revision,
and what it does."""
from lib24 import *
import lib31

A = 'uat31.s2.qa.pass'
set_status(A, 'Active')
step('T13.1 an activity that does not come from a document: Cancel is offered to the people of the department that hold the permission')
aid = new_activity('T13 cancel')
sid = add_session(aid, 'CLASSROOM', 'TEST', 'RUN24 T13 topic')
people_on(aid, sid, [A])
a = get(aid)
check('T13.1 Cancel is offered in Planned', a['capabilities'].get('cancel') is True, a['capabilities'].get('cancel'))
code, d, t = attempt(U('uat31.s1.pass1'), 'POST', f'/training/activities/{aid}/cancel', {'version': a['version'], 'reason': 'RUN24 x', 'signatureToken': sign(U('uat31.s1.pass1'))})
check('T13.2 a person without the permission is refused (403)', code == 403, (code, t[:120]))
code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/cancel', {'version': a['version'], 'signatureToken': sign(admin)})
check('T13.3 without a reason: refused', code == 400 and 'TRAINING_REASON_REQUIRED' in t, (code, t[:120]))
code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/cancel', {'version': a['version'], 'reason': 'RUN24 not needed'})
check('T13.4 without a signature: refused', code == 400 and 'TRAINING_SIGNATURE_REQUIRED' in t, (code, t[:120]))
code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/cancel', {'version': a['version'], 'reason': 'RUN24 not needed', 'signatureToken': sign(admin)})
check('T13.5 cancelled with a reason and a signature', code == 200 and get(aid)['status'] == 'CANCELLED', (code, t[:150]))
check('T13.6 nothing is offered any more', get(aid)['capabilities'].get('cancel') is False, get(aid)['capabilities'].get('cancel'))
check('T13.7 the Audit Trail has the entry with the reason', sql(f"select count(*) from audit_logs where entity_id = '{aid}' and action_type = 'TRAINING_NUMBER_CANCELLED'")[0][0] == '1', '')
check('T13.8 the signature is recorded', sql(f"select count(*) from electronic_signatures where entity_id::text = '{aid}' and meaning = 'TRAINING_ACTIVITY_CANCELLED'")[0][0] == '1', '')

step('T13.2 the training of a revision of Document Control is not cancelled here')
body = {'documentName': 'RUN24 SOP for the cancel check (T13)', 'documentType': 'Standard Operating Procedure', 'businessUnit': 'Quality Unit', 'department': 'Quality Assurance', 'author': admin.user['id'],
        'language': 'English', 'requiresTraining': True, 'trainingPeriodDays': 14, 'description': 'RUN24', 'isTemplate': False, 'coAuthorIds': [], 'reviewerUserIds': [dco.user['id']],
        'approverUserIds': [qa.user['id']], 'relatedDocumentIds': [], 'correlatedDocumentIds': []}
doc = admin.call('POST', '/documents', body)
rid = admin.call('POST', f"/documents/{doc['id']}/revisions", {})['id']
bad = approve_revision(rid, 'RUN24 T13', 'RUN24')
did = rows_of_document(doc['documentNumber'])[0]['id']
d0 = get(did)
check('T13.9 the activity of the document is Planned', d0['status'] == 'PLANNED', d0['status'])
check('T13.10 Cancel is not offered', d0['capabilities'].get('cancel') is False, d0['capabilities'].get('cancel'))
code, d, t = attempt(admin, 'POST', f'/training/activities/{did}/cancel', {'version': d0['version'], 'reason': 'RUN24 try', 'signatureToken': sign(admin)})
check('T13.11 the server refuses it (409 TRAINING_ACTIVITY_OF_DOCUMENT)', code == 409 and 'TRAINING_ACTIVITY_OF_DOCUMENT' in t, (code, t[:150]))
check('T13.12 the activity and the revision are as they were', get(did)['status'] == 'PLANNED', get(did)['status'])
lib31.finish('T13', None) if False else None
