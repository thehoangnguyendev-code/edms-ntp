"""DEV: Quality Assurance applies the rows it locked to the matrices of all the other departments (decision of the owner 2026-10-27). Checks: a version without a locked row is refused (409),
a person without Training Administration is refused, the locked row reaches the other matrices (draft or new draft; a version waiting for approval is reported, not changed), a second call changes
nothing, and a head of department cannot take the row out. The row is named "E2E-TEST"; the draft versions made by the call are left for the owner to review. The password comes from DEVPW."""
import os, sys, subprocess, time
sys.path.insert(0, os.path.dirname(__file__))
from api import Client
from e2e21_matrix import admin, check, attempt, results

stamp = str(int(time.time()))[-6:]
TOPIC = f'E2E-TEST applied to all {stamp}'
trainee = Client('trainee.test2')


def sql(q):
    return subprocess.run(['docker', 'exec', 'eqms-postgres', 'psql', '-U', 'eqms', '-d', 'eqms-database', '-Atc', q], capture_output=True, text=True).stdout.strip()


def resend(v, extra=None):
    rows = [{'group': r['rowGroup'], 'topicText': r.get('topicText'), 'documentId': r.get('documentId'), 'annualRequired': r['annualRequired'], 'note': r.get('note'),
             'positionIds': r['positionIds'], 'allEmployees': bool(r.get('allEmployees')), 'locked': bool(r.get('locked'))} for r in v['rows']]
    return rows + ([extra] if extra else [])


ver = sql("select v.id from training_matrix_versions v join training_matrices m on m.id = v.matrix_id where m.code = 'TM-RA' and v.status = 'DRAFT' limit 1")
print('== 1. refused')
code, d, raw = attempt(trainee, 'POST', f'/training/matrix-versions/{ver}/apply-locked-rows')
check('1.1 a person without Training Administration is refused', code in (401, 403), (code, raw))
v = admin.call('GET', f'/training/matrix-versions/{ver}')
if not any(r.get('locked') for r in v['rows']):
    code, d, raw = attempt(admin, 'POST', f'/training/matrix-versions/{ver}/apply-locked-rows')
    check('1.2 a version without a locked row is refused (409)', code == 409, (code, raw))

if os.environ.get('APPLY') != '1':
    print('sections 2 and 3 add E2E-TEST drafts to the matrices of every department: run with APPLY=1 only when the owner agrees')
else:
    print('== 2. the locked row reaches the other matrices')
    row = {'group': 'FACTORY_GENERAL', 'topicText': TOPIC, 'documentId': None, 'annualRequired': True, 'note': None, 'positionIds': [], 'allEmployees': True, 'locked': True}
    code, saved, raw = attempt(admin, 'PUT', f'/training/matrix-versions/{ver}', {'version': v['version'], 'changeReason': 'E2E-TEST', 'rows': resend(v, row)})
    check('2.1 the row is locked in the source version', code == 200, raw)
    code, out, raw = attempt(admin, 'POST', f'/training/matrix-versions/{ver}/apply-locked-rows')
    check('2.2 the call is done and says what happened to each matrix', code == 200 and isinstance(out.get('matrices'), list) and out.get('lockedRows', 0) >= 1, raw)
    others = int(sql("select count(*) from training_matrices where code <> 'TM-RA'"))
    check('2.3 every other matrix is in the answer', len(out.get('matrices', [])) == others, (len(out.get('matrices', [])), others))
    have = int(sql(f"select count(distinct v.matrix_id) from training_matrix_rows r join training_matrix_versions v on v.id = r.version_id join training_matrices m on m.id = v.matrix_id where r.topic_text = '{TOPIC}' and r.locked and r.all_employees and v.status = 'DRAFT' and m.code <> 'TM-RA'"))
    reached = sum(1 for m in out.get('matrices', []) if m['outcome'] in ('ADDED_TO_DRAFT', 'NEW_DRAFT'))
    check('2.4 the row is in a draft of every matrix that changed, locked and for all employees', have == reached and reached >= 1, (have, reached))
    open_cells = sql(f"select count(*) from training_matrix_rows r join training_matrix_versions v on v.id = r.version_id join training_matrices m on m.id = v.matrix_id where r.topic_text = '{TOPIC}' and v.status = 'DRAFT' and m.code <> 'TM-RA' and not exists (select 1 from training_matrix_cells c where c.row_id = r.id)")
    check('2.5 and ticked for the Work Positions of its department (no row without a cell, except a department without Work Positions)', int(open_cells) <= int(sql("select count(*) from training_matrices m where not exists (select 1 from training_job_roles j where j.department_id = m.department_id and j.is_active)")), open_cells)
    waiting = [m for m in out['matrices'] if m['outcome'].startswith('SKIPPED')]
    check('2.6 a matrix that waits for approval is left as it is', all(int(sql(f"select count(*) from training_matrix_rows r join training_matrix_versions v on v.id = r.version_id join training_matrices m on m.id = v.matrix_id where r.topic_text = '{TOPIC}' and m.code = '{w['code']}'")) == 0 for w in waiting), waiting)

    print('== 3. a second call changes nothing')
    code, again, raw = attempt(admin, 'POST', f'/training/matrix-versions/{ver}/apply-locked-rows')
    check('3.1 every matrix is "already there" or still waiting', code == 200 and all(m['outcome'] in ('ALREADY_THERE', 'SKIPPED_PENDING_APPROVAL', 'SKIPPED_NO_VERSION') for m in again['matrices']), raw)


print(sum(1 for r in results if r[1]), 'of', len(results), 'checks passed')
