"""Stage 3 (DEV only): Audit Trail tabs follow the screen; Records follow their own permission. Needs dcv_run1/2 first."""
import os, sys, json
sys.path.insert(0, os.path.dirname(__file__))
from dcv_lib import *

ALL = list(ROLES)
S = load(); X, Y = S['X'], S['Y']
cc, uc = X['cc'], X['uc']
NAMED = {'U1', 'U2', 'U3'}; VIEW = {'ALLVIEW', 'DCO'}
b = Browser()

print('== S11 the Audit Trail TAB of a Document / Revision: whoever can open the screen reads the whole tab')
for label, module, ent, can_open in (
        ('Document X', 'DOCUMENT', X['doc'], NAMED | VIEW),
        ('Revision X', 'REVISION', X['rx'], NAMED | VIEW),
        ('Controlled Copy X', 'CONTROLLED COPY', cc, {'DCO', 'ALLVIEW', 'U3'}),
        ('Uncontrolled Copy X', 'UNCONTROLLED COPY', uc, {'DCO', 'ALLVIEW', 'U1'})):
    for r in ALL:
        c, d, t = attempt(r, 'GET', f'/audit-trail/entity/{module.replace(" ", "%20")}/{ent}')
        ok = (c == 200) if r in can_open else (c in (401, 403, 404))
        check(f'S11.{module[:4]}.{r}', f'{label}: {ROLES[r]} {"reads" if r in can_open else "is refused"} the Audit Trail tab', ok, f'HTTP {c} {t[:120]}')

print('== S12 Records: permission only')
for r in ALL:
    c, d, t = attempt(r, 'GET', '/executed-records?limit=5&page=1')
    print('   records', ROLES[r], c)
    S.setdefault('rec', {})[r] = c
save(S)
c, d, t = attempt('U1', 'GET', '/executed-records?limit=5&page=1')
check('S12.1', 'a Contributor without the Records permission is refused', c in (401, 403), c)
c, d, t = attempt('READER', 'GET', '/executed-records?limit=5&page=1')
check('S12.2', 'the Knowledge-only reader is refused', c in (401, 403), c)
c, d, t = attempt('DCO', 'GET', '/executed-records?limit=5&page=1')
check('S12.3', 'the operator (holds Records permission) can list', c == 200, c)

b.shot('U1', f'/documents/revisions/{X["rx"]}', 'S11', 'U1-revision-detail', 'S11: U1 opens revision X (Author) and its tabs')
b.shot('DCO', '/documents/records', 'S12', 'operator-records', 'S12: the operator sees Records')
b.close()
