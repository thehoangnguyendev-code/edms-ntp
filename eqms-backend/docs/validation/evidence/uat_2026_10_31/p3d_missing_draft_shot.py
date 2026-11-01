"""Scenario 3, part c: a second QC employee (Do Thi Lan, who has none of the trainings) gets a DRAFT appointment to the same two positions: the picture of the Matrix Check tab shows the trainings still missing and the
signature is refused. The draft is cancelled afterwards (it stays as history). Replaces S3-05 and S3-08 of the first run, which a re-run had overwritten with the final state."""
from flows31 import *

state = load()
S = state['s3']
P2 = 'uat31.s2.qc.pass'
drop_shots(['S3-05', 'S3-08'])
b = Browser()
for row in admin.call('GET', f'/training/job-assignments?personId={uid(P2)}&limit=50')['data']:
    if row['status'] in ('DRAFT', 'PENDING_RECEIVER'):
        got = admin.call('GET', f"/training/job-assignments/{row['id']}")
        attempt(admin, 'POST', f"/training/job-assignments/{row['id']}/cancel", {'version': got['version'], 'reason': 'UAT31 cleanup of an earlier draft'})
body = {'personUserId': uid(P2), 'positionIds': [S['micro'], S['phys']], 'directSuperiorTitle': 'Head of Quality Control', 'subordinateTitles': 'None', 'substituteTitle': 'QC Supervisor',
        'jurisdiction': 'UAT31 QC Microbiology and QC Physicochemistry',
        'duties': [{'responsibility': 'Thực hiện kiểm nghiệm vi sinh theo SOP', 'description': 'Kiểm nghiệm vi sinh', 'responsibilityEn': 'Perform microbiological testing per SOP', 'descriptionEn': 'Microbiological testing'}]}
code, j, t = attempt(admin, 'POST', '/training/job-assignments', body)
check('S3-c.1 a draft for a QC employee without the trainings is created', code == 200, (code, t))
if code == 200:
    ja = j['id']
    el = admin.call('GET', f'/training/job-assignments/{ja}').get('eligibility') or {}
    check('S3-c.2 the check lists three trainings still missing', el.get('missingCount') == 3, el.get('missingCount'))
    got = admin.call('GET', f'/training/job-assignments/{ja}')
    code, d, t = attempt(admin, 'POST', f'/training/job-assignments/{ja}/submit', {'version': got['version'], 'signatureToken': sign(admin), 'assignorTitle': 'Head of Quality Control'})
    check('S3-c.3 the head cannot sign: TRAINING_MATRIX_INCOMPLETE', code == 409 and 'TRAINING_MATRIX_INCOMPLETE' in t, (code, t))
    b.shot('admin', f'/training-management/job-assignments/{ja}', 'S3-05', 'Job_assignment_draft_Matrix_Check_missing', f"Job Assignment bản nháp của {name_of(P2)} (chưa đào tạo gì): tab Matrix Check liệt kê 3 đào tạo còn thiếu của 2 vị trí; ký bị chặn (TRAINING_MATRIX_INCOMPLETE)", action=tab('Matrix Check'))
    got = admin.call('GET', f'/training/job-assignments/{ja}')
    attempt(admin, 'POST', f'/training/job-assignments/{ja}/cancel', {'version': got['version'], 'reason': 'UAT31 demonstration draft, cancelled'})
finish('p3d', b)
