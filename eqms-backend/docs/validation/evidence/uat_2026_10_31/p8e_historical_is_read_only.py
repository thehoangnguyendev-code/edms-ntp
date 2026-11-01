"""Part 8e: the historical activity of a Legacy Import is read-only (nothing of the normal life of a training can be done to it), and Obsolete of the document does not disturb it."""
from lib7 import *

state = load()
p8 = state['p8']
act = p8['actC']          # an activity of kind LEGACY (the author is also a trainee)
t1, t2 = trainees


def snapshot():
    return {
        'status': sql(f"select status from training_activities where id = '{act}'")[0][0],
        'sessions': sql(f"select count(*) from training_sessions where activity_id = '{act}'")[0][0],
        'participants': sql(f"select count(*) from training_participants where activity_id = '{act}'")[0][0],
        'records': sql(f"select count(*) from training_records where activity_id = '{act}'")[0][0],
        'remarks': sql(f"select coalesce(remarks,'') from training_activities where id = '{act}'")[0][0],
        'version': sql(f"select version from training_activities where id = '{act}'")[0][0],
    }


before = snapshot()
detail = admin.call('GET', f'/training/activities/{act}')
caps = {k: v for k, v in (detail.get('capabilities') or {}).items() if v is True}
print('capabilities that are true:', sorted(caps), flush=True)

step('H-8 nothing of the normal life of a training can be done to a historical activity')
tries = [
    ('update the activity', 'PUT', f'/training/activities/{act}', {'version': int(before['version']), 'remarks': 'changed by UAT8'}),
    ('add a session', 'POST', f'/training/activities/{act}/sessions', {'method': 'CLASSROOM', 'scheduledOn': '2026-12-01', 'locationType': 'ONSITE', 'venue': 'Room', 'topics': [{'topicText': 'x'}]}),
    ('add participants', 'POST', f'/training/activities/{act}/participants', {'personUserIds': [t2]}),
    ('cancel the activity', 'POST', f'/training/activities/{act}/cancel', {'version': int(before['version']), 'reason': 'UAT8', 'signatureToken': sign(admin)}),
    ('notify participants', 'POST', f'/training/activities/{act}/notify', {}),
    ('send the attendance list', 'POST', f'/training/activities/{act}/send-attendance-list', {'signatureToken': sign(admin)}),
    ('finish the training', 'POST', f'/training/activities/{act}/finish-training', {'signatureToken': sign(admin)}),
    ('confirm the completion', 'POST', f'/training/activities/{act}/confirm-completion', {'version': int(before['version']), 'signatureToken': sign(admin)}),
    ('make a supplementary training', 'POST', f'/training/activities/{act}/supplementary', {'personUserIds': [t2], 'reason': 'UAT8'}),
    ('change the approvers', 'PUT', f'/training/activities/{act}/approvers', {}),
]
for label, method, path, body in tries:
    code, data, text = attempt(admin, method, path, body)
    check('H-8.1 refused: ' + label, 400 <= code < 500, (code, text[:140]))
    if code == 200:
        print('   !!! ACCEPTED:', label, text[:200], flush=True)
after = snapshot()
check('H-8.2 the activity, its records and its sessions are exactly as they were', after == before, (before, after))
check('H-8.3 no capability that changes the activity is offered to the person', not (set(caps) & {'planSessions', 'addParticipants', 'removeParticipants', 'cancel', 'confirmCompletion', 'sendAttendance', 'notify', 'finishTraining', 'edit', 'update'}), sorted(caps))

step('H-9 Obsolete of the document that was imported')
doc_id = sql(f"select d.id from documents d join document_revisions r on r.document_id = d.id where r.training_activity_id = '{act}' limit 1")[0][0]
code, data, text = attempt(admin, 'POST', f'/documents/{doc_id}/obsolete', {'reason': 'UAT8 obsolete of an imported document', 'obsoleteDate': None, 'signatureToken': sign(admin)})
check('H-9.1 the imported document can be made Obsolete', code == 200, (code, text[:300]))
check('H-9.2 its historical activity is not touched by it', snapshot() == before, snapshot())
link = admin.call('GET', f'/training/links/documents/{doc_id}')
check('H-9.3 Document Control still shows the training of the obsolete document', link.get('trainingNumber') and link.get('status') == 'COMPLETED', link)
finish('p8e')
