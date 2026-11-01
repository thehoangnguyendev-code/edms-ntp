"""Scenario 3, part a: two Work Positions of Quality Control (QC Microbiology, QC Physicochemistry) and the trainings the head of the department assigns to them in the training matrix (APD.0011):
 - QC Microbiology:    topic "UAT31 Aseptic technique and environmental monitoring"
 - QC Physicochemistry: topic "UAT31 HPLC operation and calibration" and the document SOP "Handling of QC samples" (the document of scenario 1)
The matrix of Quality Control is upgraded to a new version, the rows are added, the version is submitted (signed) and approved by QA (signed). Shots and files are named S3-xx."""
from flows31 import *

state = load()
S = state.setdefault('s3', {})
b = Browser()
QC = '23111111-1111-1111-1111-111111111112'
TOPIC_MICRO = 'UAT31 Aseptic technique and environmental monitoring'
TOPIC_PHYS = 'UAT31 HPLC operation and calibration'
S.update(topic_micro=TOPIC_MICRO, topic_phys=TOPIC_PHYS)

step('S3-a.1 two Work Positions in Quality Control')
roles = {}
for code, name, juris in (('UAT31-QC-MICRO', 'QC Microbiology (UAT31)', 'Microbiological testing of raw materials, water and the environment'),
                          ('UAT31-QC-PHYS', 'QC Physicochemistry (UAT31)', 'Physicochemical testing of raw materials and finished products')):
    found = [r for r in admin.call('GET', f'/training/job-roles?limit=100&search={code}')['data'] if r.get('code') == code]
    if found:
        roles[code] = found[0]
    else:
        code_, r, t = attempt(admin, 'POST', '/training/job-roles', {'code': code, 'name': name, 'departmentId': QC, 'jurisdiction': juris})
        check(f'S3-a.1 Work Position {name} is created', code_ == 200, (code_, t))
        roles[code] = r
S['micro'], S['phys'] = roles['UAT31-QC-MICRO']['id'], roles['UAT31-QC-PHYS']['id']
save(state)
b.shot('admin', '/training-management/job-assignments', 'S3-01', 'Job_assignments_list_before', 'Danh sách Job Assignments (APD.0024) trước khi bổ nhiệm', tall=False)

step('S3-a.2 the matrix of Quality Control: a new version with the trainings of the two positions')
mats = admin.call('GET', '/training/matrices?limit=100')['data']
qc_m = next(m for m in mats if 'Quality Control' in str(m.get('departmentName')))
S['matrix'] = qc_m['id']
vers = admin.call('GET', f"/training/matrices/{qc_m['id']}/versions?limit=50")['data']
open_v = [v for v in vers if v['status'] in ('DRAFT',)]
if open_v:
    ver = open_v[0]['id']
elif any(v['status'] == 'PENDING_APPROVAL' for v in vers):
    ver = next(v['id'] for v in vers if v['status'] == 'PENDING_APPROVAL')
else:
    code, d, t = attempt(admin, 'POST', f"/training/matrices/{qc_m['id']}/upgrade")
    check('S3-a.2 a new version of the matrix is started from the effective one', code == 200, (code, t))
    ver = d['id']
