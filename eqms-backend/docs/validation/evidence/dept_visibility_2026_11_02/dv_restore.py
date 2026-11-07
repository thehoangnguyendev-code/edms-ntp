"""Puts DEV back as dv_setup.py found it (settings, Department Head, permission links, the temporary profile). The documents, revisions and copies of the run are kept."""
import os, sys, json, subprocess
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault('DEVPW', 'unused')
from dv_lib import sql, HERE, DEPT

BK = os.path.join(HERE, 'backup.json')
bk = json.load(open(BK, encoding='utf-8'))
cfg = bk['documents_config'].replace("'", "''")
sql(f"update system_configurations set documents_config='{cfg}'::jsonb")
head = f"'{bk['qc_head']}'" if bk['qc_head'] else 'null'
sql(f"update departments set department_head_id={head} where name='{DEPT}'")
for i in bk['psi_ids']:
    sql(f"delete from permission_set_items where id='{i}'")
sql(f"delete from user_access_profiles where access_profile_id='{bk['dv_role']}'")
sql(f"delete from access_profile_permission_sets where access_profile_id='{bk['dv_role']}'")
sql(f"delete from roles where id='{bk['dv_role']}'")
sql(f"delete from permission_set_items where permission_set_id='{bk['dv_ps']}'")
sql(f"delete from permission_sets where id='{bk['dv_ps']}'")
# the rules the run made
sql("delete from object_access_rule_users where object_access_rule_id in (select id from object_access_rules where name like 'DV-TEST%')")
sql("delete from object_access_rules where name like 'DV-TEST%'")
os.replace(BK, BK + '.restored')
print('DEV restored')
