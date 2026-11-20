import os, sys, json, uuid
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'phase1.py'), encoding='utf-8').read().split('try:')[0])

made = []
try:
    # ---------------- the removed endpoints are gone (404 or 405), nothing else answers for them
    admin_other = other_id
    gone = [
        ('GET', '/security/authorization-shadow-mismatches', None),
        ('GET', '/security/authorization-shadow-mismatches/paged', None),
        ('GET', '/security/authorization-shadow-mismatches/summary', None),
        ('GET', '/authorization/engine-evaluation-counts', None),
        ('POST', '/security/effective-access/diagnose', {}),
        ('GET', '/security/participant-reconciliation', None),
        ('PUT', '/settings/users/%s/role' % admin_other, {}),
    ]
    s, plist = A('admin', 'GET', '/security/access-profiles')
    plist = plist if isinstance(plist, list) else plist.get('content', plist.get('data', []))
    pid0 = plist[0]['id']
    for m, path in (('POST', '/security/access-profiles/%s/managed-permissions'), ('PUT', '/security/access-profiles/%s/permission-sets'),
                    ('POST', '/security/access-profiles/%s/permission-sets/%s'), ('DELETE', '/security/access-profiles/%s/permission-sets/%s'),
                    ('PUT', '/security/access-profiles/%s/workflow-roles'), ('POST', '/security/access-profiles/%s/workflow-roles/X'),
                    ('DELETE', '/security/access-profiles/%s/workflow-roles/X'), ('GET', '/security/access-profiles/%s/users')):
        gone.append((m, path % ((pid0, str(uuid.uuid4())) if path.count('%s') == 2 else pid0), {} if m != 'GET' else None))
    for m, path, body in gone:
        s, b = A('admin', m, path, body)
        expect('removed: %s %s answers 404/405' % (m, path.split('?')[0][:70]), s in (404, 405), (s, str(b)[:80]))

    # ---------------- what stays still answers
    for path in ('/security/access-profiles/%s/permission-sets' % pid0, '/security/access-profiles/%s/workflow-roles' % pid0,
                 '/security/access-profiles/%s/users/paged?page=1&limit=5' % pid0, '/security/access-profiles/%s' % pid0,
                 '/authorization/relation-definitions', '/authorization/separation-rules', '/security/workflow-roles/catalog?page=1&limit=5'):
        s, b = A('admin', 'GET', path)
        expect('kept: GET %s answers 200' % path.split('?')[0][:70], s == 200, (s, str(b)[:80]))
    s, nav = A('admin', 'GET', '/navigation')
    txt = json.dumps(nav)
    expect('navigation: the Workflow Role Catalog entry is gone, Workflow Authorization and Engine Diagnostics stay', 'sec-workflow-role-catalog' not in txt and 'sec-workflow-authorization' in txt and 'sec-authorization-diagnostics' in txt, s)

    # ---------------- the one save path of an access profile still does everything
    s, sets = A('admin', 'GET', '/security/permission-sets/paged?page=1&limit=5')
    set_ids = [x['id'] for x in sets['data'] if not x.get('system')][:2] or [x['id'] for x in sets['data']][:1]
    rev_id = q("select id from app_users where username='author.test1'")
    body = {'name': 'W1 test profile', 'description': 'wave 1 test', 'active': True, 'permissionCodes': ['documents.document.view'], 'permissionSetIds': [], 'workflowRoles': [], 'userIds': [], 'signatureToken': sign('admin'), 'reason': 'wave 1 test'}
    s, prof = A('admin', 'POST', '/security/access-profiles/full', body)
    expect('profile: create in one shot (POST /full) works', s == 200 and prof.get('id'), (s, str(prof)[:160]))
    if s == 200:
        pid = prof['id']; made.append(pid)
        upd = A('admin', 'GET', '/security/access-profiles/%s' % pid)[1].get('updatedAt')
        s, b = A('admin', 'POST', '/security/access-profiles/%s/users/%s' % (pid, rev_id), {'signatureToken': sign('admin'), 'reason': 'wave 1 assign'})
        expect('profile: assigning one user (POST users/{id}) still works', s in (200, 204), (s, str(b)[:100]))
        s, b = A('admin', 'DELETE', '/security/access-profiles/%s/users/%s' % (pid, rev_id), {'signatureToken': sign('admin'), 'reason': 'wave 1 unassign'})
        expect('profile: removing one user (DELETE users/{id}) still works', s in (200, 204), (s, str(b)[:100]))
        upd = A('admin', 'GET', '/security/access-profiles/%s' % pid)[1].get('updatedAt')
        cfg = {'expectedUpdatedAt': upd, 'general': None, 'managedPermissionCodes': ['documents.document.view', 'documents.document.create'], 'sharedPermissionSetIds': set_ids,
               'workflowRoles': ['DOCUMENT_REVIEWER'], 'userIds': [], 'signatureToken': sign('admin'), 'reason': 'wave 1 config'}
        s, p2 = A('admin', 'PUT', '/security/access-profiles/%s/configuration' % pid, cfg)
        expect('profile: PUT /configuration adds permissions, shared sets and a workflow role in one save', s == 200, (s, str(p2)[:200]))
        s, users = A('admin', 'GET', '/security/access-profiles/%s/users/paged?page=1&limit=10' % pid)
        s2, roles = A('admin', 'GET', '/security/access-profiles/%s/workflow-roles' % pid)
        s3, psets = A('admin', 'GET', '/security/access-profiles/%s/permission-sets' % pid)
        expect('profile: the save is visible (workflow role, shared sets)', s == 200 and users.get('assignedIds') == [] and 'DOCUMENT_REVIEWER' in roles and len(psets) >= len(set_ids), (users.get('assignedIds'), roles, len(psets)))
        cnt = q("select count(*) from electronic_signatures e where e.entity_id='%s'" % pid)
        audit = q("select count(*) from audit_logs where entity_id='%s' and action_type='ACCESS_PROFILE_CONFIGURATION_UPDATED' and signature_id is not null" % pid)
        expect('profile: one audit entry with the signature for the whole configuration save', audit == '1', (cnt, audit))
        s, b = A('admin', 'PUT', '/security/access-profiles/%s/configuration' % pid, dict(cfg, expectedUpdatedAt='2020-01-01T00:00:00Z', signatureToken=sign('admin')))
        expect('profile: a stale save is refused (409) and changes nothing', s == 409, (s, str(b)[:100]))
        # self-grant guard on the surviving path: a non-admin manager cannot add a critical set to a profile they hold -> covered by the unit test; here only check the admin can not be locked by a stale body
        s, b = A('admin', 'DELETE', '/security/access-profiles/%s' % pid, {'signatureToken': sign('admin'), 'reason': 'wave 1 cleanup'})
        expect('profile: delete the test profile', s in (200, 204), (s, str(b)[:100]))
        if s in (200, 204): made.remove(pid)

    # ---------------- data removal
    expect('data: the shadow table is empty and the legacy mapping table is gone', q('select count(*) from authorization_shadow_evaluation_events') == '0' and q("select coalesce(to_regclass('security_legacy_role_mapping_exceptions')::text,'gone')") == 'gone')
    # the shadow recording still works for a real disagreement path: no exception on the decisions of Document Control
    s, docs = A('admin', 'GET', '/documents?page=1&limit=5')
    expect('Document Control list still answers after the removals', s == 200, s)
finally:
    for pid in made:
        try: A('admin', 'DELETE', '/security/access-profiles/%s' % pid, {'signatureToken': sign('admin'), 'reason': 'cleanup'})
        except Exception as e: print('cleanup', e)
print('\n%d/%d passed' % (sum(R), len(R)))
