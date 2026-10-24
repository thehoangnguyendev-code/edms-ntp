"""DEV: the Training Activities in every kind, reason, method, assessment, place and result, driven through the API as the screens do, from the creation to the completion by QA, with the
signature of every change of state. Each variant is a line of the matrix below; the expected result is written from the SOP and PLAN-TR-002, not from what the system answers.
The password comes from DEVPW (never written); records are titled "E2E-TEST matrix ..."; none is deleted."""
import os, sys, json, datetime, traceback
sys.path.insert(0, os.path.dirname(__file__))
from api import Client, tick_all, finish_for_qa

PW = os.environ['DEVPW']
TODAY = datetime.date.today().isoformat()
results = []


def check(name, ok, detail=''):
    results.append((name, ok, detail))
    print(('PASS  ' if ok else 'FAIL  ') + name + (' -- ' + str(detail)[:400] if detail and not ok else ''))


def sign(c):
    return c.call('POST', '/auth/verify-signature', {'username': c.user['username'], 'password': PW})['signatureToken']


def attempt(c, method, path, body=None):
    code, payload = c.call(method, path, body, raw=True)
    try:
        data = json.loads(payload) if payload else {}
    except Exception:
        data = {}
    return code, data, payload[:400].decode('utf-8', 'ignore')


