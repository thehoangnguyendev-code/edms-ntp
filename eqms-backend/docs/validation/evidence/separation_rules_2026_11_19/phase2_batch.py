import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'phase1.py'), encoding='utf-8').read().split('try:')[0])

S = '/authorization/separation-rules'


def state():
    s, rules = A('admin', 'GET', S)
    return {r['id']: r for r in rules}


def forbidden_rows(policy_id):
    return q("select count(*) from workflow_action_policy_relations where policy_id='%s' and forbidden and active" % policy_id)


def batch(changes, reason='batch test', token=None, who='admin'):
    return A(who, 'PUT', S, {'changes': changes, 'reason': reason, 'signatureToken': token or sign(who)})


try:
    off0 = [{'id': r['id'], 'enabled': False} for r in state().values() if r['moduleKey'] == 'SECURITY_REVIEW' and r['enabled']]
    if off0: batch(off0, 'reset before the test')
    st = state()
    a = next(r for r in st.values() if r['workflowKey'] == 'ACCESS_REVIEW_CAMPAIGN' and r['actionCode'] == 'COMPLETE')
    b = next(r for r in st.values() if r['workflowKey'] == 'AUDIT_REVIEW_CAMPAIGN' and r['actionCode'] == 'COMPLETE')
    c = next(r for r in st.values() if r['workflowKey'] == 'ACCESS_REVIEW_CAMPAIGN' and r['actionCode'] == 'DECIDE_ITEM')
    expect('start: the three review rules are OFF', not (a['enabled'] or b['enabled'] or c['enabled']))
    sigs0 = q("select count(*) from electronic_signatures")
    audits0 = q("select count(*) from audit_logs where action_type='WORKFLOW_ACTION_POLICY_RELATIONS_UPDATED'")

    s, out = batch([{'id': a['id'], 'enabled': True}, {'id': b['id'], 'enabled': True}, {'id': c['id'], 'enabled': True}], 'batch on')
    st = state()
    expect('one save switches three rules in three policies ON (200)', s == 200 and len(out) == 3 and all(st[x['id']]['enabled'] for x in (a, b, c)), (s, str(out)[:150]))
    sigs1 = q("select count(*) from electronic_signatures")
    audits1 = q("select count(*) from audit_logs where action_type='WORKFLOW_ACTION_POLICY_RELATIONS_UPDATED'")
    expect('ONE signature is recorded for the whole save', int(sigs1) - int(sigs0) == 1, (sigs0, sigs1))
    expect('each of the three policies has its own audit entry, all carrying that signature', int(audits1) - int(audits0) == 3 and q("select count(distinct signature_id) from (select signature_id from audit_logs where action_type='WORKFLOW_ACTION_POLICY_RELATIONS_UPDATED' order by event_time desc limit 3) x") == '1', (audits0, audits1))

    # the same token cannot be used again
    tok = sign('admin')
    s1, _ = batch([{'id': c['id'], 'enabled': False}], 'first use', tok)
    s2, b2 = batch([{'id': a['id'], 'enabled': False}], 'second use', tok)
    st = state()
    expect('a signature token cannot be used for a second save (401) and that save changes nothing', s1 == 200 and s2 == 401 and st[a['id']]['enabled'] is True, (s1, s2, st[a['id']]['enabled']))

    # atomic: one unknown id refuses the whole save
    s, b3 = batch([{'id': a['id'], 'enabled': False}, {'id': str(uuid.uuid4()), 'enabled': True}], 'atomic')
    st = state()
    expect('an unknown rule in the save refuses all of it (404) and the other rule is unchanged', s == 404 and st[a['id']]['enabled'] is True, (s, st[a['id']]['enabled']))

    # nothing really changes: allowed, no new audit entry
    n0 = q("select count(*) from audit_logs where action_type='WORKFLOW_ACTION_POLICY_RELATIONS_UPDATED'")
    s, b4 = batch([{'id': a['id'], 'enabled': True}], 'no change')
    n1 = q("select count(*) from audit_logs where action_type='WORKFLOW_ACTION_POLICY_RELATIONS_UPDATED'")
    expect('saving rules that already have that state succeeds and writes no audit entry', s == 200 and n0 == n1, (s, n0, n1))

    # validation / permission
    s, _ = batch([], 'empty')
    expect('no change at all: refused (400)', s == 400, s)
    s, _ = batch([{'id': a['id'], 'enabled': False}], '')
    expect('no reason: refused (400) and nothing changes', s == 400 and state()[a['id']]['enabled'] is True, s)
    s, _ = batch([{'id': a['id'], 'enabled': False}], 'x', 'not-a-token')
    expect('invalid signature: refused and nothing changes', s in (401, 403) and state()[a['id']]['enabled'] is True, s)
    s, _ = batch([{'id': a['id'], 'enabled': False}], 'x', who='reviewer.test1')
    expect('a person without the manage permission cannot save (403)', s == 403 and state()[a['id']]['enabled'] is True, s)

    # behaviour follows the batch
    cid = seed_access('batch test', admin_id)
    P = '/security/access-reviews'
    s, _ = batch([{'id': c['id'], 'enabled': True}], 'decide rule on')
    mine = next(i for i in items(P, cid) if i['userId'] == admin_id)
    r = decide(P, cid, mine['id'], 'CONFIRMED')
    expect('the saved rule is enforced (admin refused on own item)', sod(r), r)
    # one save can also switch rules off, and one policy with two rules changes only what was asked (report template: AUTHOR and SUBMITTER)
    rep = [r for r in state().values() if r['moduleKey'] == 'REPORT' and r['actionCode'] == 'APPROVE' and r['workflowKey'] == 'REPORT_TEMPLATE']
    expect('report template approval has two rules in one policy', len(rep) == 2, len(rep))
    first, second = rep
    s, _ = batch([{'id': first['id'], 'enabled': False}], 'one of two off')
    st = state()
    expect('switching one of two rules of a policy off leaves the other on', s == 200 and st[first['id']]['enabled'] is False and st[second['id']]['enabled'] is True)
    s, _ = batch([{'id': first['id'], 'enabled': True}], 'restore')
    st = state()
    expect('restored', s == 200 and st[first['id']]['enabled'] is True and st[second['id']]['enabled'] is True)
finally:
    s, rules = A('admin', 'GET', S)
    off = [{'id': r['id'], 'enabled': False} for r in rules if r['moduleKey'] == 'SECURITY_REVIEW' and r['enabled']]
    if off:
        batch(off, 'cleanup')
    drop_campaigns()
print('\n%d/%d passed' % (sum(R), len(R)))
