import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'phase1.py'), encoding='utf-8').read().split('try:')[0])

S = '/authorization/separation-rules'

try:
    s, rules = A('admin', 'GET', S)
    expect('list: 200 and rules from several modules', s == 200 and len(rules) >= 8 and len({r['moduleKey'] for r in rules}) >= 3, (s, len(rules) if isinstance(rules, list) else rules))
    print('   modules:', sorted({r['moduleLabel'] for r in rules}), 'rules:', len(rules), 'on:', sum(r['enabled'] for r in rules))
    ar = [r for r in rules if r['moduleKey'] == 'SECURITY_REVIEW']
    expect('the 4 new review rules are listed and OFF (decision: new rules start off)', len(ar) == 4 and not any(r['enabled'] for r in ar), [(r['actionCode'], r['relationCode'], r['enabled']) for r in ar])
    expect('rules carry readable labels (no raw codes as labels)', all(r['moduleLabel'] and r['actionLabel'] and r['relationLabel'] for r in rules), [r for r in rules if not (r['moduleLabel'] and r['actionLabel'] and r['relationLabel'])][:1])
    rep = [r for r in rules if r['moduleKey'] == 'REPORT' and r['relationCode'] in ('AUTHOR', 'SUBMITTER')]
    expect('existing Report template rules are listed as ON', len(rep) >= 2 and all(r['enabled'] for r in rep), [(r['actionCode'], r['relationCode'], r['enabled']) for r in rep])

    # server-side filters
    s, f1 = A('admin', 'GET', S + '?moduleKey=SECURITY_REVIEW')
    expect('filter by module', s == 200 and len(f1) == 4 and all(r['moduleKey'] == 'SECURITY_REVIEW' for r in f1), (s, len(f1)))
    s, f2 = A('admin', 'GET', S + '?state=OFF')
    expect('filter by state OFF', s == 200 and all(not r['enabled'] for r in f2) and len(f2) >= 4, (s, len(f2)))
    s, f3 = A('admin', 'GET', S + '?search=creator')
    expect('free-text search', s == 200 and len(f3) >= 2 and all('creator' in (r['relationLabel'] + str(r['description']) + r['actionLabel']).lower() for r in f3), (s, len(f3)))

    target = next(r for r in ar if r['actionCode'] == 'DECIDE_ITEM' and r['workflowKey'] == 'ACCESS_REVIEW_CAMPAIGN')
    # permission / validation negatives
    s, b = A('reviewer.test1', 'GET', S)
    expect('a person without the workflow authorization permission cannot list (403)', s == 403, (s, str(b)[:120]))
    s, b = A('reviewer.test1', 'PUT', S + '/' + target['id'], {'enabled': True, 'reason': 'x', 'signatureToken': sign('reviewer.test1')})
    expect('a person without the manage permission cannot switch a rule (403) and nothing changes', s == 403 and q("select count(*) from workflow_action_policy_relations where policy_id='%s' and forbidden" % target['policyId']) == '0', (s, str(b)[:120]))
    s, b = A('admin', 'PUT', S + '/' + target['id'], {'enabled': True, 'reason': '', 'signatureToken': sign('admin')})
    expect('no reason: refused (4xx) and nothing changes', 400 <= s < 500 and q("select count(*) from workflow_action_policy_relations where policy_id='%s' and forbidden" % target['policyId']) == '0', (s, str(b)[:120]))
    s, b = A('admin', 'PUT', S + '/' + target['id'], {'enabled': True, 'reason': 'test', 'signatureToken': 'not-a-token'})
    expect('invalid signature: refused and nothing changes', s in (401, 403) and q("select count(*) from workflow_action_policy_relations where policy_id='%s' and forbidden" % target['policyId']) == '0', (s, str(b)[:120]))
    s, b = A('admin', 'PUT', S + '/' + target['id'], {'reason': 'test', 'signatureToken': sign('admin')})
    expect('missing "enabled": refused (400)', s == 400, (s, str(b)[:120]))
    s, b = A('admin', 'PUT', S + '/' + str(uuid.uuid4()), {'enabled': True, 'reason': 'test', 'signatureToken': sign('admin')})
    expect('unknown rule id: 404', s == 404, (s, str(b)[:120]))

    # switch ON, behaviour follows, switch OFF
    cid = seed_access('P2 test', admin_id)
    P = '/security/access-reviews'
    mine = next(i for i in items(P, cid) if i['userId'] == admin_id)
    s, b = A('admin', 'PUT', S + '/' + target['id'], {'enabled': True, 'reason': 'phase 2 test on', 'signatureToken': sign('admin')})
    expect('switch ON: 200 and the rule reads ON', s == 200 and b['enabled'] is True, (s, str(b)[:160]))
    r = decide(P, cid, mine['id'], 'CONFIRMED')
    expect('switch ON: the engine now refuses admin on own item (SEPARATION_OF_DUTIES)', sod(r), r)
    audit = q("select count(*) from audit_logs where action_type='WORKFLOW_ACTION_POLICY_RELATIONS_UPDATED' and reason like '%phase 2 test on%'")
    sig = q("select count(*) from audit_logs a where a.action_type='WORKFLOW_ACTION_POLICY_RELATIONS_UPDATED' and a.reason like '%phase 2 test on%' and a.signature_id is not null")
    expect('switch ON: audit entry with reason and electronic signature recorded', audit != '0' and sig != '0', (audit, sig))
    s, b = A('admin', 'PUT', S + '/' + target['id'], {'enabled': True, 'reason': 'again', 'signatureToken': sign('admin')})
    expect('switching ON an ON rule is harmless (200, still one forbidden row)', s == 200 and q("select count(*) from workflow_action_policy_relations where policy_id='%s' and forbidden" % target['policyId']) == '1', (s, str(b)[:120]))
    s, b = A('admin', 'PUT', S + '/' + target['id'], {'enabled': False, 'reason': 'phase 2 test off', 'signatureToken': sign('admin')})
    expect('switch OFF: 200 and the rule reads OFF', s == 200 and b['enabled'] is False, (s, str(b)[:160]))
    r = decide(P, cid, mine['id'], 'CONFIRMED')
    expect('switch OFF: behaviour back to today (admin may decide own item)', r[0] == 200, r)
    expect('switch OFF: no forbidden row left', q("select count(*) from workflow_action_policy_relations where policy_id='%s' and forbidden" % target['policyId']) == '0')

    # two rules of one policy are independent: report template approval has AUTHOR and SUBMITTER
    rt = next(r for r in rules if r['moduleKey'] == 'REPORT' and r['relationCode'] == 'AUTHOR' and r['actionCode'] == 'APPROVE')
    rs = next(r for r in rules if r['policyId'] == rt['policyId'] and r['relationCode'] == 'SUBMITTER')
    s, b = A('admin', 'PUT', S + '/' + rt['id'], {'enabled': False, 'reason': 'phase 2 independence test', 'signatureToken': sign('admin')})
    s2, now = A('admin', 'GET', S)
    st = {r['id']: r['enabled'] for r in now}
    expect('independence: switching AUTHOR off leaves SUBMITTER of the same policy ON', s == 200 and st[rt['id']] is False and st[rs['id']] is True, (st[rt['id']], st[rs['id']]))
    A('admin', 'PUT', S + '/' + rt['id'], {'enabled': True, 'reason': 'phase 2 independence restore', 'signatureToken': sign('admin')})
    s2, now = A('admin', 'GET', S)
    st = {r['id']: r['enabled'] for r in now}
    expect('independence: both back ON as they were', st[rt['id']] is True and st[rs['id']] is True, (st[rt['id']], st[rs['id']]))
finally:
    drop_campaigns()
    for r in ('ACCESS_REVIEW_CAMPAIGN',):
        try: rule('admin', r, 'DECIDE_ITEM', False)
        except Exception as e: print('cleanup', e)
print('\n%d/%d passed' % (sum(R), len(R)))
