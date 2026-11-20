import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'phase1.py'), encoding='utf-8').read().split('try:')[0])

S = '/authorization/separation-rules'
s, rules = A('admin', 'GET', S)
rule_ = next(r for r in rules if r['objectType'] == 'TRAINING_MATRIX_VERSION' and r['actionCode'] == 'APPROVE' and r['relationCode'] == 'PREPARER')
print('rule:', rule_['workflowLabel'], '/', rule_['actionLabel'], '/ not', rule_['relationLabel'], '/ on =', rule_['enabled'])
vid = q("select id from training_matrix_versions where prepared_by='%s' order by created_at desc limit 1" % admin_id)
admin_name = q("select full_name from app_users where id='%s'" % admin_id)

def names():
    out = []
    page = 1
    while True:
        s, b = A('admin', 'GET', '/training/matrix-versions/%s/eligible-approvers?page=%d&limit=50&search=%s' % (vid, page, admin_name.split()[0]))
        if s != 200:
            return s, b
        out += [x.get('fullName') or x.get('name') for x in (b.get('data') or b.get('items') or [])]
        if page >= (b.get('pagination') or {}).get('totalPages', 1):
            break
        page += 1
    return 200, out

try:
    st0 = rule_['enabled']
    s, n = names()
    print('list with rule as found (on=%s):' % st0, s, n if s == 200 else str(n)[:150])
    if s == 200:
        expect('rule ON: the preparer (admin) is NOT offered as approver', admin_name not in n, n)
        A('admin', 'PUT', S + '/' + rule_['id'], {'enabled': False, 'reason': 'phase 2 training test off', 'signatureToken': sign('admin')})
        s, n2 = names()
        expect('rule OFF: the list follows the switch (admin offered again, if otherwise eligible)', s == 200 and admin_name in n2, (s, n2))
        A('admin', 'PUT', S + '/' + rule_['id'], {'enabled': True, 'reason': 'phase 2 training test restore', 'signatureToken': sign('admin')})
        s, n3 = names()
        expect('rule back ON: the preparer is kept apart again', s == 200 and admin_name not in n3, (s, n3))
    else:
        expect('eligible-approvers endpoint answers for the version', False, (s, n))
finally:
    s, now = A('admin', 'GET', S)
    cur = next(r for r in now if r['id'] == rule_['id'])
    if cur['enabled'] != rule_['enabled']:
        A('admin', 'PUT', S + '/' + rule_['id'], {'enabled': rule_['enabled'], 'reason': 'phase 2 training test restore', 'signatureToken': sign('admin')})
print('\n%d/%d passed' % (sum(R), len(R)))