def mini_pdf(text):
    objs = [b'<< /Type /Catalog /Pages 2 0 R >>', b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>']
    stream = ('BT /F1 14 Tf 60 780 Td (' + text + ') Tj ET').encode()
    objs.append(b'<< /Length ' + str(len(stream)).encode() + b' >>\nstream\n' + stream + b'\nendstream')
    objs.append(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
    out = b'%PDF-1.4\n'
    offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += str(i).encode() + b' 0 obj\n' + o + b'\nendobj\n'
    xref = len(out)
    out += b'xref\n0 ' + str(len(objs) + 1).encode() + b'\n0000000000 65535 f \n'
    for off in offsets:
        out += ('%010d 00000 n \n' % off).encode()
    out += b'trailer\n<< /Size ' + str(len(objs) + 1).encode() + b' /Root 1 0 R >>\nstartxref\n' + str(xref).encode() + b'\n%%EOF\n'
    return out


admin = Client('admin')               # organizer and conductor
qa = Client('approver.test1')         # reviews the content, confirms the completion
trainee = Client('user.a.test')       # approves the content; the trainee
other = Client('dco.test1')           # a second trainee (absent in some variants)


def get(aid):
    return admin.call('GET', f'/training/activities/{aid}')


def body_of(spec):
    if spec['kind'] == 'EXTERNAL':
        return {'externalTrainerName': 'E2E Consultant', 'scheduledOn': TODAY, 'venue': 'Hotel', 'topics': [{'topicText': 'E2E-TEST external topic'}]}
    b = {'method': spec['method'], 'assessmentMethod': spec['assessment'], 'externalTrainerName': 'External Trainer', 'scheduledOn': TODAY, 'topics': [{'topicText': 'E2E-TEST topic'}]}
    if spec.get('place') == 'ONLINE':
        b.update({'locationType': 'ONLINE', 'onlinePlatform': 'Microsoft Teams', 'meetingLink': 'https://example.com/e2e-meeting'})
    else:
        b['venue'] = 'Room 1'
    return b


def run_variant(spec):
    """One variant from the creation to the completion. Returns the id of the activity, or None when a step was refused (the failure is recorded)."""
    name = spec['name']
    ext = spec['kind'] == 'EXTERNAL'
    try:
        body = {'kind': spec['kind'], 'trainingTitle': 'E2E-TEST matrix ' + name}
        if spec.get('reason'):
            body['kindReason'] = spec['reason']
        if ext:
            body.update({'externalType': spec.get('external', 'ACTIVE'), 'trainingUnitName': 'E2E-TEST Training Unit', 'kindReason': 'OTHER'})
        code, data, text = attempt(admin, 'POST', '/training/activities', body)
        if code != 200:
            check(f'{name}: created', False, (code, text))
            return None
        aid = data['id']
        check(f'{name}: created as {spec["kind"]}, status Planned, with a Training Number', data['status'] == 'PLANNED' and bool(data['trainingNumber']), (data['status'], data['trainingNumber']))
        code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/sessions', body_of(spec))
        if code != 200:
            check(f'{name}: session added', False, (code, text))
            return aid
        sid = data['sessions'][0]['id']
        people = [trainee.user['id']] + ([other.user['id']] if spec.get('absent') else [])
        a = admin.call('POST', f'/training/activities/{aid}/participants', {'sessionId': sid, 'personUserIds': people, 'reason': 'E2E-TEST'})
        pid = {p['personUserId']: p['id'] for p in a['participants']}
        admin.call('POST', f'/training/activities/{aid}/confirm-list', {'signatureToken': sign(admin), 'reason': 'E2E-TEST'})
        rules = get(aid)['contentRules']
        # What the rules ask (PLAN-TR-002), written here from the case and checked against the answer of the server.
        want_materials = not ext and spec.get('reason') != 'VISITOR'
        want_test = not ext and spec.get('reason') != 'VISITOR' and spec['assessment'] == 'TEST'
        want_check = not ext and spec.get('reason') != 'VISITOR' and spec['assessment'] == 'CHECKLIST'
        check(f'{name}: the rules ask for materials={want_materials} test={want_test} checklist={want_check}',
              rules['materialsRequired'] == want_materials and rules['testRequired'] == want_test and rules['checklistRequired'] == want_check, rules)
        if not ext:
            code, data, text = attempt(admin, 'PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_REVIEW', 'assigneeUserId': qa.user['id']})
            admin.call('PUT', f'/training/activities/{aid}/approvers', {'step': 'CONTENT_APPROVE', 'assigneeUserId': trainee.user['id']})
            if want_materials or want_test or want_check:
                code, data, text = attempt(qa, 'POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(qa)})
                check(f'{name}: the content review is refused while something required is missing', code == 409, (code, text))
            if want_materials:
                admin.call('POST', f'/training/activities/{aid}/material-links', {'title': 'E2E-TEST material', 'url': 'https://example.com/e2e'})
            if want_test or want_check:
                admin.upload(f'/training/activities/{aid}/materials', 'file', 'e2e-form.pdf', mini_pdf('E2E-TEST form'), 'application/pdf', '?purpose=EXAM&title=E2E-TEST%20form')
            check(f'{name}: nothing is missing now', get(aid)['contentRules']['missing'] == [], get(aid)['contentRules'])
            qa.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_REVIEW', 'signatureToken': sign(qa)})
            trainee.call('POST', f'/training/activities/{aid}/confirm-content', {'step': 'CONTENT_APPROVE', 'signatureToken': sign(trainee)})
        code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/notify', {'version': get(aid)['version']})
        check(f'{name}: notify without a signature is refused', code == 400 and 'TRAINING_SIGNATURE_REQUIRED' in text, (code, text))
        a = admin.call('POST', f'/training/activities/{aid}/notify', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
        check(f'{name}: notified', a['status'] == 'NOTIFIED', a['status'])
        tick_all(admin, sid)
        a = admin.call('POST', f'/training/sessions/{sid}/hold', {'signatureToken': sign(admin)})
        check(f'{name}: started, in progress', a['status'] == 'IN_PROGRESS', a['status'])
        s = [x for x in a['sessions'] if x['id'] == sid][0]
        check(f'{name}: the session has its day and no held state', s['status'] == 'PLANNED' and s['heldOn'] == TODAY, s)
        state = 'ONLINE' if spec['method'] == 'HYBRID' else 'ATTENDED'
        if not ext and spec['method'] == 'SELF_READING':
            # The employee confirms the reading with a signature; the head of the unit verifies it (SOP.0003 5.3.7).
            code, data, text = attempt(trainee, 'POST', f"/training/me/participations/{pid[trainee.user['id']]}/confirm-read", {'signatureToken': sign(trainee)})
            check(f'{name}: the employee confirms the reading', code == 200, (code, text))
        else:
            a = admin.call('POST', f"/training/participants/{pid[trainee.user['id']]}/attendance", {'state': state})
            got = [p for p in a['participants'] if p['id'] == pid[trainee.user['id']]][0]
            check(f'{name}: attendance recorded as {state}', got['state'] == state, got['state'])
        if spec.get('absent'):
            code, data, text = attempt(admin, 'POST', f"/training/participants/{pid[other.user['id']]}/attendance", {'state': 'ABSENT'})
            check(f'{name}: an absence needs a reason', code == 400, (code, text))
            admin.call('POST', f"/training/participants/{pid[other.user['id']]}/attendance", {'state': 'ABSENT', 'absenceReason': 'E2E-TEST on leave'})
        if ext:
            got = [p for p in get(aid)['participants'] if p['id'] == pid[trainee.user['id']]][0]
            check(f'{name}: external, no score: the person who attended has completed it', got['result'] == 'PASSED', got)
        elif spec['assessment'] == 'SELF_READING_CONFIRMATION':
            a = admin.call('POST', f'/training/activities/{aid}/verify-self-reading', {'signatureToken': sign(admin), 'reason': 'E2E-TEST'})
            got = [p for p in a['participants'] if p['id'] == pid[trainee.user['id']]][0]
            check(f'{name}: self-reading verified: passed', got['result'] == 'PASSED', got)
        else:
            obtained = 9 if spec.get('outcome', 'pass') == 'pass' else 5
            want = 'PASSED' if obtained >= 7 else 'FAILED'
            code, data, text = attempt(admin, 'POST', f"/training/participants/{pid[trainee.user['id']]}/assessments", {'scoreObtained': 11, 'scoreMax': 10})
            check(f'{name}: a score above the maximum is refused', code == 400, (code, text))
            a = admin.call('POST', f"/training/participants/{pid[trainee.user['id']]}/assessments", {'scoreObtained': obtained, 'scoreMax': 10, 'remarks': 'E2E-TEST'})
            got = [p for p in a['participants'] if p['id'] == pid[trainee.user['id']]][0]
            check(f'{name}: {obtained}/10 gives {want} (pass mark 70%)', got['result'] == want, got['result'])
        finish_for_qa(admin, aid, lambda: sign(admin))
        code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/submit-for-confirmation', {'version': get(aid)['version']})
        check(f'{name}: send to QA without a signature is refused', code == 400 and 'TRAINING_SIGNATURE_REQUIRED' in text, (code, text))
        finish_for_qa(admin, aid, lambda: sign(admin))
        code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/submit-for-confirmation', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
        check(f'{name}: sent to QA', code == 200 and data.get('status') == 'PENDING_QA_CONFIRMATION', (code, text))
        code, data, text = attempt(admin, 'POST', f'/training/activities/{aid}/confirm-completion', {'version': get(aid)['version'], 'signatureToken': sign(admin)})
        check(f'{name}: the person who prepared the list cannot confirm (segregation of duties)', code >= 400 and 'SEGREGATION' in text, (code, text))
        code, data, text = attempt(qa, 'POST', f'/training/activities/{aid}/confirm-completion', {'version': get(aid)['version'], 'signatureToken': sign(qa)})
        check(f'{name}: QA confirms: Completed', code == 200 and data.get('status') == 'COMPLETED', (code, text))
        done = get(aid)
        check(f'{name}: the completion day is kept', bool(done.get('completedOn')), done.get('completedOn'))
        return aid
    except SystemExit as e:
        check(f'{name}: no step of the variant failed', False, str(e)[:400])
    except Exception as e:
        check(f'{name}: no step of the variant failed', False, traceback.format_exc()[-400:])
    return None


MATRIX = [
    # kind, reason, method, assessment, place, outcome
    dict(name='initial classroom test pass', kind='INITIAL', reason='NEW_HIRE', method='CLASSROOM', assessment='TEST'),
    dict(name='initial classroom test fail', kind='INITIAL', reason='NEW_HIRE', method='CLASSROOM', assessment='TEST', outcome='fail'),
    dict(name='periodic classroom test pass', kind='PERIODIC', reason='OTHER', method='CLASSROOM', assessment='TEST'),
    dict(name='periodic self-reading', kind='PERIODIC', reason='SOP_VERSION', method='SELF_READING', assessment='SELF_READING_CONFIRMATION'),
    dict(name='unplanned new SOP classroom test', kind='UNPLANNED', reason='NEW_SOP', method='CLASSROOM', assessment='TEST', absent=True),
    dict(name='unplanned transfer practical checklist', kind='UNPLANNED', reason='TRANSFER', method='PRACTICAL', assessment='CHECKLIST'),
    dict(name='unplanned CAPA hybrid test online', kind='UNPLANNED', reason='CAPA', method='HYBRID', assessment='TEST', place='ONLINE'),
    dict(name='unplanned audit finding practical observation', kind='UNPLANNED', reason='AUDIT_FINDING', method='PRACTICAL', assessment='OBSERVATION'),
    dict(name='unplanned visitor classroom', kind='UNPLANNED', reason='VISITOR', method='CLASSROOM', assessment='TEST'),
    dict(name='unplanned absence return self-reading', kind='UNPLANNED', reason='ABSENCE_RETURN', method='SELF_READING', assessment='SELF_READING_CONFIRMATION'),
    dict(name='unplanned other classroom checklist fail', kind='UNPLANNED', reason='OTHER', method='CLASSROOM', assessment='CHECKLIST', outcome='fail'),
    dict(name='external active', kind='EXTERNAL', external='ACTIVE', method='CLASSROOM', assessment='TEST'),
    dict(name='external passive', kind='EXTERNAL', external='PASSIVE', method='CLASSROOM', assessment='TEST'),
]

if __name__ == '__main__':
    only = sys.argv[1:]
    for spec in MATRIX:
        if only and not any(o in spec['name'] for o in only):
            continue
        print(chr(10) + '== ' + spec['name'])
        run_variant(spec)
    failed = [r for r in results if not r[1]]
    print(f'\n{len(results) - len(failed)} of {len(results)} checks passed')
    sys.exit(1 if failed else 0)
