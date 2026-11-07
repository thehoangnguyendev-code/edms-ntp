"""Prepares DEV for the run and writes backup.json (what dv_restore.py puts back). Idempotent: refuses to run twice without a restore."""
import os, sys, json
sys.path.insert(0, os.path.dirname(__file__))
from dv_lib import *

BK = os.path.join(HERE, 'backup.json')
if os.path.exists(BK):
    sys.exit('backup.json exists: run dv_restore.py first')

bk = {}
bk['documents_config'] = subprocess.run(['docker', 'exec', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-At', '-c', 'select documents_config::text from system_configurations'],
                                         capture_output=True, text=True, encoding='utf-8').stdout.strip()
_head = sql(f"select coalesce(department_head_id::text,'') from departments where name='{DEPT}'")
bk['qc_head'] = _head[0][0] if _head else ''
bk['reviewer_ps'] = sql("select ps.id from user_access_profiles uap join app_users u on u.id=uap.user_id join access_profile_permission_sets aps on aps.access_profile_id=uap.access_profile_id join permission_sets ps on ps.id=aps.permission_set_id where u.username='reviewer.test2' and ps.code='PS_REVIEWER_TEST'")
print('reviewer permission set rows:', bk['reviewer_ps'])
ps_id = bk['reviewer_ps'][0][0]

# 1. Knowledge Base visibility: Sharing (Document Control keeps its Record Visibility setting)
sql("update system_configurations set documents_config = documents_config || '{\"knowledgeVisibilityMode\":\"SHARING\"}'::jsonb")
# 2. the Department Head of Quality Control for the run
sql(f"update departments set department_head_id=(select id from app_users where username='{ROLES['HEAD']}') where name='{DEPT}'")
# 3. the permission to manage the visibility of the own Department, through the permission set of the Reviewer Test profile (only the Head of a Department can use it)
ins = sql(f"insert into permission_set_items (id, permission_set_id, permission_id) select gen_random_uuid(), '{ps_id}', p.id from permissions p where p.code='security.object_rules.manage_own_department' and not exists (select 1 from permission_set_items i where i.permission_set_id='{ps_id}' and i.permission_id=p.id) returning id")
bk['psi_ids'] = [r[0] for r in ins]
# 4. a profile "DV Document Viewer" = the module permission (view documents, controlled and uncontrolled copies): what the administrator grants to a user to open the Document Control module
sql("insert into permission_sets (id, name, code, description, active, system) values (gen_random_uuid(), 'DV Document Viewer (run 2026-11-02)', 'PS_DV_DOC_VIEWER', 'DV run: view documents and copies', true, false)")
psv = sql("select id from permission_sets where code='PS_DV_DOC_VIEWER'")[0][0]
sql(f"insert into permission_set_items (id, permission_set_id, permission_id) select gen_random_uuid(), '{psv}', p.id from permissions p where p.code in ('documents.document.view','documents.controlled_copy.view','documents.uncontrolled_copy.view','self_service.knowledge.view','security.access_review.view','security.object_rules.manage','security.object_rules.share_knowledge_any_department','security.object_rules.manage_own_department')")
sql("insert into roles (id, code, name, description, is_system, is_active, type) values (gen_random_uuid(), 'DV_DOC_VIEWER', 'DV Document Viewer (run)', 'DV run', false, true, 'CUSTOM')")
role_id = sql("select id from roles where code='DV_DOC_VIEWER'")[0][0]
sql(f"insert into access_profile_permission_sets (access_profile_id, permission_set_id) values ('{role_id}','{psv}')")
bk.update(dv_ps=psv, dv_role=role_id)
json.dump(bk, open(BK, 'w', encoding='utf-8'), indent=1)
print('setup done; head of', DEPT, '=', ROLES['HEAD'])
