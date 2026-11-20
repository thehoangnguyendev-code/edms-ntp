import subprocess, sys, datetime, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from api import *

R = []


def expect(label, ok, detail=''):
    R.append(bool(ok))
    print(('PASS ' if ok else 'FAIL ') + label + ('' if ok else '  -> ' + str(detail)[:240]))


def q(sql):
    return subprocess.run(['docker', 'exec', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-Atc', sql], capture_output=True, text=True).stdout.strip()


REL = {('ACCESS_REVIEW_CAMPAIGN', 'DECIDE_ITEM'): 'ITEM_SUBJECT', ('AUDIT_REVIEW_CAMPAIGN', 'DECIDE_ITEM'): 'ENTRY_PERFORMER',
       ('ACCESS_REVIEW_CAMPAIGN', 'COMPLETE'): 'CAMPAIGN_CREATOR', ('AUDIT_REVIEW_CAMPAIGN', 'COMPLETE'): 'CAMPAIGN_CREATOR'}


def ids(obj, action):
    code = REL[(obj, action)]
    row = q("select p.id||'|'||d.id from workflow_action_policies p join authorization_relation_definitions d on d.resource_type=p.object_type "
            "where p.module_key='SECURITY_REVIEW' and p.object_type='%s' and p.action_code='%s' and d.code='%s'" % (obj, action, code))
    return row.split('|')


def rule(u, obj, action, on):
    pid, did = ids(obj, action)
    s, b = A(u, 'PUT', '/authorization/workflow-policies/%s/forbidden-relations' % pid,
             {'relationDefinitionIds': [did] if on else [], 'signatureToken': sign(u), 'reason': 'phase 1 test'})
    assert s == 200, (s, b)


def me_id(u):
    s, b = call('GET', '/auth/me', None, login(u))
    assert s == 200, (s, b)
    return b.get('id') or b.get('user', {}).get('id')


def items(path, cid):
    out, page = [], 1
    while True:
        s, b = A('admin', 'GET', '%s/%s/items/paged?page=%d&limit=50' % (path, cid, page))
        assert s == 200, (s, b)
        out += b['data']
        if page >= b['pagination']['totalPages']:
            break
        page += 1
    return out


def decide(path, cid, iid, decision, who='admin', note='t'):
    return A(who, 'PUT', '%s/%s/items/%s' % (path, cid, iid), {'decision': decision, 'note': note})


def bulk(path, cid):
    for it in items(path, cid):
        if it['decision'] == 'PENDING':
            decide(path, cid, it['id'], 'CONFIRMED', note='bulk')


def sod(r):
    return r[0] == 403 and 'SEPARATION_OF_DUTIES' in str(r[1])


today = str(datetime.date.today())
import uuid


def seed_access(name, creator_id):
    cid = str(uuid.uuid4())
    sql = "insert into access_review_campaigns(id,name,description,review_period_start,review_period_end,status,reviewer_id,created_by) values ('%s','%s','phase 1 test','%s','%s','IN_PROGRESS','%s','%s');" % (cid, name, today, today, creator_id, creator_id)
    for uid, uname in ((admin_id, 'admin'), (other_id, 'user.a.test'), (rev_id, 'reviewer.test1')):
        sql += "insert into access_review_items(id,campaign_id,user_id,username,permission_count,is_super_admin,decision) values (gen_random_uuid(),'%s','%s','%s',0,false,'PENDING');" % (cid, uid, uname)
    q(sql)
    return cid


def seed_audit(name, creator_id):
    cid = str(uuid.uuid4())
    a = q("select id from audit_logs where user_id='%s' limit 1" % admin_id)
    b = q("select id from audit_logs where user_id is not null and user_id<>'%s' limit 1" % admin_id)
    sql = "insert into audit_trail_review_campaigns(id,name,description,review_period_start,review_period_end,status,reviewer_id,created_by) values ('%s','%s','phase 1 test','%s','%s','IN_PROGRESS','%s','%s');" % (cid, name, today, today, creator_id, creator_id)
    for lid in (a, b):
        sql += "insert into audit_trail_review_items(id,campaign_id,audit_log_id,decision) values (gen_random_uuid(),'%s','%s','PENDING');" % (cid, lid)
    q(sql)
    return cid


def drop_campaigns():
    q("delete from access_review_campaigns where description='phase 1 test'; delete from audit_trail_review_campaigns where description='phase 1 test'")
admin_id = me_id('admin')
other = 'user.a.test'
other_id = me_id(other)
rev_id = q("select id from app_users where username='reviewer.test1'")

try:
    # ===================== ACCESS REVIEW =====================
    P = '/security/access-reviews'
    rule('admin', 'ACCESS_REVIEW_CAMPAIGN', 'DECIDE_ITEM', False)
    rule('admin', 'ACCESS_REVIEW_CAMPAIGN', 'COMPLETE', False)
    cid = seed_access('P1 test A', admin_id)
    its = items(P, cid)
    mine = next(i for i in its if i['userId'] == admin_id)
    theirs = next(i for i in its if i['userId'] == other_id)
    r = decide(P, cid, mine['id'], 'CONFIRMED', note='own')
    expect('AR rule OFF: admin may decide the item about their own account (current behaviour kept)', r[0] == 200, r)
    decide(P, cid, mine['id'], 'PENDING')
    rule('admin', 'ACCESS_REVIEW_CAMPAIGN', 'DECIDE_ITEM', True)
    r = decide(P, cid, mine['id'], 'CONFIRMED', note='own')
    expect('AR rule ON: admin refused on own item (403 SEPARATION_OF_DUTIES)', sod(r), r)
    chk = next(i for i in items(P, cid) if i['id'] == mine['id'])
    expect('AR rule ON: the refused decision changed nothing', chk['decision'] == 'PENDING', chk['decision'])
    r = decide(P, cid, theirs['id'], 'CONFIRMED', note='other')
    expect('AR rule ON: admin may decide the item about ANOTHER person', r[0] == 200, r)
    r = decide(P, cid, theirs['id'], 'CONFIRMED', who=other, note='own')
    expect('AR rule ON: the other manager is refused on THEIR own item', sod(r), r)
    r = decide(P, cid, mine['id'], 'CONFIRMED', who=other, note='about admin')
    expect('AR rule ON: the other manager may decide the item about admin', r[0] == 200, r)
    rule('admin', 'ACCESS_REVIEW_CAMPAIGN', 'DECIDE_ITEM', False)
    r = decide(P, cid, mine['id'], 'CONFIRMED', note='own again')
    expect('AR rule switched OFF again: admin may decide own item again', r[0] == 200, r)
    bulk(P, cid)
    rule('admin', 'ACCESS_REVIEW_CAMPAIGN', 'COMPLETE', True)
    r = A('admin', 'POST', '%s/%s/complete' % (P, cid), {'signatureToken': sign('admin'), 'reason': 'try'})
    expect('AR complete rule ON: the creator is refused', sod(r), r)
    chk = A('admin', 'GET', '%s/%s' % (P, cid))[1]
    expect('AR complete rule ON: campaign still In Progress after the refusal', chk['campaign']['status'] == 'IN_PROGRESS', chk['campaign']['status'])
    r = A(other, 'POST', '%s/%s/complete' % (P, cid), {'signatureToken': sign(other), 'reason': 'second person completes'})
    expect('AR complete rule ON: a different manager completes it', r[0] == 200 and r[1]['campaign']['status'] == 'COMPLETED', str(r)[:200])
    rule('admin', 'ACCESS_REVIEW_CAMPAIGN', 'COMPLETE', False)
    c2 = {'id': seed_access('P1 test A2', admin_id)}
    bulk(P, c2['id'])
    r = A('admin', 'POST', '%s/%s/complete' % (P, c2['id']), {'signatureToken': sign('admin'), 'reason': 'rule off'})
    expect('AR complete rule OFF: the creator completes (current behaviour kept)', r[0] == 200 and r[1]['campaign']['status'] == 'COMPLETED', str(r)[:200])

    # ===================== AUDIT TRAIL REVIEW =====================
    Q = '/audit-trail/reviews'
    rule('admin', 'AUDIT_REVIEW_CAMPAIGN', 'DECIDE_ITEM', False)
    rule('admin', 'AUDIT_REVIEW_CAMPAIGN', 'COMPLETE', False)
    cid = seed_audit('P1 test B', admin_id)
    its = items(Q, cid)
    perf = {i['id']: q("select l.user_id from audit_trail_review_items i join audit_logs l on l.id=i.audit_log_id where i.id='%s'" % i['id']) for i in its[:80]}
    mine = next((i for i in its if perf.get(i['id']) == admin_id), None)
    notmine = next((i for i in its if i['id'] in perf and perf[i['id']] != admin_id), None)
    expect('AT campaign holds an entry made by admin and one made by someone else (test data)', mine is not None and notmine is not None, len(its))
    if mine and notmine:
        r = decide(Q, cid, mine['id'], 'CONFIRMED', note='own')
        expect('AT rule OFF: admin may decide an entry they made (current behaviour kept)', r[0] == 200, r)
        decide(Q, cid, mine['id'], 'PENDING')
        rule('admin', 'AUDIT_REVIEW_CAMPAIGN', 'DECIDE_ITEM', True)
        r = decide(Q, cid, mine['id'], 'CONFIRMED', note='own')
        expect('AT rule ON: admin refused on an entry they made', sod(r), r)
        r = decide(Q, cid, notmine['id'], 'CONFIRMED', note='other')
        expect('AT rule ON: admin may decide an entry made by another person', r[0] == 200, r)
        rule('admin', 'AUDIT_REVIEW_CAMPAIGN', 'DECIDE_ITEM', False)
    A('admin', 'POST', '%s/%s/cancel' % (Q, cid))
    rule('admin', 'AUDIT_REVIEW_CAMPAIGN', 'COMPLETE', True)
    c3 = {'id': seed_audit('P1 test B2', admin_id)}
    bulk(Q, c3['id'])
    r = A('admin', 'POST', '%s/%s/complete' % (Q, c3['id']), {'signatureToken': sign('admin'), 'reason': 'try'})
    expect('AT complete rule ON: the creator is refused', sod(r), r)
    A('admin', 'POST', '%s/%s/cancel' % (Q, c3['id']))
finally:
    drop_campaigns()
    for rt in ('ACCESS_REVIEW_CAMPAIGN', 'AUDIT_REVIEW_CAMPAIGN'):
        for ac in ('DECIDE_ITEM', 'COMPLETE'):
            try:
                rule('admin', rt, ac, False)
            except Exception as e:
                print('cleanup failed', rt, ac, e)
print('\n%d/%d passed' % (sum(R), len(R)))
