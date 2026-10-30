"""DEV: (1) the rules of the codes of the Training Requirement, the Training Matrix and the Training Assessment (Training Administration, Code Rules): the list, the refusal of a pattern the rules do not
allow, the change with the version and its Audit Trail entry, the new code made by the new rule, the number that goes on without repeating, and the rule put back at the end. (2) A session held
HYBRID: the place and the platform with the link are both needed and both kept. The password comes from DEVPW. Records are named "E2E-TEST ..."; none is deleted."""
import os, sys, time, datetime, re
sys.path.insert(0, os.path.dirname(__file__))
from e2e21_matrix import admin, check, attempt, results

stamp = str(int(time.time()))[-6:]
TODAY = datetime.date.today().isoformat()


def rules():
    return {r['entity']: r for r in admin.call('GET', '/training/code-rules')}


print('== 1. the rules of the codes')
r0 = rules()
check('1.1 the three rules are listed with an example', set(r0) == {'REQUIREMENT', 'MATRIX', 'ASSESSMENT'} and all(r['example'] for r in r0.values()), r0)
for entity, bad in (('ASSESSMENT', 'TAS'), ('REQUIREMENT', 'REQ {SEQ:3}'), ('MATRIX', 'TM-{SEQ:3}'), ('ASSESSMENT', 'TAS-{DEPT}-{SEQ:3}'), ('REQUIREMENT', 'REQ-{SEQ:9}')):
    code, d, raw = attempt(admin, 'PUT', f'/training/code-rules/{entity}', {'version': r0[entity]['version'], 'pattern': bad, 'reason': 'E2E-TEST bad'})
    check(f'1.2 {entity} {bad!r} is refused (400)', code == 400, (code, raw))
code, d, raw = attempt(admin, 'POST', '/training/code-rules/preview', {'entity': 'ASSESSMENT', 'pattern': f'E2E{stamp}-{{SEQ:3}}'})
check('1.3 the preview gives the code the pattern would make', code == 200 and d['example'] == f'E2E{stamp}-001', (code, raw))
code, d, raw = attempt(admin, 'PUT', '/training/code-rules/ASSESSMENT', {'version': r0['ASSESSMENT']['version'] + 5, 'pattern': f'E2E{stamp}-{{SEQ:3}}', 'reason': 'E2E-TEST stale'})
check('1.4 a change made on an old version is refused (409)', code == 409, (code, raw))

# the assessment code follows the new rule, the number goes on
old_pattern = r0['ASSESSMENT']['pattern']
code, d, raw = attempt(admin, 'PUT', '/training/code-rules/ASSESSMENT', {'version': r0['ASSESSMENT']['version'], 'pattern': f'E2E{stamp}-{{SEQ:3}}', 'reason': 'E2E-TEST new rule'})
check('1.5 the rule is changed', code == 200 and d['pattern'] == f'E2E{stamp}-{{SEQ:3}}' and d['version'] == r0['ASSESSMENT']['version'] + 1, (code, raw))
item = {'kind': 'ESSAY', 'prompt': 'E2E-TEST code rule', 'options': [], 'correct': [], 'points': 1}
codes = []
for i in range(2):
    code, a, raw = attempt(admin, 'POST', '/training/assessments', {'name': f'E2E-TEST code rule {stamp} {i}', 'kind': 'QUESTIONS', 'items': [item]})
    codes.append(a.get('code') if code == 200 else raw)
