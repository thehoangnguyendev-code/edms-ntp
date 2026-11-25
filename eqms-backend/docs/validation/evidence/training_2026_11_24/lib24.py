"""The run of 2026-11-24 (DEV only): the Training Activity lifecycle with one and several sessions, absent / failed / retrained people, and a training that comes from Document Control
(a new SOP with related documents, then an upgrade of only some of them). It reuses the helpers of the UAT run of 2026-10-31 (clients, checks, SQL, Edge with named shots) and writes into
its own folder. The password comes from DEVPW (never written); records are titled "RUN24 ..."; nothing is deleted. Method of a session: SELF_READING (APD.0108, confirmed by the head of the
department) or CLASSROOM with a TEST (APD.0009, paper copies, scored by the trainer)."""
import os, sys, json, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'uat_2026_10_31'))
import lib31
lib31.SHOTS = os.path.join(HERE, 'shots')
lib31.INDEX = os.path.join(HERE, 'index.json')
lib31.STATE = os.path.join(HERE, 'state24.json')
lib31.RESULTS = os.path.join(HERE, 'results.json')
lib31.APDDIR = os.path.join(HERE, 'apd')
for d in (lib31.SHOTS, lib31.APDDIR):
    os.makedirs(d, exist_ok=True)
from lib31 import *          # noqa: E402,F401,F403
from flows31 import admin, qa, dco, approve2, get, new_document, approve_revision, publish_revision, rows_of_document   # noqa: E402,F401

def approve_revision(rid, text, label):
    """Upload the file, send for review, review, approve (each signed; there is no separate 'complete editing' step any more). Returns the failed steps."""
    admin.upload(f'/revisions/{rid}/upload', 'file', 'run24-sop.docx', mini_docx(text, ('Purpose', 'Scope', 'Procedure step 1', 'Procedure step 2')), DOCX)
    bad = []
    for who, st in ((admin, 'submit-review'), (dco, 'review/complete'), (qa, 'approve/complete')):
        code, data, t = attempt(who, 'POST', f'/revisions/{rid}/{st}', {'signatureToken': sign(who), 'comment': label, 'reason': label})
        if code != 200:
            bad.append((st, code, t))
    return bad


HEAD_QA, HEAD_QC, HEAD_PROD = 'uat31.head.qa', 'uat31.head.qc', 'uat31.head.prod'
APPR1, APPR2 = 'approver.test1', 'user.a.test'   # the two people who hold the permission to approve the content of a training (the heads do not)
TODAY_S = TODAY.isoformat()


def room(n=1):
    return f'RUN24 training room {n}'


def new_activity(title, kind='UNPLANNED', reason='OTHER'):
    a = admin.call('POST', '/training/activities', {'kind': kind, 'kindReason': reason, 'trainingTitle': 'RUN24 ' + title})
    return a['id']


def add_session(aid, method, assessment, topic, rid=None, scheduled=None, venue=None):
    t = {'topicText': topic}
    if rid:
        t['documentRevisionId'] = rid
    body = {'method': method, 'assessmentMethod': assessment, 'externalTrainerName': 'RUN24 Trainer', 'scheduledOn': scheduled or TODAY_S,
            'locationType': 'ONSITE', 'venue': venue or room(), 'topics': [t]}
    code, d, t_ = attempt(admin, 'POST', f'/training/activities/{aid}/sessions', body)
    if code != 200:
        raise SystemExit(f'add session -> {code} {t_}')
    return d['sessions'][-1]['id']


def link(aid, title, sid=None):
    admin.call('POST', f'/training/activities/{aid}/material-links', {'title': title, 'url': 'https://example.com/run24', 'sessionId': sid})


def approved_assessment():
    rows = admin.call('GET', '/training/assessments/approved?limit=50')
    rows = rows.get('data', rows) if isinstance(rows, dict) else rows
    for r in rows:
        if r.get('kind') in ('QUESTIONS', 'TEST'):
            return r['id']
    return rows[0]['id']


def choose_test(aid, sid):
    code, d, t = attempt(admin, 'PUT', f'/training/activities/{aid}/assessment', {'assessmentId': approved_assessment(), 'sessionId': sid})
    if code != 200:
        raise SystemExit(f'choose assessment -> {code} {t}')


def people_on(aid, sid, usernames, reason='RUN24 invited'):
    a = admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': [uid(u) for u in usernames], 'reason': reason})
    return {u: p['id'] for p in a['participants'] if p['sessionId'] == sid for u in usernames if p['personUserId'] == uid(u)}


def confirm_list(aid):
    admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'RUN24 list prepared'})


def approvals(aid, first=APPR1, second=APPR2):
    """Two approvers (any two people who hold the permission), submit with a signature, each approves in turn."""
    admin.call('PUT', f'/training/activities/{aid}/approver-pair', {'firstUserId': uid(first), 'secondUserId': uid(second)})
    admin.call('POST', f'/training/activities/{aid}/submit-for-approval', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
    a, b = U(first), U(second)
    a.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE_FIRST', 'signatureToken': sign(a)})
    b.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(b)})


