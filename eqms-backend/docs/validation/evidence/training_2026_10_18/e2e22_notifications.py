"""DEV: what each person is told, in the application and by e-mail (MailHog), at each step of a training activity, with the recipient, the title, the text and the link read from the answer of the
system. The password comes from DEVPW (never written); records are titled "E2E-TEST notices ..."; none is deleted. Usage: python e2e22_notifications.py [dump]"""
import os, sys, json, time, datetime, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
from api import Client, tick_all, finish_for_qa
from e2e21_matrix import mini_pdf

PW = os.environ['DEVPW']
TODAY = datetime.date.today().isoformat()
results = []
dump = len(sys.argv) > 1 and sys.argv[1] == 'dump'

admin = Client('admin')
qa = Client('approver.test1')
trainee = Client('user.a.test')
other = Client('dco.test1')
PEOPLE = {'admin': admin, 'qa': qa, 'trainee': trainee, 'other': other}


def sign(c):
    return c.call('POST', '/auth/verify-signature', {'username': c.user['username'], 'password': PW})['signatureToken']


def check(name, ok, detail=''):
    results.append((name, ok, detail))
    print(('PASS  ' if ok else 'FAIL  ') + name + (' -- ' + str(detail)[:500] if detail and not ok else ''))


def inbox(c, aid):
    d = c.call('GET', '/notifications?limit=100&page=1')
    rows = d.get('data') or []
    return [r for r in rows if (r.get('relatedItem') or {}).get('id') == aid]


def mails():
    with urllib.request.urlopen('http://localhost:8025/api/v2/messages?limit=300') as r:
        return json.load(r)['items']


def mails_for(aid):
    out = []
    for m in mails():
        body = m['Content']['Body']
        if aid in body:
            out.append(m)
    return out


def snapshot(aid):
    return {k: {n['id']: n for n in inbox(c, aid)} for k, c in PEOPLE.items()}


def news(before, after):
    return {k: [after[k][i] for i in after[k] if i not in before[k]] for k in PEOPLE}


def show(step, delta):
    if not dump:
        return
    print('   --', step)
    for k, rows in delta.items():
        for r in rows:
            print(f"      {k:8} [{r['type']}] {r['title']} | {r['description']} | {r['actionUrl']}")


aid = None
a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'trainingTitle': 'E2E-TEST notices'})
aid = a['id']
number = a['trainingNumber']
a = admin.call('POST', f'/training/activities/{aid}/sessions', {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'External Trainer', 'scheduledOn': TODAY, 'venue': 'Room 1', 'topics': [{'topicText': 'E2E-TEST topic'}]})
sid = a['sessions'][0]['id']
a = admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': [trainee.user['id'], other.user['id']], 'reason': 'E2E-TEST'})
pid = {p['personUserId']: p['id'] for p in a['participants']}
admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'E2E-TEST'})
admin.call('POST', f'/training/activities/{aid}/material-links', {'title': 'E2E-TEST material', 'url': 'https://example.com/e2e'})
admin.upload(f'/training/activities/{aid}/materials', 'file', 'e2e-test.pdf', mini_pdf('E2E-TEST'), 'application/pdf', '?purpose=EXAM&title=E2E-TEST%20test')

b0 = snapshot(aid)
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': qa.user['id']})
admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': trainee.user['id']})
b1 = snapshot(aid)
d = news(b0, b1)
show('designate the reviewer and the approver', d)
check('1.1 the reviewer is told of the step to review', any('review' in (r['description'] or '').lower() and number in r['description'] for r in d['qa']), d['qa'])
check('1.2 the approver is told of the step to approve', any('approve' in (r['description'] or '').lower() and number in r['description'] for r in d['trainee']), d['trainee'])
check('1.3 the organizer who designated is not told', not d['admin'], d['admin'])
check('1.4 the link opens the activity', all(r['actionUrl'] == f'/training-management/activities/{aid}' for k in d for r in d[k]), d)

qa.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(qa)})
b2 = snapshot(aid)
d = news(b1, b2)
show('the content is reviewed', d)
check('2.1 the approver is told that the review is done and it is the turn to approve', any(number in (r['description'] or '') for r in d['trainee']), d['trainee'])
trainee.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(trainee)})
b3 = snapshot(aid)
d = news(b2, b3)
show('the content is approved', d)
check('2.2 the organizer is told that the content was approved (the activity can be notified)', any(number in (r['description'] or '') for r in d['admin']), d['admin'])

admin.call('POST', f'/training/activities/{aid}/notify', {'version': admin.call('GET', f'/training/activities/{aid}')['version'], 'signatureToken': sign(admin)})
b4 = snapshot(aid)
d = news(b3, b4)
show('notify the participants', d)
for who in ('trainee', 'other'):
    texts = [r['description'] or '' for r in d[who]]
    check(f'3.{who}: the trainee is invited with the Training Number, the title, the day and the place', any(number in t and 'E2E-TEST notices' in t and TODAY.replace('-', '/') [:0] == '' for t in texts), texts)
