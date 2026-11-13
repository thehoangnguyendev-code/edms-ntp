"""DEV only: create one Access Profile per flow role through the New Access Profile wizard (custom permissions), assign to a test account, screenshot each step.
Usage: DEVPW=... python dcv_role_profiles.py [Author|Co-Author|Reviewer|Approver ...]"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import dcv_lib
dcv_lib.ROLES['SEC'] = 'dcv.secadmin'
from dcv_lib import *
BASE_PERMS = ['dashboard.module.view', 'documents.module.view', 'documents.document.view', 'documents.revision.preview', 'notifications.module.view']
PROFILES = {
    'Author': dict(user='DCV Contributor 1', perms=BASE_PERMS + ['documents.revision.upload_source', 'documents.revision.submit_review', 'documents.revision.edit_onlyoffice'],
                   desc='DCV-TEST: person named Author of a document; uploads the revision file and submits it for review.'),
    'Co-Author': dict(user='DCV Contributor 2', perms=BASE_PERMS + ['documents.revision.edit_onlyoffice'],
                      desc='DCV-TEST: person named Co-Author of a document; edits the revision together with the Author.'),
    'Reviewer': dict(user='DCV Contributor 3', perms=BASE_PERMS + ['documents.revision.review', 'documents.revision.reject_review'],
                     desc='DCV-TEST: person named Reviewer of a document revision.'),
    'Approver': dict(user='DCV Copy Approver', perms=BASE_PERMS + ['documents.revision.approve', 'documents.revision.reject_approval'],
                     desc='DCV-TEST: person named Approver of a document revision.'),
}
want = sys.argv[1:] or list(PROFILES)
b = Browser(); pg = b.page('SEC'); pg.set_default_timeout(20000)
for role in want:
    P = PROFILES[role]; name = f'DCV-TEST {role} profile'
    tag = 'RP-' + role.replace('-', '')
    pg.goto(BASE + '/security/access-profiles/wizard', wait_until='domcontentloaded'); pg.wait_for_timeout(3500)
    pg.get_by_placeholder('e.g. Document Reviewer').fill(name)
    pg.locator('textarea').first.fill(P['desc'])
    b.shot('SEC', None, tag, '1-basic', f'{role}: step 1 Basic Info')
    pg.get_by_role('button', name='Next').click(); pg.wait_for_timeout(2000)
    pg.get_by_text('Pick individual permissions').click(); pg.wait_for_timeout(2500)
    search = pg.get_by_placeholder('Search permissions by name')
    for code in P['perms']:
        search.fill(code); pg.wait_for_timeout(900)
        row = pg.locator('div.group', has=pg.get_by_text(code, exact=True)).first
        if row.count() == 0:
            print('  MISSING permission', code); continue
        row.locator('label').first.click(); pg.wait_for_timeout(300)
    search.fill(''); pg.wait_for_timeout(800)
    b.shot('SEC', None, tag, '2-permissions', f'{role}: step 2 Permissions')
    for _ in range(2):
        pg.get_by_role('button', name='Next').click(); pg.wait_for_timeout(1500)   # workflow roles, scope: left empty
    pg.get_by_role('button', name='Next').click(); pg.wait_for_timeout(2500)           # users
    pg.get_by_placeholder('Search users').fill(P['user']); pg.wait_for_timeout(2500)
    b.shot('SEC', None, tag, '3a-users-search', 'users list after search'); pg.locator('label:has(input[id^=wizard-user-])', has_text=P['user']).first.click(); pg.wait_for_timeout(500)
    b.shot('SEC', None, tag, '3-user', f'{role}: step 5 Users')
    pg.get_by_role('button', name='Next').click(); pg.wait_for_timeout(1500)
    b.shot('SEC', None, tag, '4-review', f'{role}: step 6 Review')
    pg.get_by_role('button', name='Create Access Profile').click(); pg.wait_for_timeout(2500)
    pg.get_by_placeholder('Enter your reason').fill('DEV test: role profile for the Document Control upgrade test')
    pg.get_by_placeholder('Enter your username').fill('dcv.secadmin')
    pg.get_by_placeholder('Enter your password').fill(PW)
    pg.get_by_role('button', name='Sign & Confirm').click(); pg.wait_for_timeout(5000)
    print(role, '->', pg.url)
    b.shot('SEC', None, tag, '5-created', f'{role}: profile created')
b.close()