def notify(aid):
    return admin.call('POST', f'/training/activities/{aid}/notify', {'version': get(aid)['version'], 'signatureToken': sign(admin)})


def prepare(aid):
    admin.call('POST', f'/training/activities/{aid}/preparation/fill-in', {})
    for s in get(aid)['sessions']:
        if s['status'] == 'PLANNED':
            for item in ('VENUE', 'EQUIPMENT', 'MATERIALS', 'NOTICE'):
                cur = [i for i in admin.call('GET', f'/training/activities/{aid}/preparation') if i['sessionId'] == s['id']][0]['items']
                if [i for i in cur if i['itemCode'] == item][0]['status'] == 'PENDING':
                    admin.call('PUT', f"/training/sessions/{s['id']}/preparation/{item}", {'status': 'DONE'})


def set_paper(sid, reason=None):
    """A session conducted on paper (the default is electronic): the test copies must be printed before Start Training."""
    return attempt(admin, 'POST', f'/training/sessions/{sid}/delivery-mode', {'mode': 'PAPER', 'reason': reason})


def print_tests(aid):
    """The paper copies of the test of every session that is on paper and has a test (APD.0009): the print is recorded; Start Training asks for it."""
    for s in get(aid)['sessions']:
        if s['status'] == 'PLANNED' and s.get('assessmentMethod') == 'TEST' and s.get('deliveryMode') in ('PAPER', 'MIXED'):
            code, payload = admin.call('POST', f"/training/sessions/{s['id']}/exam-pack", {}, raw=True)
            if code != 200:
                raise SystemExit(f"exam-pack of session {s.get('sessionNo')} -> {code} {payload[:200]}")


def scan_test(aid, pid):
    """The scan of the completed paper test of one person (APD.0009): a session on paper cannot be finished until every person who attended has one."""
    return admin.upload(f'/training/activities/{aid}/paper-evidence', 'file', 'run24-scan.pdf', mini_pdf('RUN24 scan of a completed test'), 'application/pdf', f'?kind=ASSESSMENT&participantId={pid}')


def start(aid):
    return attempt(admin, 'POST', f'/training/activities/{aid}/start-training', {'version': get(aid)['version'], 'signatureToken': sign(admin)})


def hold(sid):
    return attempt(admin, 'POST', f'/training/sessions/{sid}/hold', {})


def run_to_notified(aid):
    confirm_list(aid)
    approvals(aid)
    notify(aid)


def attend(pid, state='ATTENDED', reason=None):
    body = {'state': state}
    if reason:
        body['absenceReason'] = reason
    return attempt(admin, 'POST', f'/training/participants/{pid}/attendance', body)


def score(pid, got, mx=10):
    return attempt(admin, 'POST', f'/training/participants/{pid}/assessments', {'scoreObtained': got, 'scoreMax': mx, 'remarks': 'RUN24'})


def read(username, pid):
    c = U(username)
    return attempt(c, 'POST', f'/training/me/participations/{pid}/confirm-read', {'signatureToken': sign(c), 'reason': 'RUN24 I read the document and understood it'})


def cannot_read(pid, reason):
    return attempt(admin, 'POST', f'/training/participants/{pid}/cannot-read', {'signatureToken': sign(admin), 'reason': reason})


def head_verifies(aid, head):
    h = U(head)
    return attempt(h, 'POST', f'/training/activities/{aid}/verify-self-reading', {'signatureToken': sign(h), 'reason': 'RUN24 head: the people of the department read the document'})


def selfreading_only(a):
    return all(s['method'] == 'SELF_READING' for s in a['sessions'] if s['status'] != 'CANCELLED')


def finish_training(aid):
    """The trainer sends the attendance list (when it is on paper) and finishes the training: the results go to QA."""
    a = get(aid)
    if not a.get('attendanceSentAt') and not selfreading_only(a):
        attempt(admin, 'POST', f'/training/activities/{aid}/send-attendance-list', {'version': a['version'], 'signatureToken': sign(admin)})
    a = get(aid)
    return attempt(admin, 'POST', f'/training/activities/{aid}/finish-training', {'version': a['version'], 'signatureToken': sign(admin)})


def confirm_completion(aid, who=None):
    who = who or qa
    return attempt(who, 'POST', f'/training/activities/{aid}/confirm-completion', {'version': get(aid)['version'], 'signatureToken': sign(who)})


def finish(aid):
    f = finish_training(aid)
    return f, confirm_completion(aid)


def supplementary(aid, pids, reason):
    return attempt(admin, 'POST', f'/training/activities/{aid}/supplementary', {'participantIds': pids, 'reason': reason})


def part(a, username):
    return [p for p in a['participants'] if p['personUserId'] == uid(username)]


def shot_tabs(b, aid, id_, name, caption, tabs=('General Information',)):
    """A shot of the activity for each tab named (full page)."""
    for i, label in enumerate(tabs):
        one = len(tabs) == 1
        b.shot('admin', f'/training-management/activities/{aid}', id_ if one else f'{id_}{chr(97 + i)}', name if one else f'{name}_{slug(label)}',
               caption if one else f'{caption} ({label})', action=None if label == 'General Information' else tab(label), full=True)