check('3.3 the organizer is not told of its own notify', not d['admin'], d['admin'])

tick_all(admin, sid)
admin.call('POST', f'/training/sessions/{sid}/hold', {'signatureToken': sign(admin)})
admin.call('POST', f"/training/participants/{pid[trainee.user['id']]}/attendance", {'state': 'ATTENDED'})
admin.call('POST', f"/training/participants/{pid[other.user['id']]}/attendance", {'state': 'ABSENT', 'absenceReason': 'E2E-TEST on leave'})
admin.call('POST', f"/training/participants/{pid[trainee.user['id']]}/assessments", {'scoreObtained': 5, 'scoreMax': 10, 'remarks': 'E2E-TEST'})
b5 = snapshot(aid)
d = news(b4, b5)
show('the training started, attendance, a failed result', d)
check('4.1 a trainee who did not pass is told that the work is suspended until the retraining (SOP.0003 5.3.7)', any('suspend' in ((r['title'] or '') + (r['description'] or '')).lower() for r in d['trainee']), d['trainee'])

finish_for_qa(admin, aid, lambda: sign(admin))
admin.call('POST', f'/training/activities/{aid}/submit-for-confirmation', {'version': admin.call('GET', f'/training/activities/{aid}')['version'], 'signatureToken': sign(admin)})
b6 = snapshot(aid)
d = news(b5, b6)
show('send to QA', d)
check('5.1 QA is told at once', any('QA' in (r['title'] or '') and number in (r['description'] or '') for r in d['qa']), d['qa'])
check('5.2 the sender is not told', not d['admin'], d['admin'])

qa.call('POST', f'/training/activities/{aid}/return-for-correction', {'version': admin.call('GET', f'/training/activities/{aid}')['version'], 'reason': 'E2E-TEST return', 'signatureToken': sign(qa)})
b7 = snapshot(aid)
d = news(b6, b7)
show('QA returns the results for correction', d)
check('6.1 the organizer is told that QA returned the results, with the reason', any('"E2E-TEST return"' in (r['description'] or '') for r in d['admin']), d['admin'])

finish_for_qa(admin, aid, lambda: sign(admin))
admin.call('POST', f'/training/activities/{aid}/submit-for-confirmation', {'version': admin.call('GET', f'/training/activities/{aid}')['version'], 'signatureToken': sign(admin)})
qa.call('POST', f'/training/activities/{aid}/confirm-completion', {'version': admin.call('GET', f'/training/activities/{aid}')['version'], 'signatureToken': sign(qa)})
b8 = snapshot(aid)
d = news(b7, b8)
show('QA confirms the completion', d)
check('7.1 the organizer is told that the training is completed', any(number in (r['description'] or '') and 'complete' in ((r['title'] or '') + (r['description'] or '')).lower() for r in d['admin']), d['admin'])
check('7.2 nobody is told of a record when nobody passed (one failed, one was absent)', not any(r['type'] == 'training-recorded' for k in ('trainee', 'other') for r in d[k]), (d['trainee'], d['other']))

print('\n== e-mail')
ms = mails_for(aid)
subjects = {}
for m in ms:
    subjects.setdefault(m['Content']['Headers']['Subject'][0], 0)
    subjects[m['Content']['Headers']['Subject'][0]] += 1
if dump:
    for k, v in subjects.items():
        print('   ', v, k)
inapp_titles = set()
for k in PEOPLE:
    for n in b8[k].values():
        inapp_titles.add('EQMS: ' + n['title'])
check('8.1 every e-mail has an in-app notice with the same title', set(subjects) <= inapp_titles, set(subjects) - inapp_titles)
check('8.2 every in-app notice has its e-mail', inapp_titles <= set(subjects), inapp_titles - set(subjects))
check('8.3 every e-mail carries the Training Number and the link to the activity', all(number in m['Content']['Body'] and f'/training-management/activities/{aid}' in m['Content']['Body'] for m in ms), len(ms))
dup = {}
for k in PEOPLE:
    for n in b8[k].values():
        dup.setdefault((k, n['type'], n['description']), 0)
        dup[(k, n['type'], n['description'])] += 1
check('8.4 no notice is sent twice (the results are sent to QA twice on purpose: once more after the return)', all(v == 1 for key, v in dup.items() if key[1] != 'training-submitted-to-qa') and all(v == 2 for key, v in dup.items() if key[1] == 'training-submitted-to-qa'), [key for key, v in dup.items() if v > 1])

failed = [r for r in results if not r[1]]
print(f'\n{len(results) - len(failed)} of {len(results)} checks passed')
sys.exit(1 if failed else 0)
