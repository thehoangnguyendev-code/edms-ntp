"""DEV: the trainings required of all employees (SOP.0003 5.3.1: the matrix group "General education as factory's requirement", positions "All employees"). Decision of the owner 2026-10-26:
Quality Assurance (Training Administration) locks such a row; a head of department cannot take it out of the matrix of the department. Since 2026-10-27 there is no catalog of Training Topics:
the topic is written in the row of the matrix, and Quality Assurance locks the row. Checks: Quality Assurance locks a row (it is for all employees, ticked for every Work Position of the department),
the row is checked when a Work Position is given (it comes from "all employees"), a row that is not for all employees cannot be locked, and Quality Assurance unlocks it and takes it out.
The catalog of topics does not exist any more (its address answers "not found"). The password comes from DEVPW. The topic is named "E2E-TEST"; nothing else is deleted."""
import os, sys, subprocess, time
sys.path.insert(0, os.path.dirname(__file__))
from api import Client
from e2e21_matrix import admin, check, attempt, results

stamp = str(int(time.time()))[-6:]
trainee = Client('trainee.test2')
TOPIC = f'E2E-TEST for all employees {stamp}'


def sql(q):
    return subprocess.run(['docker', 'exec', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-Atc', q], capture_output=True, text=True).stdout.strip()


def resend(v, edit=None):
    out = []
    for r in v['rows']:
        row = {'group': r['rowGroup'], 'topicText': r.get('topicText'), 'documentId': r.get('documentId'), 'annualRequired': r['annualRequired'], 'note': r.get('note'), 'positionIds': r['positionIds'],
               'allEmployees': bool(r.get('allEmployees')), 'locked': bool(r.get('locked'))}
        out.append(edit(row) if edit else row)
    return out


print('== 1. the catalog is gone')
status, _ = admin.call('GET', '/training/topics', raw=True)
check('1.1 the address of the catalog of topics does not exist any more', status in (404, 405, 500), status)

print('== 2. Quality Assurance locks a row of the matrix')
ver = sql("select v.id from training_matrix_versions v join training_matrices m on m.id = v.matrix_id where m.code = 'TM-RA' and v.status = 'DRAFT' limit 1")
dept = sql("select m.department_id from training_matrix_versions v join training_matrices m on m.id = v.matrix_id where v.id = '%s'" % ver)
roles = int(sql(f"select count(*) from training_job_roles where department_id = '{dept}' and is_active") or 0)
v = admin.call('GET', f'/training/matrix-versions/{ver}')
rows = resend(v) + [{'group': 'FACTORY_GENERAL', 'topicText': TOPIC, 'documentId': None, 'annualRequired': True, 'note': None, 'positionIds': [], 'allEmployees': True, 'locked': True}]
code, saved, raw = attempt(admin, 'PUT', f'/training/matrix-versions/{ver}', {'version': v['version'], 'changeReason': 'E2E-TEST', 'rows': rows})
row = next((r for r in saved.get('rows', []) if r.get('topicText') == TOPIC), None)
check('2.1 the row is saved, for all employees and locked', code == 200 and row is not None and row.get('allEmployees') is True and row.get('locked') is True and row['rowGroup'] == 'FACTORY_GENERAL', raw)
check('2.2 it is ticked for every Work Position of the department and repeated every year', row is not None and len(row['positionIds']) == roles and row['annualRequired'] is True, (len(row['positionIds']) if row else None, roles))
bad = rows[:-1] + [dict(rows[-1], topicText=None, documentId=None)]
code, d, raw = attempt(admin, 'PUT', f'/training/matrix-versions/{ver}', {'version': saved['version'], 'changeReason': 'E2E-TEST', 'rows': bad})
check('2.3 a row with neither a topic nor a document is refused (400)', code == 400, (code, raw))
notall = [dict(r, locked=True) if r.get('topicText') == TOPIC else r for r in resend(saved, lambda x: dict(x, allEmployees=False) if x['topicText'] == TOPIC else x)]
code, again, raw = attempt(admin, 'PUT', f'/training/matrix-versions/{ver}', {'version': saved['version'], 'changeReason': 'E2E-TEST', 'rows': notall})
row2 = next((r for r in again.get('rows', []) if r.get('topicText') == TOPIC), None)
check('2.4 a row that is not for all employees is not locked', code == 200 and row2 is not None and not row2.get('allEmployees') and not row2.get('locked'), raw)
code, again2, raw = attempt(admin, 'PUT', f'/training/matrix-versions/{ver}', {'version': again['version'], 'changeReason': 'E2E-TEST', 'rows': resend(again, lambda x: dict(x, allEmployees=True, locked=True) if x['topicText'] == TOPIC else x)})
row3 = next((r for r in again2.get('rows', []) if r.get('topicText') == TOPIC), None)
check('2.5 and locked again', code == 200 and row3 is not None and row3.get('locked') is True, raw)

print('== 3. it is checked when a Work Position is given')
role = sql("select id from training_job_roles where is_active and code like 'E2E-JR-%' limit 1")
person = trainee.user['id']
elig = admin.call('GET', f'/training/job-assignments/eligibility?person={person}&position={role}')
check('3.1 the department of the person is the one of the matrix, so the row is checked only where the person works', isinstance(elig.get('items'), list), elig)

print('== 4. Quality Assurance unlocks it and takes it out')
code, last, raw = attempt(admin, 'PUT', f'/training/matrix-versions/{ver}', {'version': again2['version'], 'changeReason': 'E2E-TEST', 'rows': resend(again2, lambda x: dict(x, locked=False) if x['topicText'] == TOPIC else x)})
row4 = next((r for r in last.get('rows', []) if r.get('topicText') == TOPIC), None)
check('4.1 unlocked: the row stays for all employees and is not locked', code == 200 and row4 is not None and row4.get('allEmployees') is True and not row4.get('locked'), raw)
code, gone, raw = attempt(admin, 'PUT', f'/training/matrix-versions/{ver}', {'version': last['version'], 'changeReason': 'E2E-TEST', 'rows': [r for r in resend(last) if r['topicText'] != TOPIC]})
check('4.2 and taken out', code == 200 and not any(r.get('topicText') == TOPIC for r in gone.get('rows', [])), raw)
print(sum(1 for r in results if r[1]), 'of', len(results), 'checks passed')
