"""Pictures of the Head screens (they were taken before the route guard was fixed and showed "Access Denied"): rules of specific documents, the form, the picker."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dv_lib import *

S = load()
sop = S['sops']
for stale in [f for f in os.listdir(SHOTS) if f.startswith(('S7__head', 'S22__head', 'S24__head', 'S31__'))]:
    os.remove(os.path.join(SHOTS, stale))
c1, ra, _ = make_rule('A sees SOP 1 and 2', 'ALLOW', 10, 'DOCUMENT', ['G1A'], extra={'documentIds': [sop[0]['doc'], sop[1]['doc']]})
c2, rb, _ = make_rule('B sees SOP 3, 4 and 5', 'ALLOW', 10, 'DOCUMENT', ['G1B'], extra={'documentIds': [sop[2]['doc'], sop[3]['doc'], sop[4]['doc']]})
c3, rd, _ = make_rule('B must not see SOP 4', 'DENY', 50, 'DOCUMENT', ['G1B'], extra={'documentIds': [sop[3]['doc']]})
print('rules', c1, c2, c3)
b = Browser()
pg = b.page('HEAD')
pg.set_default_timeout(20000)
b.shot('HEAD', '/security/department-visibility', 'S7', 'head-rules-screen', 'S7: the Department Head lists the rules of Quality Control: group 2 for the Instruction, and (here) the rules of specific documents: A for SOP 1 and 2, B for SOP 3, 4 and 5, and a Deny for SOP 4')
pg.get_by_role('button', name='New Rule').click()
pg.wait_for_timeout(1500)
modal = pg.locator('[role=dialog]').first
modal.get_by_text('Whole Department').first.click()
pg.wait_for_timeout(700)
pg.get_by_text('Specific documents', exact=True).first.click()
pg.wait_for_timeout(1000)
b.shot('HEAD', None, 'S31', 'form-specific-documents', 'S31: the form of a rule with the target "Specific documents"')
try:
    modal.get_by_text('Search a document by number or name').first.click()
    pg.wait_for_timeout(2500)
    b.shot('HEAD', None, 'S31', 'picker-open', 'S31: the picker lists the documents of Quality Control; a search runs on the server')
except Exception as e:
    print('picker shot failed', str(e)[:100])
pg.keyboard.press('Escape')
for r in (ra, rb, rd):
    if r.get('id'):
        drop_rule(r['id'])
b.close()
print('shots done')
