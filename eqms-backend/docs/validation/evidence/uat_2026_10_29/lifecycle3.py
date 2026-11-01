"""DEV UAT, 2026-10-30: the Personnel Training Review (SOP.0003 5.3.11), kind "return after an absence", through the API. The password comes from DEVPW and is never written. The review is for
trainer.test1; the closer is the Department Head of Quality Assurance, which the script sets to approver.test1 for the moment and puts back to empty at the end (the runner script does the same on exit).
Run with plain `python`. Exit code 1 when a check fails."""
import os, sys, json, subprocess, datetime
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'training_2026_10_18'))
from api import Client

PW = os.environ['DEVPW']
TODAY = datetime.date.today()
results = []


def check(name, ok, detail=''):
    results.append((name, ok, str(detail)[:300]))
    print(('PASS  ' if ok else 'FAIL  ') + name + ((' -- ' + str(detail)[:300]) if (detail and not ok) else ''))


def sign(c):
    return c.call('POST', '/auth/verify-signature', {'username': c.user['username'], 'password': PW})['signatureToken']


def attempt(c, method, path, body=None):
    code, payload = c.call(method, path, body, raw=True)
    try:
        data = json.loads(payload) if payload and payload[:1] in (b'{', b'[') else {}
    except Exception:
        data = {}
    return code, data, payload[:300].decode('utf-8', 'ignore')


def set_qa_head(user_id):
    val = "'" + user_id + "'" if user_id else 'null'
    subprocess.run(['docker', 'exec', '-i', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-q', '-v', 'ON_ERROR_STOP=1', '-c',
                    f"update departments set department_head_id = {val} where name = 'Quality Assurance'"], check=True, capture_output=True)


admin = Client('admin')
approver = Client('approver.test1')
person = Client('trainer.test1')
days = lambda n: (TODAY - datetime.timedelta(days=n)).isoformat()
body = lambda **kw: {'personUserId': person.user['id'], 'kind': 'ABSENCE_RETURN', 'eventDate': days(30), 'absenceFrom': days(300), 'absenceTo': days(60), 'note': 'UAT-2026', **kw}