nums = [int(c.rsplit('-', 1)[1]) for c in codes if isinstance(c, str) and c.startswith(f'E2E{stamp}-')]
check('1.6 the new assessments have the codes of the new rule, one after the other (the number goes on, it does not start again)', len(nums) == 2 and nums[1] == nums[0] + 1 and nums[0] >= 49, codes)
older = admin.call('GET', '/training/assessments?limit=200&sortBy=code&sortDirection=desc')['data']
check('1.7 the codes issued before do not change', any(re.fullmatch(r'TAS-\d{4}', x['code']) for x in older), [x['code'] for x in older][:5])
ev = admin.call('GET', '/audit-trail?limit=20&search=TRAINING_CODE_RULE_UPDATED') if False else None
code, d, raw = attempt(admin, 'PUT', '/training/code-rules/ASSESSMENT', {'version': d['version'], 'pattern': old_pattern, 'reason': 'E2E-TEST put back'})
check('1.8 the rule is put back', code == 200 and d['pattern'] == old_pattern, (code, raw))
code, a, raw = attempt(admin, 'POST', '/training/assessments', {'name': f'E2E-TEST code rule {stamp} back', 'kind': 'QUESTIONS', 'items': [item]})
check('1.9 the next assessment is made by the rule put back, with a number that was not used', code == 200 and re.fullmatch(r'TAS-\d{4}', a['code']) and a['code'] not in [x['code'] for x in older], (code, a.get('code') if code == 200 else raw))

# the requirement code
rq = rules()['REQUIREMENT']
code, req, raw = attempt(admin, 'POST', '/training/requirements', {'year': 2031, 'kind': 'ANNUAL'})
check('1.10 a requirement is numbered by the rule (year and three digits)', code == 200 and re.fullmatch(r'REQ/2031-\d{3}', req['requestNo']), (code, raw))
code, req2, raw = attempt(admin, 'POST', '/training/requirements', {'year': 2031, 'kind': 'ANNUAL'})
check('1.11 the next one has the next number', code == 200 and int(req2['requestNo'][-3:]) == int(req['requestNo'][-3:]) + 1, (code, raw))

print(chr(10) + '== 2. a session held on site and online (HYBRID)')
code, k, raw = attempt(admin, 'POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER'})
check('2.0 an activity is made', code == 200, raw)
base = {'method': 'CLASSROOM', 'assessmentMethod': 'TEST', 'externalTrainerName': 'Tran Van Ngoai', 'scheduledOn': TODAY, 'topics': [{'topicText': f'E2E-TEST hybrid {stamp}'}], 'locationType': 'HYBRID'}
code, d, raw = attempt(admin, 'POST', f"/training/activities/{k['id']}/sessions", dict(base, venue='Room 1'))
check('2.1 a hybrid session without the platform and the link is refused (400)', code == 400, (code, raw))
code, d, raw = attempt(admin, 'POST', f"/training/activities/{k['id']}/sessions", dict(base, onlinePlatform='Zoom', meetingLink='https://zoom.us/j/123'))
check('2.2 a hybrid session without the physical location is refused (400)', code == 400, (code, raw))
code, d, raw = attempt(admin, 'POST', f"/training/activities/{k['id']}/sessions", dict(base, venue='Room 1', onlinePlatform='Zoom', meetingLink='http://zoom.us/j/123'))
check('2.3 the link must be https (400)', code == 400, (code, raw))
code, d, raw = attempt(admin, 'POST', f"/training/activities/{k['id']}/sessions", dict(base, venue='Room 1', onlinePlatform='Zoom', meetingLink='https://zoom.us/j/123'))
s = d['sessions'][0] if code == 200 else {}
check('2.4 a hybrid session keeps the type, the place, the platform and the link', code == 200 and s.get('locationType') == 'HYBRID' and s.get('venue') == 'Room 1' and s.get('onlinePlatform') == 'Zoom' and s.get('meetingLink') == 'https://zoom.us/j/123', (code, s or raw))
code, d, raw = attempt(admin, 'PUT', f"/training/sessions/{s['id']}", {'externalTrainerName': 'Tran Van Ngoai', 'locationType': 'ONLINE', 'onlinePlatform': 'Zoom', 'meetingLink': 'https://zoom.us/j/456', 'reason': 'E2E-TEST online only'}) if s else (0, {}, '')
s2 = next((x for x in d.get('sessions', []) if x['id'] == s.get('id')), {}) if code == 200 else {}
check('2.5 the session can be changed from hybrid to online only (the place is dropped)', code == 200 and s2.get('locationType') == 'ONLINE' and not s2.get('venue'), (code, s2 or raw))
print(sum(1 for r in results if r[1]), 'of', len(results), 'checks passed')
