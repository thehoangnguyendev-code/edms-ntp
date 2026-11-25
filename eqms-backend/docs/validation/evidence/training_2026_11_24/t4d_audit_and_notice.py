"""T4-D: the Audit Trail and the notices of the session steps (DEC-TRAINING-2026-11-24-5).
Cancel session: module Training Management, object Training Activity <number>, component = the session; each field says which session it is about; the notice goes to the trainer of the session and to the
person who opened the activity (never to the person who acts, never to the people on the session). Postpone and change of a session: the same naming of the component in the fields."""
import re
from lib24 import *
import lib31

b = Browser()
A = 'uat31.s2.qa.pass'
for u in (A,):
    set_status(u, 'Active')
BASE_ACT = '/training-management/activities'


def cnt(q):
    r = sql(q)
    return r[0][0] if r else '0'

step('T4D.1 an activity opened by QA (approver.test1); session 1 has the app user A as trainer, session 2 an external trainer')
creator, creator_name, aid = admin, 'admin', None
for name in ('user.a.test', APPR1):
    c = U(name)
    code, d, t = attempt(c, 'POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'trainingTitle': 'RUN24 T4D audit and notices'})
    print('open as', name, code, t[:100] if code != 200 else '')
    if code == 200:
        creator, creator_name, aid = c, name, d['id']
        break
if aid is None:
    print('nobody but admin can open an activity: the opener notice is not tested')
    aid = new_activity('T4D audit and notices')


def session(venue, trainer_id=None, topic='RUN24 T4D part'):
    body = {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'scheduledOn': TODAY_S, 'locationType': 'ONSITE', 'venue': venue, 'topics': [{'topicText': f'{topic} {venue}'}]}
    if trainer_id:
        body['trainerUserId'] = trainer_id
    else:
        body['externalTrainerName'] = 'RUN24 External Trainer'
    code, d, t = attempt(creator, 'POST', f'/training/activities/{aid}/sessions', body)
    if code != 200:
        raise SystemExit(f'add session -> {code} {t[:200]}')
    return d['sessions'][-1]['id']


s1 = session('Room A', uid(A))
s2 = session('Room B')
check('T4D.1 two sessions', len(get(aid)['sessions']) == 2, '')


def audit_rows(action):
    return sql(f"select l.id, l.comment from audit_logs l where l.entity_id = '{aid}' and l.action_type = '{action}' order by l.created_at desc limit 1")


def change_fields(action):
    r = audit_rows(action)
    if not r:
        return {}
    return {x[0]: (x[1], x[2]) for x in sql(f"select field_name, coalesce(old_value,''), coalesce(new_value,'') from audit_log_changes where audit_log_id = '{r[0][0]}'")}


step('T4D.2 change session 2 (trainer, day, place) and postpone it: the fields name the session')
code, d, t = attempt(creator, 'PUT', f'/training/sessions/{s2}', {'externalTrainerName': 'RUN24 Other Trainer', 'scheduledOn': TODAY_S, 'locationType': 'ONSITE', 'venue': 'Room C', 'reason': 'RUN24 room changed'})
check('T4D.2 session 2 changed', code == 200, (code, t[:200]))
f = change_fields('TRAINING_SESSION_UPDATED')
check('T4D.3 the change entry names its component and the session in every field', f.get('Component', ('', ''))[1] == 'Training Session (Session 2)' and 'Session 2 Venue' in f and 'Session 2 Trainer' in f and 'Venue' not in f, f)
later = (TODAY + __import__('datetime').timedelta(days=5)).isoformat()
code, d, t = attempt(creator, 'POST', f'/training/sessions/{s2}/postpone', {'newDate': later, 'reason': 'RUN24 postponed', 'moveDueDate': False})
check('T4D.4 session 2 postponed', code == 200, (code, t[:200]))
f = change_fields('TRAINING_SESSION_POSTPONED')
check('T4D.5 the postponement entry names its component, the dates and the reason of the session', f.get('Component', ('', ''))[1] == 'Training Session (Session 2)' and 'Session 2 Date' in f and 'Session 2 Postponement Reason' in f, f)

step('T4D.3 cancel session 1 by admin: the audit entry and the notice')
before = {u: cnt(f"select count(*) from user_notifications where recipient_user_id = '{uid(u)}' and title = 'Training: Session 1 cancelled' and message like '%{get(aid)['trainingNumber']}%'") for u in (A, creator_name, 'admin')}
code, d, t = attempt(admin, 'POST', f'/training/sessions/{s1}/cancel', {'reason': 'RUN24 not needed', 'signatureToken': sign(admin)})
check('T4D.6 session 1 cancelled', code == 200, (code, t[:200]))
f = change_fields('TRAINING_SESSION_CANCELLED')
print({k: v for k, v in f.items()})
check('T4D.7 component named', f.get('Component', ('', ''))[1] == 'Training Session (Session 1)', f)
check('T4D.8 status Planned to Cancelled, with the session in the field name', f.get('Session 1 Status') == ('Planned', 'Cancelled'), f)
check('T4D.9 the details of the cancelled session are in the entry (topic, day, place, trainer)', 'Room A' in f.get('Session 1 Details', ('', ''))[0], f.get('Session 1 Details'))
check('T4D.10 the sessions left are counted', f.get('Sessions in the Activity') == ('2', '1'), f.get('Sessions in the Activity'))
check('T4D.11 the reason and the people told are recorded', f.get('Session 1 Cancellation Reason', ('', ''))[1] == 'RUN24 not needed' and 'E-mail Notice Sent To' in f and 'In-App Result To' in f, f)
r = sql(f"select entity_type, action_type, from_status, to_status, electronic_signature_applied from audit_logs where entity_id = '{aid}' and action_type = 'TRAINING_SESSION_CANCELLED' order by created_at desc limit 1")[0]
check('T4D.12 object type Training Activity, signed, the activity status shown is Planned', r[0] == 'TRAINING_ACTIVITY' and r[2] == 'PLANNED' and r[3] == 'PLANNED', r)
check('T4D.13 the cancellation carries an electronic signature (meaning Training Session Cancelled) on the activity', int(cnt(f"select count(*) from electronic_signatures where entity_id::text = '{aid}' and meaning = 'TRAINING_SESSION_CANCELLED'")) == 1, '')
after = {u: cnt(f"select count(*) from user_notifications where recipient_user_id = '{uid(u)}' and title = 'Training: Session 1 cancelled' and message like '%{get(aid)['trainingNumber']}%'") for u in before}
print('notices:', before, '->', after)
check('T4D.14 the trainer of the session was NOT told: the training was never notified (e-mail only to people who were told)', int(after[A]) == int(before[A]) and 'nobody had been told' in f.get('E-mail Notice Sent To', ('', ''))[1], (before, after, f.get('E-mail Notice Sent To', ('', ''))[1]))
if creator_name != 'admin':
    check('T4D.15 the person who opened the activity got the short in-app result', int(after[creator_name]) == int(before[creator_name]) + 1, (before, after))
check('T4D.16 the person who cancelled got the short in-app result too', int(after['admin']) == int(before['admin']) + 1, (before, after))
check('T4D.16b nobody was e-mailed', not sql(f"select 1 from training_notification_log where object_id = '{aid}' and event_code = 'TRAINING_SESSION_CANCELLED'"), '')
check('T4D.17 the people on the cancelled session were not told (they were never notified)', cnt(f"select count(*) from training_participants where activity_id = '{aid}' and notified_at is not null") == '0', '')
print('log of the channels:', sql(f"select recipient_user_id, channel, status, coalesce(reason_code,'') from training_notification_log where object_id = '{aid}' and event_code = 'TRAINING_SESSION_CANCELLED' order by channel"))
print('the notice:', sql(f"select title, message from user_notifications where recipient_user_id = '{uid(A)}' and related_entity_id = '{aid}' order by created_at desc limit 1"))

step('T4D.4 the screens: the Audit Trail of the activity, and the notice as the trainer sees it')


def audit_tab(pg):
    els = [e for e in pg.get_by_text('Audit Trail', exact=True).all() if e.is_visible()]
    els[-1].click()
    pg.wait_for_timeout(2500)


b.shot('admin', f'{BASE_ACT}/{aid}', 'T4D-01', 'Audit_trail_tab', 'T4-D: tab Audit Trail của activity: các dòng của buổi (đổi, dời, huỷ)', action=audit_tab, tall=True)
def open_bell(pg):
    pg.mouse.click(1454, 28)
    pg.wait_for_timeout(2500)


b.shot(A, '/training-management/activities', 'T4D-02', 'Trainer_notice', 'T4-D: thông báo trong app của giảng viên: buổi bị huỷ (chuông thông báo)', action=open_bell, tall=False)
S = load()
S['t4d'] = {'aid': aid}
save(S)
lib31.finish('T4D', b)
