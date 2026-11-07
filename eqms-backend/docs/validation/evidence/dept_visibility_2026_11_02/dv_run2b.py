"""Stage 2b: the scope gate again. Business Unit / Department scopes of several profiles of one person add up (one profile without a scope lifts the limit), so the limit is put on EVERY profile of the three people."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from dv_lib import *
S = load(); A, B = S['A'], S['B']
docs, revs = [A['doc'], B['doc']], [A['rev1'], B['rev1']]
ALL = list(ROLES)
BASE = {'DCO', 'ADMIN', 'AUTHOR', 'COAUTHOR', 'REVIEWER', 'APPROVER', 'HEAD'}
def seesets(extra):
    out = {r: {'documents': set(docs), 'revisions': set(revs)} for r in BASE}
    out.update(extra)
    return out
def only(x):
    return {'documents': {x['doc']}, 'revisions': {x['rev1']}}
bk = json.load(open(os.path.join(HERE, 'backup.json'), encoding='utf-8'))
prof = [r[0] for r in sql("select distinct uap.access_profile_id from user_access_profiles uap join app_users u on u.id=uap.user_id where u.username in ('trainee.test1','trainee.test2','trainer.test1')")]
before = {p: (sql(f"select coalesce(department_scope,'<null>') from roles where id='{p}'")[0][0]) for p in prof}
print('profiles of G1B, G2A, G2B:', len(prof), before)
# the SOP and Instruction rules of group 1 and 2 must exist: group 1 rule was re-made at the end of stage 2
for p in prof:
    sql(f"update roles set department_scope='Logistics' where id='{p}'")
time.sleep(2)
print('== S12 (second attempt) every profile of G1B, G2A, G2B is limited to Logistics')
matrix('S12r', 'all their profiles limited to Logistics: they are named but out of scope', ALL, seesets({'G1A': only(A)}), revs=revs, docs=docs)
for p, v in before.items():
    sql(f"update roles set department_scope={'null' if v == '<null>' else repr(v)} where id='{p}'")
time.sleep(2)
matrix('S12s', 'limits removed: they see again', ALL, seesets({'G1A': only(A), 'G1B': only(A), 'G2A': only(B), 'G2B': only(B)}), revs=revs, docs=docs)
