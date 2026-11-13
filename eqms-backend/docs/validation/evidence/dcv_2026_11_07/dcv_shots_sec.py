"""DEV only: screenshots of the Security & Authorization screens with the security test account. Usage: DEVPW=... python dcv_shots_sec.py <tag> [path ...]"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import dcv_lib
dcv_lib.ROLES['SEC'] = 'dcv.secadmin'
from dcv_lib import *

tag = sys.argv[1]
PAGES = {
    'wa-matrix': '/security/lifecycle-policies?tab=matrix',
    'wa-transitions': '/security/lifecycle-policies?tab=transitions',
    'wa-capabilities': '/security/lifecycle-policies?tab=capabilities',
    'diag-resolver': '/security/authorization-diagnostics?tab=resolver',
    'diag-simulator': '/security/authorization-diagnostics?tab=simulator',
    'diag-relations': '/security/authorization-diagnostics?tab=relations',
    'diag-health': '/security/authorization-diagnostics?tab=engineHealth',
    'profiles': '/security/access-profiles',
    'permission-sets': '/security/permission-sets',
    'old-resolver-link': '/security/lifecycle-policies/policy-resolver?moduleKey=documents',
}
want = sys.argv[2:] or list(PAGES)
b = Browser()
for k in want:
    b.shot('SEC', PAGES[k], tag, k, f'{tag}: {k}', wait=5000)
b.close()
