"""DEV only: revision 1.0.1 of SOP.7147 goes through submit -> review -> approve -> publish with the named people."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dcv_lib import *
RID = '69163672-54d5-41b1-babf-c8f5fa7aeb32'
print('start', status_of(RID))
for who, name in (('U1','submit-review'),('U3','review/complete'),('UCAPP','approve/complete')):
    c, t = step(who, RID, name)
    print(who, name, c, t[:200], '->', status_of(RID))
