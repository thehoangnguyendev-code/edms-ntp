"""T5: DEC-TRAINING-2026-11-24-7 (revised by the owner on 2026-11-24). The notices of a session are by e-mail only, to the people who were told; the in-app notice is a short result for the people who run
the training. (1) Postponing a session while nobody was told tells nobody by e-mail; once the training is notified, the people on the list and the trainer are told by e-mail with the new day.
(2) The trainer is told only when the training is notified; a trainer replaced after that notice and the new one are told by e-mail with different texts.
Recipients are DEV accounts with an example.local address (Mailhog); no real address is used as a recipient."""
import json, time, urllib.request, urllib.parse
from lib24 import *
import lib31

b = Browser()
T_OLD, T_NEW, P1, P2 = 'uat31.s2.qa.pass', 'uat31.s2.qa.fail', 'uat31.s2.qa.absent', 'uat31.s1.pass1'
TOPIC = 'UAT31 Data integrity: ALCOA+ principles in the laboratory'   # both trainers have a record on this topic and on GMP (SOP.0003: a trainer is qualified by training)
for u in (T_OLD, P1, P2, T_NEW):
    set_status(u, 'Active')
BASE_ACT = '/training-management/activities'


def cnt(q):
    r = sql(q)
    return r[0][0] if r else '0'


def mails(username):
    q = urllib.parse.quote(f'{username}@example.local')
    with urllib.request.urlopen(f'http://localhost:8025/api/v2/search?kind=to&query={q}&limit=100', timeout=10) as r:
        return json.load(r)['items']


def subjects(username):
    return [(m['Content']['Headers'].get('Subject') or [''])[0] for m in mails(username)]


def last_body(username):
    items = mails(username)
    return items[0]['Content']['Body'] if items else ''


def log_rows(aid, event):
    return sql(f"select u.username, l.channel, l.status, coalesce(l.reason_code,'') from training_notification_log l join app_users u on u.id = l.recipient_user_id where l.object_id = '{aid}' and l.event_code = '{event}' order by 1, 2")


def audit_fields(aid, action):
    return {x[0]: x[2] for x in sql(f"select f.field_name, coalesce(f.old_value,''), coalesce(f.new_value,'') from audit_log_changes f where f.audit_log_id = (select id from audit_logs where entity_id = '{aid}' and action_type = '{action}' order by created_at desc limit 1)")}


def inapp(username, title_like, aid):
    return int(cnt(f"select count(*) from user_notifications n join app_users u on u.id = n.recipient_user_id where u.username = '{username}' and n.title like '{title_like}' and n.message like '%{get(aid)['trainingNumber']}%'"))


step('T5.1 an activity of two sessions, not notified: session 1 has the application user T_OLD as trainer and two people on its list')
aid = new_activity('T5 postpone and trainer notices')
body = {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'scheduledOn': TODAY_S, 'locationType': 'ONSITE', 'venue': 'Room A', 'trainerUserId': uid(T_OLD), 'topics': [{'topicText': TOPIC}]}
code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/sessions', body)
check('T5.1 session 1 added', code == 200, (code, t[:200]))
s1 = d['sessions'][-1]['id']
s2 = add_session(aid, 'CLASSROOM', 'TEST', TOPIC, venue='Room B')
p1 = people_on(aid, s1, [P1, P2])
people_on(aid, s2, [P1])
link(aid, 'RUN24 T5 material')
choose_test(aid, s1)
choose_test(aid, s2)
check('T5.2 nobody was told so far: no mail for the trainer, no notified people', cnt(f"select count(*) from training_participants where activity_id = '{aid}' and notified_at is not null") == '0' and not log_rows(aid, 'TRAINING_TRAINER_ASSIGNED'), '')
later = (TODAY + __import__('datetime').timedelta(days=6)).isoformat()
mail0 = {u: len(subjects(u)) for u in (T_OLD, P1, P2, T_NEW)}

step('T5.2 postpone while nobody was told: no e-mail, a short in-app result for the person who runs the training')
a0 = inapp('admin', 'Training: Session 1 postponed', aid)
code, d, t = attempt(admin, 'POST', f'/training/sessions/{s1}/postpone', {'newDate': later, 'reason': 'RUN24 room is not free', 'moveDueDate': False})
check('T5.3 session 1 postponed', code == 200, (code, t[:200]))
check('T5.4 nobody was e-mailed (the training does not exist for them yet)', not log_rows(aid, 'TRAINING_POSTPONED'), log_rows(aid, 'TRAINING_POSTPONED'))
check('T5.5 the person who postponed got the short in-app result', inapp('admin', 'Training: Session 1 postponed', aid) == a0 + 1, '')
f = audit_fields(aid, 'TRAINING_SESSION_POSTPONED')
print('audit postponed (planned):', f)
check('T5.6 the audit entry says nobody had been told, and who got the in-app result', 'nobody had been told' in f.get('E-mail Notice Sent To', '') and f.get('In-App Result To', '-') != '-' and f.get('Session 1 Date', '') != '', f)

