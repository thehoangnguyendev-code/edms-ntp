"""Stage 2b: the operator (now holding the distribute permissions) finishes the copies of stage 2."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dcv_lib import *
S = load(); X = S['X']; cc = X['cc']; uc = X['uc']
b = Browser()
c, d, t = attempt('DCO', 'POST', f'/controlled-copies/{cc}/distribute', {'signatureToken': sign('DCO'), 'reason': 'DCV-TEST'})
check('S9.3', 'the operator distributes the Controlled Copy', c == 200, t)
cd = U('U3').call('GET', f'/controlled-copies/{cc}')
check('S9.4', 'U3 sees status Distributed', str(cd.get('status')).upper() == 'DISTRIBUTED', cd.get('status'))
c, d, t = attempt('DCO', 'POST', f'/uncontrolled-copies/{uc}/generate', {'signatureToken': sign('DCO'), 'reason': 'DCV-TEST'})
check('S10.5', 'the operator generates the Uncontrolled Copy', c == 200, t)
c, d, t = attempt('DCO', 'POST', f'/uncontrolled-copies/{uc}/distribute', {'signatureToken': sign('DCO'), 'reason': 'DCV-TEST'})
check('S10.6', 'the operator distributes the Uncontrolled Copy', c == 200, t)
print('uc status', U('U1').call('GET', f'/uncontrolled-copies/{uc}').get('status'))
b.shot('U1', '/documents/uncontrolled-copies/all', 'S10', 'U1-own-uc-distributed', 'S10: U1 sees their own Uncontrolled Copy, now Distributed')
b.shot('U3', '/documents/controlled-copies/all', 'S9', 'recipient-cc-distributed', 'S9: U3 sees the Controlled Copy, now Distributed')
b.close()
