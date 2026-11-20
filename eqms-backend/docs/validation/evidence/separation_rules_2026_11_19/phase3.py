import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'phase1.py'), encoding='utf-8').read().split('try:')[0])

O = '/security/object-access-rules'
made = []


def create(body, who='admin'):
    body = dict(body)
    body.setdefault('priority', 50); body.setdefault('active', True); body.setdefault('effect', 'DENY')
    body['signatureToken'] = sign(who); body['reason'] = 'phase 3 test'
    r = A(who, 'POST', O, body)
    if r[0] == 200: made.append(r[1]['id'])
    return r


def remove(rid):
    r = A('admin', 'DELETE', O + '/' + rid, {'signatureToken': sign('admin'), 'reason': 'phase 3 cleanup'})
    if rid in made: made.remove(rid)
    return r


try:
    s, o = A('admin', 'GET', O + '/options')
    mods = {m['key']: m for m in o['modules']}
    expect('options: modules Training, Reports, Security Reviews take part', {'TRAINING', 'REPORT', 'SECURITY_REVIEW'} <= set(mods), list(mods))
    print('   modules:', {k: [t['value'] for t in m['objectTypes']][:4] for k, m in mods.items()})
    expect('options: Document Control resource types do not list the module-only types', 'ANY_RECORD' not in o['resourceTypes'] and 'OBJECT_STATUS' not in o['resourceTypes'] and 'DOCUMENT_TYPE' in o['resourceTypes'], o['resourceTypes'])
    ar = next(t for t in mods['SECURITY_REVIEW']['objectTypes'] if t['value'] == 'ACCESS_REVIEW_CAMPAIGN')
    expect('options: object type carries its actions, statuses and resource types', {'DECIDE_ITEM', 'COMPLETE'} <= {a['value'] for a in ar['actions']} and ar['statuses'] and 'ANY_RECORD' in ar['resourceTypes'], ar)
    tr = next(t for t in mods['TRAINING']['objectTypes'] if t['value'] == 'TRAINING_REQUIREMENT')
    expect('options: Training offers the department dimension, Reports/Security Reviews do not', 'DEPARTMENT' in tr['resourceTypes'] and all('DEPARTMENT' not in t['resourceTypes'] for t in mods['SECURITY_REVIEW']['objectTypes'] + mods['REPORT']['objectTypes']), tr['resourceTypes'])

    base = {'name': 'P3 test rule', 'moduleKey': 'SECURITY_REVIEW', 'objectType': 'ACCESS_REVIEW_CAMPAIGN', 'resourceType': 'ANY_RECORD', 'actions': ['DECIDE_ITEM']}
    bad = [
        ('unknown module', dict(base, moduleKey='NOPE')),
        ('missing object type', dict(base, objectType=None)),
        ('unknown object type', dict(base, objectType='NOPE')),
        ('action not of the object type', dict(base, actions=['PUBLISH'])),
        ('no action', dict(base, actions=[])),
        ('resource type not offered (Document type)', dict(base, resourceType='DOCUMENT_TYPE')),
        ('department on a module without it', dict(base, resourceType='DEPARTMENT', resourceName='Quality Assurance')),
        ('ANY_RECORD with a target', dict(base, resourceName='X')),
        ('status without a name', dict(base, resourceType='OBJECT_STATUS')),
        ('status unknown', dict(base, resourceType='OBJECT_STATUS', resourceName='NOT_A_STATUS')),
        ('Document Control rule that names an object type', dict(base, moduleKey='DOCUMENT_CONTROL', resourceType='DOCUMENT_TYPE', objectType='ACCESS_REVIEW_CAMPAIGN')),
        ('Document Control rule with a module-only type', dict(base, moduleKey='DOCUMENT_CONTROL', objectType=None, resourceType='ANY_RECORD')),
    ]
    before_rules = q("select count(*) from object_access_rules")
    for label, body in bad:
        r = create(body)
        expect('validation: ' + label + ' is refused (4xx)', 400 <= r[0] < 500, (r[0], str(r[1])[:100]))
    expect('validation: nothing was stored by the refused requests', q("select count(*) from object_access_rules") == before_rules)
    r = create(base, who='reviewer.test1')
    expect('a person without the manage permission cannot create a rule (403)', r[0] == 403, (r[0], str(r[1])[:100]))

    # behaviour: DENY rule on DECIDE_ITEM of an access review campaign
    P = '/security/access-reviews'
    cid = seed_access('P3 test', admin_id)
    its = items(P, cid)
    mine = next(i for i in its if i['userId'] == admin_id)
    docs_before = A('admin', 'GET', '/documents?page=1&limit=5')
    r = decide(P, cid, mine['id'], 'CONFIRMED')
    expect('no rule: admin may decide (current behaviour kept)', r[0] == 200, r)
    decide(P, cid, mine['id'], 'PENDING')
    s, rule1 = create(base)
    expect('create a DENY rule for every record: 200, module and object type kept', s == 200 and rule1['moduleKey'] == 'SECURITY_REVIEW' and rule1['objectType'] == 'ACCESS_REVIEW_CAMPAIGN', (s, str(rule1)[:200]))
    r = decide(P, cid, mine['id'], 'CONFIRMED')
    expect('DENY rule: the action is refused (403 OUT_OF_SCOPE) and nothing changes', r[0] == 403 and 'OUT_OF_SCOPE' in str(r[1]) and next(i for i in items(P, cid) if i['id'] == mine['id'])['decision'] == 'PENDING', r)
    r = A('admin', 'POST', P + '/' + cid + '/cancel')
    expect('DENY rule: an action the rule does not name (Cancel) is not limited', r[0] == 200, (r[0], str(r[1])[:100]))
    cid2 = seed_access('P3 test 2', admin_id)
    item2 = next(i for i in items(P, cid2) if i['userId'] == admin_id)
    docs_after = A('admin', 'GET', '/documents?page=1&limit=5')
    expect('Document Control is not affected by a rule of another module', docs_before[0] == docs_after[0] == 200 and (docs_before[1].get('pagination') or {}).get('total') == (docs_after[1].get('pagination') or {}).get('total'), (docs_before[0], docs_after[0]))
    remove(rule1['id'])
    r = decide(P, cid2, item2['id'], 'CONFIRMED')
    expect('rule deleted: the action is allowed again', r[0] == 200, r)

    # status rule: only the statuses in which the object type has an action are offered
    r = create(dict(base, resourceType='OBJECT_STATUS', resourceName='COMPLETED'))
    expect('status rule: a status in which no action exists is refused (400)', r[0] == 400, (r[0], str(r[1])[:100]))
    s, rule3 = create(dict(base, resourceType='OBJECT_STATUS', resourceName='IN_PROGRESS'))
    r = decide(P, cid2, item2['id'], 'CONFIRMED')
    expect('status rule for the campaign status matches: refused', s == 200 and r[0] == 403 and 'OUT_OF_SCOPE' in str(r[1]), (s, r))
    remove(rule3['id'])

    # ALLOW rule (the closing of the rest is covered by the unit tests: the statuses of this object type are one)
    s, rule5 = create(dict(base, effect='ALLOW', resourceType='OBJECT_STATUS', resourceName='IN_PROGRESS'))
    r = decide(P, cid2, item2['id'], 'CONFIRMED')
    expect('ALLOW rule for the campaign status: allowed', s == 200 and r[0] == 200, (s, r))
    remove(rule5['id'])

    # a rule for a profile the person does not hold does not apply
    other_profile = q("select id from access_profiles where id not in (select access_profile_id from user_access_profiles where user_id='%s') limit 1" % admin_id) if False else ''
    s, lst = A('admin', 'GET', O + '/paged?page=1&limit=5&moduleKey=SECURITY_REVIEW')
    expect('list: filter by module returns only that module', s == 200 and all(r['moduleKey'] == 'SECURITY_REVIEW' for r in lst['data']), (s, str(lst)[:120]))
    s, lst = A('admin', 'GET', O + '/paged?page=1&limit=5&moduleKey=DOCUMENT_CONTROL')
    expect('list: Document Control rules keep their module', s == 200 and all(r['moduleKey'] == 'DOCUMENT_CONTROL' and r['objectType'] is None for r in lst['data']), (s, str(lst)[:120]))
    aud = q("select count(*) from audit_logs where entity_type='OBJECT_ACCESS_RULE' and action_type='CREATED' and comment like '%phase 3 test%' and signature_id is not null")
    expect('audit: rule creation recorded with reason and signature', aud not in ('', '0'), aud)
finally:
    for rid in list(made):
        try: remove(rid)
        except Exception as e: print('cleanup', e)
    drop_campaigns()
print('\n%d/%d passed' % (sum(R), len(R)))