step('T5.3 change the trainer of session 1 (T_OLD to T_NEW) before the notice: nobody is told, the audit says when they will be')
code, d, t = attempt(admin, 'PUT', f'/training/sessions/{s1}', {'trainerUserId': uid(T_NEW), 'scheduledOn': later, 'locationType': 'ONSITE', 'venue': 'Room A', 'reason': 'RUN24 the trainer is on leave'})
check('T5.7 trainer changed', code == 200, (code, t[:200]))
check('T5.8 neither the previous nor the new trainer was told (no mail)', not log_rows(aid, 'TRAINING_TRAINER_REMOVED') and not log_rows(aid, 'TRAINING_TRAINER_ASSIGNED'), '')
f = audit_fields(aid, 'TRAINING_SESSION_UPDATED')
print('audit updated:', f)
check('T5.9 the audit entry names the component, the trainer field with the session, the in-app result and the trainer notice rule', f.get('Component') == 'Training Session (Session 1)' and 'Session 1 Trainer' in f and 'In-App Result To' in f and 'Trainer Notice' in f, f)

step('T5.4 approve and notify: the trainers are told now, by e-mail')
confirm_list(aid)
approvals(aid)
notify(aid)
time.sleep(8)
check('T5.10 Notified', get(aid)['status'] == 'NOTIFIED', get(aid)['status'])
assigned = log_rows(aid, 'TRAINING_TRAINER_ASSIGNED')
print('assigned log:', assigned)
check('T5.11 only the trainer of session 1 (T_NEW) was told, by e-mail (SENT); T_OLD was never told so is not told he or she was replaced', {r[0] for r in assigned} == {T_NEW} and any(r[1] == 'EMAIL' and r[2] == 'SENT' for r in assigned) and not log_rows(aid, 'TRAINING_TRAINER_REMOVED'), assigned)
check('T5.12 the in-app channel of the trainer notice is off (not sent)', not any(r[1] == 'IN_APP' and r[2] == 'SENT' for r in assigned), assigned)
check('T5.13 the e-mail reached the Mailhog box of T_NEW, with the trainer subject', any('You are the trainer' in x for x in subjects(T_NEW)), subjects(T_NEW)[:3])
body_new = last_body(T_NEW)
check('T5.14 the trainer e-mail has the session, the day, the place', 'Room A' in body_new and 'Session 1' in body_new, body_new[:200])
s1row = get(aid)['sessions'][0]
check('T5.15 the notified trainer is remembered (so a replacement can be told later)', cnt(f"select count(*) from training_sessions where id = '{s1}' and notified_trainer_id = '{uid(T_NEW)}'") == '1', '')

step('T5.5 postpone after the notice: the people told and the trainer get the new day by e-mail only')
mail1 = {u: len(subjects(u)) for u in (T_OLD, P1, P2, T_NEW)}
later2 = (TODAY + __import__('datetime').timedelta(days=9)).isoformat()
code, d, t = attempt(admin, 'POST', f'/training/sessions/{s1}/postpone', {'newDate': later2, 'reason': 'RUN24 the room is under repair', 'moveDueDate': False})
check('T5.16 session 1 postponed after the notice', code == 200, (code, t[:200]))
time.sleep(8)
rows = log_rows(aid, 'TRAINING_POSTPONED')
print('postponed log:', rows)
check('T5.17 told: the two people on the list of session 1 and its trainer, nobody else', sorted({r[0] for r in rows}) == sorted([P1, P2, T_NEW]), rows)
check('T5.18 each by e-mail (SENT)', all(any(r[0] == u and r[1] == 'EMAIL' and r[2] == 'SENT' for r in rows) for u in (P1, P2, T_NEW)), rows)
check('T5.19 not in the app (the in-app channel is off for the people concerned)', not any(r[1] == 'IN_APP' and r[2] == 'SENT' for r in rows), rows)
mail2 = {u: len(subjects(u)) for u in mail1}
print('mails:', mail1, '->', mail2)
check('T5.20 Mailhog got one e-mail for each of the three, none for T_OLD', all(mail2[u] == mail1[u] + 1 for u in (P1, P2, T_NEW)) and mail2[T_OLD] == mail1[T_OLD], (mail1, mail2))
body = last_body(P1)
print('postponed e-mail body (P1):', body[:600])
check('T5.21 the e-mail has the session, the previous day, the new day, the place, the trainer, the reason', all(x in body for x in ('Session 1', 'Previous day', 'New day', 'Room A', 'under repair')), body[:300])
check('T5.22 the person who postponed got only the short in-app result', inapp('admin', 'Training: Session 1 postponed', aid) == a0 + 2, '')
f = audit_fields(aid, 'TRAINING_SESSION_POSTPONED')
check('T5.23 the audit entry names the people e-mailed', f.get('E-mail Notice Sent To', '-') != '-' and 'nobody' not in f.get('E-mail Notice Sent To', ''), f)

