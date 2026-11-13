"""DEV only: create a test Access Profile through the wizard end to end (with e-signature). Usage: DEVPW=... python dcv_wizard_create.py"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import dcv_lib
dcv_lib.ROLES['SEC'] = 'dcv.secadmin'
from dcv_lib import *
NAME = 'DCV-TEST wizard only profile'
b = Browser(); pg = b.page('SEC'); pg.set_default_timeout(20000)
pg.goto(BASE + '/security/access-profiles/wizard', wait_until='domcontentloaded'); pg.wait_for_timeout(4000)
pg.get_by_placeholder('e.g. Document Reviewer').fill(NAME)
pg.get_by_role('button', name='Next').click(); pg.wait_for_timeout(2500)
pg.locator('label:has(input[id^=wizard-ps-])').first.click(); pg.wait_for_timeout(500)
for _ in range(4):
    pg.get_by_role('button', name='Next').click(); pg.wait_for_timeout(1500)
b.shot('SEC', None, 'WC', 'review', 'wizard review step')
pg.get_by_role('button', name='Create Access Profile').click(); pg.wait_for_timeout(2500)
b.shot('SEC', None, 'WC', 'esign', 'e-signature dialog')
pg.get_by_placeholder('Enter your reason').fill('DEV test: wizard-only creation check')
pg.get_by_placeholder('Enter your username').fill('dcv.secadmin')
pg.get_by_placeholder('Enter your password').fill(PW)
pg.get_by_role('button', name='Sign & Confirm').click()
pg.wait_for_timeout(5000)
print('URL', pg.url)
b.shot('SEC', None, 'WC', 'created', 'after creation')
b.close()
