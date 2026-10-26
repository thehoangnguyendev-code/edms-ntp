"""DEV: the register of approved training vendors (SOP.0025) and its life: Draft, approved by another person (Active), Inactive, Active again. Checks: a draft needs a name and a validity that has not
passed; the same name twice is refused; the writer cannot approve (segregation); the approval needs a signature; the actions of a row are given by the server; an external training of an Active unit
has no warning and one of an unknown or inactive unit has one (it is not blocked); a vendor cannot be deactivated twice nor activated when it is not inactive; the approved name is not changed; the filters of
status, dates and approvers are applied by the server; no permission, no register. The password comes from DEVPW."""
import os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from api import Client
from e2e21_matrix import check, sign, admin, qa, attempt, results

STAMP = str(int(time.time()))
name = 'E2E-TEST Training Unit ' + STAMP
code, data, raw = attempt(admin, 'POST', '/training/vendors', {'name': ' ', 'reference': 'x'})
check('1 a vendor needs a name (400)', code == 400, (code, raw))
code, data, raw = attempt(admin, 'POST', '/training/vendors', {'name': name, 'validUntil': '2020-01-01'})
check('2 a validity in the past is refused (400)', code == 400, (code, raw))
code, data, raw = attempt(admin, 'POST', '/training/vendors', {'name': name, 'reference': 'SUP-' + STAMP, 'validUntil': '2099-12-31'})
check('3 a vendor is written as a draft', code == 200 and data.get('status') == 'DRAFT' and data['actions']['edit'] and not data['actions']['approve'], raw)
vid = data.get('id')
code, data, raw = attempt(admin, 'POST', '/training/vendors', {'name': name.upper()})
check('4 the same name twice, in any case, is refused (409)', code == 409, (code, raw))
code, data, raw = attempt(admin, 'PUT', f'/training/vendors/{vid}', {'name': name, 'reference': 'SUP-' + STAMP + '-B', 'validUntil': '2099-12-31'})
check('5 a draft can be changed', code == 200 and data.get('reference') == 'SUP-' + STAMP + '-B', raw)
code, data, raw = attempt(admin, 'POST', f'/training/vendors/{vid}/approve', {'signatureToken': sign(admin)})
check('6 the writer cannot approve (segregation of duties)', code >= 400 and 'SEGREGATION' in raw, (code, raw))
code, data, raw = attempt(qa, 'POST', f'/training/vendors/{vid}/approve', {})
check('7 an approval without a signature is refused (400)', code == 400, (code, raw))
mine = admin.call('GET', f'/training/vendors/{vid}')
check('8 the writer has no approve action, another person has it (the server says so)', mine['actions']['approve'] is False and qa.call('GET', f'/training/vendors/{vid}')['actions']['approve'] is True, mine['actions'])


def external(unit):
    made = admin.call('POST', '/training/activities', {'kind': 'EXTERNAL', 'kindReason': 'OTHER', 'externalType': 'ACTIVE', 'trainingTitle': 'E2E-TEST vendor ' + unit[-6:], 'trainingUnitName': unit})
    return admin.call('GET', f"/training/activities/{made['id']}")


a = external(name)
check('9 a draft is not an approved vendor: the warning is there', a.get('vendorWarning') == 'VENDOR_NOT_APPROVED', a.get('vendorWarning'))
code, data, raw = attempt(qa, 'POST', f'/training/vendors/{vid}/approve', {'signatureToken': sign(qa)})
check('10 another person approves it with a signature: Active', code == 200 and data.get('status') == 'ACTIVE' and data.get('approvedByName'), raw)
a = external(name)
check('11 an external training of an Active unit has no warning', a.get('vendorWarning') is None, a.get('vendorWarning'))
b = external('E2E-TEST Unknown Unit ' + STAMP)
check('12 an unknown unit gets a warning and the training exists (no block)', b.get('vendorWarning') == 'VENDOR_NOT_APPROVED', b.get('vendorWarning'))
code, data, raw = attempt(admin, 'PUT', f'/training/vendors/{vid}', {'name': name + ' changed'})
check('13 an approved vendor is not changed (409)', code == 409, (code, raw))
code, data, raw = attempt(admin, 'POST', f'/training/vendors/{vid}/activate', {'reason': 'x', 'signatureToken': sign(admin)})
check('14 an active vendor is not activated (409)', code == 409, (code, raw))
code, data, raw = attempt(admin, 'POST', f'/training/vendors/{vid}/deactivate', {'signatureToken': sign(admin)})
check('15 a deactivation needs a reason (400)', code == 400, (code, raw))
code, data, raw = attempt(admin, 'POST', f'/training/vendors/{vid}/deactivate', {'reason': 'E2E-TEST approval withdrawn', 'signatureToken': sign(admin)})
check('16 a vendor is deactivated with a reason and a signature', code == 200 and data.get('status') == 'INACTIVE' and data['actions']['activate'] and not data['actions']['deactivate'], raw)
check('17 the warning is back', admin.call('GET', f"/training/activities/{a['id']}").get('vendorWarning') == 'VENDOR_NOT_APPROVED', '')
code, data, raw = attempt(admin, 'POST', f'/training/vendors/{vid}/deactivate', {'reason': 'again', 'signatureToken': sign(admin)})
check('18 an inactive vendor is not deactivated again (409)', code == 409, (code, raw))
page = admin.call('GET', f'/training/vendors?search={STAMP}&status=INACTIVE')
check('19 the status filter is applied by the server', page['pagination']['total'] == 1 and page['data'][0]['statusLabel'] == 'Inactive', page['data'])
code, data, raw = attempt(admin, 'POST', f'/training/vendors/{vid}/activate', {'reason': 'E2E-TEST approved again', 'signatureToken': sign(admin), 'validUntil': '2098-01-01'})
check('20 an inactive vendor is activated again with a reason and a signature', code == 200 and data.get('status') == 'ACTIVE' and data.get('validUntil') == '2098-01-01', raw)
check('21 the warning is gone again', admin.call('GET', f"/training/activities/{a['id']}").get('vendorWarning') is None, '')
page = admin.call('GET', f'/training/vendors?search={STAMP}&approvedFrom=2099-01-01')
check('22 the date filter is applied by the server', page['pagination']['total'] == 0, page['data'])
page = admin.call('GET', f'/training/vendors?search={STAMP}&validFrom=2098-01-01&validTo=2098-01-01')
check('23 the valid-until range is applied by the server', page['pagination']['total'] == 1, page['data'])
page = admin.call('GET', f'/training/vendors?search={STAMP}&status=DRAFT')
check('24 the draft filter does not list an approved vendor', page['pagination']['total'] == 0, page['data'])
who = admin.call('GET', '/training/vendors/approvers')
check('25 the people who approved are offered as a filter', any(w['value'] for w in who), who[:3])
code, data, raw = attempt(Client('trainee.test1'), 'GET', '/training/vendors')
check('26 a person without the permission does not see the register', code in (401, 403), (code, raw))
print(sum(1 for r in results if r[1]), 'of', len(results), 'checks passed')