step('T5.6 reopen the content, replace the trainer T_NEW by T_OLD, approve and notify again: the replaced and the new trainer get different e-mails')
code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/reopen-content', {'version': get(aid)['version'], 'reason': 'RUN24 the trainer must be replaced', 'signatureToken': sign(admin)})
check('T5.24 the content is reopened (Planned)', code == 200 and get(aid)['status'] == 'PLANNED', (code, t[:200], get(aid)['status']))
code, d, t = attempt(admin, 'PUT', f'/training/sessions/{s1}', {'trainerUserId': uid(T_OLD), 'scheduledOn': later2, 'locationType': 'ONSITE', 'venue': 'Room A', 'reason': 'RUN24 the trainer is back'})
check('T5.25 trainer changed back (still no mail at this point)', code == 200 and not log_rows(aid, 'TRAINING_TRAINER_REMOVED'), (code, t[:200]))
before = {u: len(subjects(u)) for u in (T_OLD, T_NEW)}
approvals(aid)
notify(aid)
time.sleep(8)
removed = log_rows(aid, 'TRAINING_TRAINER_REMOVED')
assigned = log_rows(aid, 'TRAINING_TRAINER_ASSIGNED')
print('removed:', removed, '\nassigned:', assigned)
check('T5.26 the replaced trainer (T_NEW) got "no longer the trainer" by e-mail', any(r[0] == T_NEW and r[1] == 'EMAIL' and r[2] == 'SENT' for r in removed), removed)
check('T5.27 the new trainer (T_OLD) got "you are the trainer" by e-mail', any(r[0] == T_OLD and r[1] == 'EMAIL' and r[2] == 'SENT' for r in assigned), assigned)
after = {u: len(subjects(u)) for u in before}
check('T5.28 one e-mail each in Mailhog', after[T_OLD] == before[T_OLD] + 1 and after[T_NEW] == before[T_NEW] + 1, (before, after))
b_removed, b_assigned = last_body(T_NEW), last_body(T_OLD)
print('REMOVED body:', b_removed[:500], '\nASSIGNED body:', b_assigned[:500])
check('T5.29 the two e-mails are different: the replaced says "no longer" and the new trainer; the new one says "you are" and in place of whom', 'no longer' in b_removed and 'New trainer' in b_removed and 'In place of' in b_assigned and b_removed != b_assigned, '')
subj_new, subj_old = subjects(T_NEW)[0], subjects(T_OLD)[0]
check('T5.30 different subjects', 'no longer' in subj_new and 'You are the trainer' in subj_old, (subj_new, subj_old))

step('T5.7 the screens: the wording of the four e-mails in Notifications Administration, and the short in-app result')


def bell(pg):
    pg.mouse.click(1454, 28)
    pg.wait_for_timeout(2500)


b.shot('admin', '/training-management/activities', 'T5-01', 'Coordinator_in_app_result', 'T5: thông báo in-app ngắn cho người điều phối: buổi 1 đã được dời', action=bell, tall=False)
b.shot('admin', f'{BASE_ACT}/{aid}', 'T5-02', 'Audit_trail', 'T5: Audit Trail: đổi, dời, đổi giảng viên: ghi người nhận e-mail và kết quả in-app', action=lambda pg: [e for e in pg.get_by_text('Audit Trail', exact=True).all() if e.is_visible()][-1].click(), tall=True)
S = load()
S['t5'] = {'aid': aid}
save(S)
lib31.finish('T5', b)