def main():
    set_qa_head(None)
    code, d, t = attempt(admin, 'POST', '/training/personnel-reviews', body())
    check('PR1 with no Department Head in the master data the review cannot be opened (TRAINING_REVIEW_DEPARTMENT_HEAD_MISSING)', code == 400 and 'DEPARTMENT_HEAD_MISSING' in t, (code, t))
    set_qa_head(approver.user['id'])
    code, d, t = attempt(person, 'POST', '/training/personnel-reviews', body())
    check('PR2 a person without training.job_assignment.manage cannot open a review', code in (401, 403), (code, t))
    code, d, t = attempt(admin, 'POST', '/training/personnel-reviews', body(kind='NOT_A_KIND'))
    check('PR3 an unknown kind is refused', code == 400, (code, t))
    code, d, t = attempt(admin, 'POST', '/training/personnel-reviews', body(eventDate=(TODAY + datetime.timedelta(days=3)).isoformat()))
    check('PR4 a date in the future is refused', code == 400 and 'FUTURE' in t, (code, t))
    code, d, t = attempt(admin, 'POST', '/training/personnel-reviews', body(absenceFrom=days(100), absenceTo=days(60)))
    check('PR5 an absence shorter than the months of Training Properties is refused', code == 400 and 'ABSENCE_TOO_SHORT' in t, (code, t))
    code, d, t = attempt(admin, 'POST', '/training/personnel-reviews', body(eventDate=days(90)))
    check('PR6 a return before the end of the absence is refused', code == 400 and 'BEFORE_ABSENCE_END' in t, (code, t))
    code, d, t = attempt(admin, 'POST', '/training/personnel-reviews', body())
    check('PR7 the review is opened (Open) with its items pending', code == 200 and d.get('status') == 'OPEN', (code, t))
    rid = d.get('id')
    print('   review keys:', sorted(d.keys())[:24])
    items = d.get('items') or []
    check('PR8 an absence return has two items: review the record and retraining', len(items) == 2, [x.get('itemCode') for x in items])
    code, d2, t = attempt(admin, 'POST', '/training/personnel-reviews', body())
    check('PR9 a second open review of the same kind for the person is refused (TRAINING_REVIEW_ALREADY_OPEN)', code == 409 and 'ALREADY_OPEN' in t, (code, t))
    code, d2, t = attempt(approver, 'POST', f'/training/personnel-reviews/{rid}/close', {'signatureToken': sign(approver)})
    check('PR10 a review with an item still pending cannot be closed (TRAINING_REVIEW_ITEMS_PENDING)', code == 409 and 'ITEMS_PENDING' in t, (code, t))
    code, d2, t = attempt(admin, 'PUT', f'/training/personnel-reviews/{rid}/items/RETRAINING', {'status': 'NOT_NEEDED'})
    check('PR11 leaving an item out needs a reason', code == 400 and 'REASON_REQUIRED' in t, (code, t))
    code, d2, t = attempt(admin, 'PUT', f'/training/personnel-reviews/{rid}/items/RETRAINING', {'status': 'MAYBE'})
    check('PR12 an unknown item status is refused', code == 400, (code, t))
    code, d2, t = attempt(admin, 'PUT', f'/training/personnel-reviews/{rid}/items/NO_SUCH_ITEM', {'status': 'DONE'})
    check('PR13 an item that the kind does not have is refused', code == 400, (code, t))
    code, d2, t = attempt(admin, 'PUT', f'/training/personnel-reviews/{rid}/items/REVIEW_RECORDS', {'status': 'DONE', 'note': 'UAT-2026 reviewed'})
    check('PR14 the first item is marked done', code == 200, (code, t))
    code, d2, t = attempt(admin, 'PUT', f'/training/personnel-reviews/{rid}/items/RETRAINING', {'status': 'NOT_NEEDED', 'note': 'UAT-2026 nothing to repeat'})
    check('PR15 the second item is left out with a reason', code == 200, (code, t))
    code, d2, t = attempt(admin, 'POST', f'/training/personnel-reviews/{rid}/close', {'signatureToken': sign(admin)})
    check('PR16 only the designated closer (the Department Head) can close the review', code >= 400, (code, t))
    code, d2, t = attempt(approver, 'POST', f'/training/personnel-reviews/{rid}/close', {})
    check('PR17 closing needs an electronic signature', code == 400, (code, t))
    code, d2, t = attempt(approver, 'POST', f'/training/personnel-reviews/{rid}/close', {'signatureToken': sign(approver)})
    check('PR18 the Department Head closes it with a signature: Closed', code == 200 and d2.get('status') == 'CLOSED', (code, t))
    code, d2, t = attempt(admin, 'PUT', f'/training/personnel-reviews/{rid}/items/REVIEW_RECORDS', {'status': 'PENDING'})
    check('PR19 a closed review cannot be changed (TRAINING_REVIEW_CLOSED)', code == 409 and 'REVIEW_CLOSED' in t, (code, t))
    code, d2, t = attempt(admin, 'POST', f'/training/personnel-reviews/{rid}/cancel', {'reason': 'UAT-2026'})
    check('PR20 a closed review cannot be cancelled', code == 409, (code, t))
    # the cancel path
    code, d3, t = attempt(admin, 'POST', '/training/personnel-reviews', body())
    check('PR21 a new review can be opened after the earlier one is closed', code == 200 and d3.get('status') == 'OPEN', (code, t))
    cid = d3.get('id')
    code, d4, t = attempt(admin, 'POST', f'/training/personnel-reviews/{cid}/cancel', {'reason': ''})
    check('PR22 cancelling needs a reason', code == 400, (code, t))
    code, d4, t = attempt(admin, 'POST', f'/training/personnel-reviews/{cid}/cancel', {'reason': 'UAT-2026 opened by mistake'})
    check('PR23 an open review is cancelled with a reason: Cancelled', code == 200 and d4.get('status') == 'CANCELLED', (code, t))
    code, d5, t = attempt(admin, 'GET', f'/training/personnel-reviews?limit=5&search={rid[:8]}')
    check('PR24 the list answers', code == 200 and 'data' in d5, (code, t))


try:
    main()
except BaseException as e:
    check('Personnel review: ran to the end', False, repr(e)[:300])
finally:
    set_qa_head(None)

ok = [r for r in results if r[1] is True]
bad = [r for r in results if r[1] is False]
print(f'\n{len(ok)} passed, {len(bad)} failed (of {len(results)})')
for r in bad:
    print('  FAIL', r[0], '--', r[2])
sys.exit(1 if bad else 0)
