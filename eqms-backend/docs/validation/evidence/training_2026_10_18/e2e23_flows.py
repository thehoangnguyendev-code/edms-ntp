"""DEV: the other courses of a training activity: cancel (before and after the notice), postpone, reopen the content, return for correction, the list locked, the segregation of duties, the check-in
of a trainee with the code, the supplementary training; and who is allowed. The expected results are written from the SOP and the rules of the module. The password comes from DEVPW (never written);
records are titled "E2E-TEST flows ..."; none is deleted."""
import os, sys, json, datetime
sys.path.insert(0, os.path.dirname(__file__))
from api import Client, tick_all, finish_for_qa
from e2e21_matrix import mini_pdf, attempt, check, sign, results, admin, qa, trainee, other, get, TODAY
import e2e21_matrix as m

TOMORROW = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()


def planned(title, people=None, content=True, notify=False, start=False):
    a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'trainingTitle': 'E2E-TEST flows ' + title})
    aid = a['id']
    a = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'External Trainer', 'scheduledOn': TODAY, 'venue': 'Room 1', 'topics': [{'topicText': 'E2E-TEST topic'}]})
    sid = a['sessions'][0]['id']
    a = admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': people or [trainee.user['id']], 'reason': 'E2E-TEST'})
    pid = {p['personUserId']: p['id'] for p in a['participants']}
    admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'E2E-TEST'})
    if content:
        admin.call('POST', f'/training/activities/{aid}/material-links', {'title': 'E2E-TEST material', 'url': 'https://example.com/e2e'})
        admin.upload(f'/training/activities/{aid}/materials', 'file', 'e2e-test.pdf', mini_pdf('E2E-TEST'), 'application/pdf', '?purpose=EXAM&title=E2E-TEST%20test')
        admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': qa.user['id']})
        admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': trainee.user['id']})
        qa.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(qa)})
        trainee.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(trainee)})
    if notify:
        admin.call('POST', f'/training/activities/{aid}/notify', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
    if start:
        tick_all(admin, sid)
        admin.call('POST', f'/training/sessions/{sid}/hold', {'signatureToken': sign(admin)})
    return aid, sid, pid


def inbox(c, aid):
    return [r for r in (c.call('GET', '/notifications?limit=100&page=1').get('data') or []) if (r.get('relatedItem') or {}).get('id') == aid]


print('== 1. cancel before the notice: a reason is enough')
aid, sid, pid = planned('cancel early', notify=False)
code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/cancel', {'version': get(aid)['version']})
check('1.1 a cancel with no reason is refused', code == 400, (code, text))
code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/cancel', {'version': get(aid)['version'], 'reason': 'E2E-TEST not needed'})
check('1.2 a cancel before the notice needs a signature too (every change of state is signed)', code == 400 and 'TRAINING_SIGNATURE_REQUIRED' in text, (code, text))
code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/cancel', {'version': get(aid)['version'], 'reason': 'E2E-TEST not needed', 'signatureToken': sign(admin)})
check('1.2b cancelled with a reason and a signature', code == 200 and data.get('status') == 'CANCELLED', (code, text))
check('1.3 nobody is told of a cancellation (nothing was communicated)', not [r for r in inbox(trainee, aid) if r['type'] == 'training-cancelled'])

print(chr(10) + '== 2. cancel after the notice: signed, and the people are told')
aid, sid, pid = planned('cancel late', notify=True)
code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/cancel', {'version': get(aid)['version'], 'reason': 'E2E-TEST stop'})
check('2.1 a cancel after the notice needs a signature', code == 400 and 'TRAINING_SIGNATURE_REQUIRED' in text, (code, text))
code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/cancel', {'version': get(aid)['version'], 'reason': 'E2E-TEST stop', 'signatureToken': sign(admin)})
check('2.2 cancelled', code == 200 and data.get('status') == 'CANCELLED', (code, text))
told = [r for r in inbox(trainee, aid) if r['type'] == 'training-cancelled']
check('2.3 the trainee is told that the training was cancelled, with the reason', len(told) == 1 and 'E2E-TEST stop' in told[0]['description'], [r['description'] for r in inbox(trainee, aid)])

print(chr(10) + '== 3. cancel after a result: refused')
aid, sid, pid = planned('cancel with results', notify=True, start=True)
admin.call('POST', f"/training/participants/{pid[trainee.user['id']]}/attendance", {'state': 'ATTENDED'})
admin.call('POST', f"/training/participants/{pid[trainee.user['id']]}/assessments", {'scoreObtained': 9, 'scoreMax': 10})
code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/cancel', {'version': get(aid)['version'], 'reason': 'E2E-TEST', 'signatureToken': sign(admin)})
check('3.1 an activity that has a passed result cannot be cancelled', code == 409 and 'TRAINING_ACTIVITY_HAS_RESULTS' in text, (code, text))

print(chr(10) + '== 4. postpone a session')
aid, sid, pid = planned('postpone', notify=True)
code, data, text = attempt(admin, 'POST', f'/training/sessions/{sid}/postpone', {'newDate': TOMORROW})
check('4.1 a postponement with no reason is refused', code == 400, (code, text))
code, data, text = attempt(admin, 'POST', f'/training/sessions/{sid}/postpone', {'reason': 'E2E-TEST room busy'})
check('4.2 a postponement with no new day is refused', code == 400, (code, text))
code, data, text = attempt(admin, 'POST', f'/training/sessions/{sid}/postpone', {'newDate': TOMORROW, 'reason': 'E2E-TEST room busy'})
check('4.3 postponed: the number is kept and the day moves', code == 200 and data['trainingNumber'] == get(aid)['trainingNumber'] and [s for s in data['sessions'] if s['id'] == sid][0]['scheduledOn'] == TOMORROW, (code, text))
told = [r for r in inbox(trainee, aid) if r['type'] == 'training-postponed']
tom = TOMORROW[8:10] + '/' + TOMORROW[5:7] + '/' + TOMORROW[:4]
check('4.4 the trainee is told the new day (dd/MM/yyyy) and the reason', len(told) == 1 and tom in told[0]['description'] and 'E2E-TEST room busy' in told[0]['description'], [r['description'] for r in told])
tick_all(admin, sid)
admin.call('POST', f'/training/sessions/{sid}/hold', {'signatureToken': sign(admin)})
code, data, text = attempt(admin, 'POST', f'/training/sessions/{sid}/postpone', {'newDate': TOMORROW, 'reason': 'E2E-TEST again'})
check('4.5 a session that has started cannot be postponed', code == 409, (code, text))

print(chr(10) + '== 5. reopen the content after the notice')
aid, sid, pid = planned('reopen', notify=True)
code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/reopen-content', {'version': get(aid)['version'], 'reason': 'E2E-TEST add a slide'})
check('5.1 reopening needs a signature', code == 400 and 'TRAINING_SIGNATURE_REQUIRED' in text, (code, text))
code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/reopen-content', {'version': get(aid)['version'], 'reason': 'E2E-TEST add a slide', 'signatureToken': sign(admin)})
check('5.2 reopened: Planned again, the content must be confirmed again', code == 200 and data.get('status') == 'PLANNED', (code, text))
code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/notify', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
check('5.3 it cannot be notified before the content is confirmed again', code == 409, (code, text))

print(chr(10) + '== 6. return for correction')
aid, sid, pid = planned('return', notify=True, start=True)
admin.call('POST', f"/training/participants/{pid[trainee.user['id']]}/attendance", {'state': 'ATTENDED'})
admin.call('POST', f"/training/participants/{pid[trainee.user['id']]}/assessments", {'scoreObtained': 9, 'scoreMax': 10})
finish_for_qa(admin, aid, lambda: sign(admin))
admin.call('POST', f'/training/activities/{aid}/submit-for-confirmation', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
code, data, text = attempt(qa, 'POST', f'/training/activities/{aid}/return-for-correction', {'version': get(aid)['version'], 'signatureToken': sign(qa)})
check('6.1 a return with no reason is refused', code == 400, (code, text))
code, data, text = attempt(qa, 'POST', f'/training/activities/{aid}/return-for-correction', {'version': get(aid)['version'], 'reason': 'E2E-TEST fix a score', 'signatureToken': sign(qa)})
check('6.2 returned: In progress', code == 200 and data.get('status') == 'IN_PROGRESS', (code, text))
told = [r for r in inbox(admin, aid) if r['type'] == 'training-returned']
check('6.3 the organizer is told, with the reason', len(told) == 1 and 'E2E-TEST fix a score' in told[0]['description'], [r['description'] for r in inbox(admin, aid)])
finish_for_qa(admin, aid, lambda: sign(admin))
admin.call('POST', f'/training/activities/{aid}/submit-for-confirmation', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
code, data, text = attempt(qa, 'POST', f'/training/activities/{aid}/confirm-completion', {'version': get(aid)['version'], 'signatureToken': sign(qa)})
check('6.4 sent again and completed by QA', code == 200 and data.get('status') == 'COMPLETED', (code, text))
told_admin = [r for r in inbox(admin, aid) if r['type'] == 'training-completed']
told_trainee = [r for r in inbox(trainee, aid) if r['type'] == 'training-recorded']
check('6.5 the organizer is told of the completion, with the day', len(told_admin) == 1 and '/' in told_admin[0]['description'], [r['description'] for r in inbox(admin, aid)])
check('6.6 the trainee is told that the training is in the personal record', len(told_trainee) == 1, [r['description'] for r in inbox(trainee, aid)])

print(chr(10) + '== 7. the list is locked, and the segregation of duties')
aid, sid, pid = planned('locks', notify=False)
code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': [other.user['id']], 'reason': 'E2E-TEST'})
check('7.1 a person cannot be added after the list was confirmed', code == 409 and 'TRAINING_LIST_LOCKED' in text, (code, text))
code, data, text = attempt(other, 'POST', f'/training/activities/{aid}/notify', {'version': get(aid)['version'], 'signatureToken': sign(other)})
check('7.2 a person with no right on the activities (dco.test1) cannot notify', code == 403, (code, text))
code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(admin)})
check('7.3 the organizer cannot review its own content (not the designated reviewer)', code in (403, 409), (code, text))
aid, sid, pid = planned('self attendance', people=[trainee.user['id'], qa.user['id']], notify=True, start=True)
code, data, text = attempt(trainee, 'POST', f"/training/participants/{pid[trainee.user['id']]}/attendance", {'state': 'ATTENDED'})
check('7.4 a person cannot record his own attendance, even with the right to conduct (segregation of duties)', code == 400 and 'SEGREGATION' in text, (code, text))
code, data, text = attempt(other, 'POST', f"/training/participants/{pid[trainee.user['id']]}/attendance", {'state': 'ATTENDED'})
check('7.4b a person with no right to conduct cannot record attendance', code == 403, (code, text))
code, data, text = attempt(admin, 'POST', f"/training/participants/{pid[trainee.user['id']]}/assessments", {'scoreObtained': 9, 'scoreMax': 10})
check('7.5 a score for a person who is not marked present is refused', code in (400, 409), (code, text))

print(chr(10) + '== 8. the check-in of a trainee with the code')
aid, sid, pid = planned('check-in', notify=True)
code, data, text = attempt(admin, 'POST', f'/training/sessions/{sid}/check-in/open', {})
check('8.1 the door cannot open before the training starts', code == 409, (code, text))
tick_all(admin, sid)
admin.call('POST', f'/training/sessions/{sid}/hold', {'signatureToken': sign(admin)})
st = admin.call('POST', f'/training/sessions/{sid}/check-in/open', {})
check('8.2 the door opens with a six-digit code', bool(st.get('open')) and len(str(st.get('code'))) == 6, st)
code, data, text = attempt(trainee, 'POST', '/training/me/check-in', {'code': '000000' if st['code'] != '000000' else '111111', 'signatureToken': sign(trainee)})
check('8.3 a wrong code is refused', code == 400, (code, text))
code, data, text = attempt(trainee, 'POST', '/training/me/check-in', {'code': st['code']})
check('8.4 a check-in with no signature is refused (the trainee signs the attendance)', code == 400 and 'TRAINING_SIGNATURE_REQUIRED' in text, (code, text))
code, data, text = attempt(trainee, 'POST', '/training/me/check-in', {'code': st['code'], 'signatureToken': sign(trainee)})
check('8.5 the trainee checks in with the code and the signature', code == 200, (code, text))
mine = [p for p in get(aid)['participants'] if p['personUserId'] == trainee.user['id']][0]
check('8.6 the attendance is recorded as checked in by the person', mine['state'] == 'ATTENDED' and mine.get('signMode') == 'SELF', mine)
code, data, text = attempt(trainee, 'POST', '/training/me/check-in', {'code': st['code'], 'signatureToken': sign(trainee)})
check('8.7 a second check-in of the same person is refused', code >= 400, (code, text))

print(chr(10) + '== 9. a make-up training for the person who was absent')
aid, sid, pid = planned('supplementary', people=[trainee.user['id'], other.user['id']], notify=True, start=True)
admin.call('POST', f"/training/participants/{pid[trainee.user['id']]}/attendance", {'state': 'ATTENDED'})
admin.call('POST', f"/training/participants/{pid[other.user['id']]}/attendance", {'state': 'ABSENT', 'absenceReason': 'E2E-TEST leave'})
admin.call('POST', f"/training/participants/{pid[trainee.user['id']]}/assessments", {'scoreObtained': 9, 'scoreMax': 10})
parent = get(aid)
a = admin.call('POST', f'/training/activities/{aid}/supplementary', {'participantIds': [pid[other.user['id']]], 'reason': 'E2E-TEST make-up'})
check('9.1 the number of the parent with the next letter', a['trainingNumber'].startswith(parent['trainingNumber']) and a['trainingNumber'] != parent['trainingNumber'], a['trainingNumber'])
check('9.2 it keeps the content of the training it supplements', a['contentRules']['inherited'] and a['contentRules']['missing'] == [], a['contentRules'])
code, data, text = attempt(admin, 'POST', f"/training/activities/{aid}/supplementary", {'participantIds': [pid[trainee.user['id']]], 'reason': 'E2E-TEST'})
check('9.3 a person who attended and passed cannot be given a make-up', code == 400, (code, text))

failed = [r for r in results if not r[1]]
print(f'\n{len(results) - len(failed)} of {len(results)} checks passed')
sys.exit(1 if failed else 0)