v = admin.call('GET', f'/training/matrix-versions/{ver}')
print('matrix version', v.get('versionNo'), v.get('status'), 'rows', len(v['rows']))
if v['status'] == 'DRAFT' and not any(r.get('topicText') == TOPIC_MICRO for r in v['rows']):
    rows = [{'group': r['rowGroup'], 'topicText': r.get('topicText'), 'documentId': r.get('documentId'), 'annualRequired': r['annualRequired'], 'note': r.get('note'), 'positionIds': r['positionIds'],
             'allEmployees': bool(r.get('allEmployees')), 'locked': bool(r.get('locked'))} for r in v['rows']]
    rows += [{'group': 'SOP', 'topicText': TOPIC_MICRO, 'documentId': None, 'annualRequired': False, 'note': 'UAT31', 'positionIds': [S['micro']], 'allEmployees': False, 'locked': False},
             {'group': 'SOP', 'topicText': TOPIC_PHYS, 'documentId': None, 'annualRequired': False, 'note': 'UAT31', 'positionIds': [S['phys']], 'allEmployees': False, 'locked': False},
             {'group': 'SOP', 'topicText': None, 'documentId': state['s1']['doc'], 'annualRequired': False, 'note': 'UAT31 SOP of scenario 1', 'positionIds': [S['phys']], 'allEmployees': False, 'locked': False}]
    code, saved, t = attempt(admin, 'PUT', f'/training/matrix-versions/{ver}', {'version': v['version'], 'changeReason': 'UAT31 trainings of the two new Work Positions', 'rows': rows})
    if not check('S3-a.3 the rows of the two positions are saved', code == 200, (code, t)):
        finish('p3a', b)
    v = admin.call('GET', f'/training/matrix-versions/{ver}')
S['matrix_version'] = ver
b.shot('admin', f'/training-management/matrix/{ver}', 'S3-02', 'Matrix_QC_draft_with_new_rows', 'Ma trận đào tạo phòng Quality Control (bản nháp): cột QC Microbiology / QC Physicochemistry và các đào tạo gắn với từng vị trí')

step('S3-a.4 submit (signed) and approve (signed by QA)')
if v['status'] == 'DRAFT':
    approvers = admin.call('GET', f'/training/matrix-versions/{ver}/eligible-approvers')
    ap = [x for x in approvers.get('data', approvers) if x.get('id') == qa.user['id'] or x.get('userId') == qa.user['id']]
    print('eligible approvers:', [(x.get('fullName'), x.get('id')) for x in approvers.get('data', approvers)][:6])
    code, d, t = attempt(admin, 'POST', f'/training/matrix-versions/{ver}/submit', {'version': v['version'], 'signatureToken': sign(admin), 'approverUserId': qa.user['id']})
    check('S3-a.4 the matrix is submitted with a signature', code == 200, (code, t))
v = admin.call('GET', f'/training/matrix-versions/{ver}')
if v['status'] == 'PENDING_APPROVAL':
    code, d, t = attempt(qa, 'POST', f'/training/matrix-versions/{ver}/approve', {'version': v['version'], 'signatureToken': sign(qa)})
    check('S3-a.5 QA approves the matrix with a signature: Effective', code == 200, (code, t))
v = admin.call('GET', f'/training/matrix-versions/{ver}')
check('S3-a.6 the matrix version is Effective', v['status'] == 'EFFECTIVE', v['status'])
b.shot('admin', f'/training-management/matrix/{ver}', 'S3-03', 'Matrix_QC_effective', 'Ma trận Quality Control đã Effective với các đào tạo của 2 vị trí mới')
st, w = get_bytes(admin, f'/training/matrix-versions/{ver}/export?format=docx')
check('S3-a.7 APD.0011 as Word', st == 200 and w[:2] == b'PK', st)
if st == 200:
    save_apd('S3-04', 'APD0011_matrix_Quality_Control', 'APD.0011 ma trận đào tạo phòng Quality Control (có 2 vị trí QC Microbiology, QC Physicochemistry)', w, 'docx')
    t = words(w)
    check('S3-a.8 the matrix names both positions and the trainings', 'QC Microbiology' in t and 'QC Physicochemistry' in t and TOPIC_MICRO in t, t[:300])
st, p = get_bytes(admin, f'/training/matrix-versions/{ver}/export?format=pdf')
if st == 200 and p[:4] == b'%PDF':
    save_apd('S3-04', 'APD0011_matrix_Quality_Control', 'APD.0011 ma trận đào tạo phòng Quality Control (PDF)', p, 'pdf')
state['s3'] = S
save(state)
finish('p3a', b)
