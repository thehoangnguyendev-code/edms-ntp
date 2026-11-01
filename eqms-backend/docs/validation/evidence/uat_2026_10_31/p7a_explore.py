"""Part 7 (Legacy Import and Training), exploration: what the DEV data offers for an import (document type, business unit, department, who may verify)."""
from flows31 import *

types = admin.call('GET', '/dictionaries/document-types') if False else None
rows = sql("select id, short_code, name from document_types where is_active order by short_code limit 6")
print('types', rows)
print('bu', sql("select id, name from business_units where is_active limit 3"))
print('dept', sql("select id, name, code from departments where is_active order by name limit 12"))
dept = sql("select id from departments where name = 'Quality Assurance'")[0][0]
page = admin.call('GET', f'/training/legacy-evidence/eligible-verifiers?department={dept}')
print('verifiers', [(p['fullName'], p.get('username')) for p in page['data']])
print('admin', admin.user['username'], admin.user.get('department'))
print('numbers', sql("select count(*) from training_number_sequences"), sql("select department_id, year, last_serial from training_number_sequences order by year desc limit 5"))
print('settings serial digits', sql("select 1"))
print('users uat31', sql("select username, department from app_users where username like 'uat31.%' order by username limit 30"))
finish('p7a')
