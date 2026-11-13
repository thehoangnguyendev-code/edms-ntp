"""DEV only: runs the Training activity TRN/QC/26-079 (revision 1.0.1 of SOP.7147) to COMPLETED, then Complete Training + publish.
Organizer/QA accounts are the existing DEV training test accounts; trainees are dcv.u2 (Co-Author) and dcv.u3 (Reviewer)."""
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'training_2026_10_18'))
from api import Client, tick_all, finish_for_qa
from e2e21_matrix import mini_pdf, attempt, sign, admin, qa, trainee, get, TODAY
AID = '8018f6b5-6048-468a-a4f2-29806706c7c1'
RID = '69163672-54d5-41b1-babf-c8f5fa7aeb32'
t1, t2 = Client('dcv.u2'), Client('dcv.u3')
a = get(AID)
print('state', a['status'], 'sessions', len(a.get('sessions', [])), 'participants', len(a.get('participants', [])), 'rules', a.get('contentRules'))
print('caps', {k: v for k, v in a['capabilities'].items() if v})

def step(name, fn):
    try:
        r = fn(); print('OK  ', name, (r or {}).get('status') if isinstance(r, dict) else ''); return r
    except BaseException as e:
        print('FAIL', name, str(e)[:300]); raise SystemExit(1)

a = step('plan session', lambda: admin.call('POST', f'/training/activities/{AID}/sessions', {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'DCV Trainer', 'scheduledOn': TODAY, 'venue': 'Room 1', 'topics': [{'topicText': 'DCV-TEST SOP.7147 1.0.1'}]}))
sid = a['sessions'][0]['id']
print('rules', a['contentRules'])
if a['contentRules'].get('missing'):
    print('missing', a['contentRules']['missing'])
    if 'TRAINING_TEST_REQUIRED' in a['contentRules']['missing']:
        admin.upload(f'/training/activities/{AID}/materials', 'file', 'dcv-test.pdf', mini_pdf('DCV-TEST'), 'application/pdf', '?purpose=EXAM&title=DCV-TEST%20test')
a = step('participants', lambda: admin.call('POST', f'/training/activities/{AID}/participants', {'sessionId': sid, 'personUserIds': [t1.user['id'], t2.user['id']], 'reason': 'DCV-TEST'}))
pids = [p['id'] for p in a['participants']]
step('confirm list', lambda: admin.call('POST', f'/training/activities/{AID}/confirm-list', {'signatureToken': sign(admin), 'reason': 'DCV-TEST'}))
step('approvers review', lambda: admin.call('PUT', f'/training/activities/{AID}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': qa.user['id']}))
step('approvers approve', lambda: admin.call('PUT', f'/training/activities/{AID}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': trainee.user['id']}))
step('content review', lambda: qa.call('POST', f'/training/activities/{AID}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(qa)}))
step('content approve', lambda: trainee.call('POST', f'/training/activities/{AID}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(trainee)}))
step('notify', lambda: admin.call('POST', f'/training/activities/{AID}/notify', {'version': get(AID)['version'], 'signatureToken': sign(admin)}))
tick_all(admin, sid)
step('start', lambda: admin.call('POST', f'/training/sessions/{sid}/hold', {'signatureToken': sign(admin)}))
for pid in pids:
    step('attended', lambda: admin.call('POST', f'/training/participants/{pid}/attendance', {'state': 'ATTENDED'}))
    step('score', lambda: admin.call('POST', f'/training/participants/{pid}/assessments', {'scoreObtained': 9, 'scoreMax': 10, 'remarks': 'DCV-TEST'}))
finish_for_qa(admin, AID, lambda: sign(admin))
a = step('send to QA', lambda: admin.call('POST', f'/training/activities/{AID}/submit-for-confirmation', {'version': get(AID)['version'], 'signatureToken': sign(admin)}))
a = step('QA confirms', lambda: qa.call('POST', f'/training/activities/{AID}/confirm-completion', {'version': get(AID)['version'], 'signatureToken': sign(qa)}))
print('activity', get(AID)['status'], 'completeTraining cap', get(AID)['capabilities'].get('completeTraining'))
