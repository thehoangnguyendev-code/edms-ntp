"""Scenario 1, part d: the Work Suspensions tab of Compliance (the flag raised for the person who failed the test)."""
from flows31 import *
import urllib.parse

drop_shots(['S1-19'])
b = Browser()
QC = '23111111-1111-1111-1111-111111111112'
rows = admin.call('GET', f'/training/compliance/suspensions?limit=50&departmentId={QC}&search=' + urllib.parse.quote(name_of('uat31.s1.fail').split(' (')[0]))
print('suspension rows:', [(r.get('fullName') or r.get('personName'), r.get('status'), r.get('topicText')) for r in rows.get('data', [])][:5])
check('S1-d.1 the person who failed has an open Work Suspension flag', any(r.get('status') == 'OPEN' for r in rows.get('data', [])), rows.get('data', [])[:2])


def pick_qc(pg):
    tab('Work Suspensions')(pg)
    pg.wait_for_timeout(1500)
    pg.get_by_text('My department').first.click()
    pg.wait_for_timeout(600)
    pg.get_by_text('Quality Control', exact=True).last.click()
    pg.wait_for_timeout(2500)


b.shot('admin', '/training-management/compliance', 'S1-19', 'Compliance_Work_Suspensions_tab', 'Compliance, tab Work Suspensions (phòng Quality Control): cờ tạm ngừng việc của người trượt bài kiểm tra (SOP 5.3.7)', action=pick_qc)
finish('p1d', b)
