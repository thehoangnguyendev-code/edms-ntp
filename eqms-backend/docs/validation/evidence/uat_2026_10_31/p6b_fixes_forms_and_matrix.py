"""Corrections of 2026-10-31, part b:
 - APD.0011: a matrix with many Work Positions (7 or more) is printed on a landscape page; few positions stay portrait.
 - Matrix editor: a rule between the column "Annual training required" and the column of the delete buttons.
 - APD.0024: the notes of the form under the signatures are not printed; the cell "Assignor" says the head of the department of the employee (staff) or the title of the assignor (head, QM, QP).
 - APD.0014: the qualification is the HIGHEST degree (order of the Degree Levels of the master data), not the latest.
Pictures / files F-10 ..."""
from flows31 import *

state = load()
S = state.setdefault('f6b', {})
b = Browser()
QC = '23111111-1111-1111-1111-111111111112'
s3 = state['s3']
norm = lambda x: ''.join(ch for ch in x.lower() if ch.isalnum() and ch not in 'of')
import fitz

# ------------------------------------------------------------------------------------------------ APD.0011 landscape
step('F-6 APD.0011: many Work Positions, landscape page')
ver3 = s3['matrix_version']
vv = admin.call('GET', f'/training/matrix-versions/{ver3}')
st, pdf = get_bytes(admin, f'/training/matrix-versions/{ver3}/export?format=pdf')
check('F-6.1 APD.0011 of the matrix with 5 positions is produced', st == 200 and pdf[:4] == b'%PDF', st)
doc = fitz.open(stream=pdf, filetype='pdf')
check('F-6.2 five positions: the page stays portrait', doc[0].rect.width < doc[0].rect.height, doc[0].rect)
save_apd('F-12', 'APD0011_five_positions_portrait', 'APD.0011 ma trận Quality Control với 5 vị trí: giấy dọc như trước', pdf, 'pdf', pages=1)

if 'ver' not in S:
    extra = []
    for i in (1, 2, 3):
        code = f'UAT31-QC-X{i}'
        found = [r for r in admin.call('GET', f'/training/job-roles?limit=100&search={code}')['data'] if r.get('code') == code]
        if found:
            extra.append(found[0]['id'])
        else:
            c, r, t = attempt(admin, 'POST', '/training/job-roles', {'code': code, 'name': f'QC Extra position {i} (UAT31)', 'departmentId': QC, 'jurisdiction': 'UAT31 extra position for the width of APD.0011'})
            check(f'F-6.3 Work Position {code} is created', c == 200, (c, t))
            extra.append(r['id'])
    c, d, t = attempt(admin, 'POST', f"/training/matrices/{s3['matrix']}/upgrade")
    check('F-6.4 a new version of the matrix is started', c == 200, (c, t))
    S['ver'] = d['id']
    v = admin.call('GET', f"/training/matrix-versions/{S['ver']}")
    rows = [{'group': r['rowGroup'], 'topicText': r.get('topicText'), 'documentId': r.get('documentId'), 'annualRequired': r['annualRequired'], 'note': r.get('note'), 'positionIds': r['positionIds'],
             'allEmployees': bool(r.get('allEmployees')), 'locked': bool(r.get('locked'))} for r in v['rows']]
    rows.append({'group': 'SOP', 'topicText': 'UAT31 Extra training for the three new positions', 'documentId': None, 'annualRequired': False, 'note': 'UAT31', 'positionIds': extra, 'allEmployees': False, 'locked': False})
    c, saved, t = attempt(admin, 'PUT', f"/training/matrix-versions/{S['ver']}", {'version': v['version'], 'changeReason': 'UAT31 three more positions (width of APD.0011)', 'rows': rows})
    check('F-6.5 the rows are saved', c == 200, (c, t))
    state['f6b'] = S
    save(state)
ver = S['ver']
v = admin.call('GET', f'/training/matrix-versions/{ver}')
# the editor of the draft: the rule before the column of the delete buttons
b.shot('admin', f'/training-management/matrix/{ver}', 'F-10', 'Matrix_editor_rule_before_delete_column', 'Ma trận ở chế độ sửa (bản nháp): có đường kẻ dọc phân tách cột "Annual training required" và cột nút xoá (thùng rác)')
if v['status'] == 'DRAFT':
    c, d, t = attempt(admin, 'POST', f'/training/matrix-versions/{ver}/submit', {'version': v['version'], 'signatureToken': sign(admin), 'approverUserId': qa.user['id']})
    check('F-6.6 the matrix is submitted with a signature', c == 200, (c, t))
v = admin.call('GET', f'/training/matrix-versions/{ver}')
if v['status'] == 'PENDING_APPROVAL':
    c, d, t = attempt(qa, 'POST', f'/training/matrix-versions/{ver}/approve', {'version': v['version'], 'signatureToken': sign(qa)})
    check('F-6.7 QA approves with a signature', c == 200, (c, t))
v = admin.call('GET', f'/training/matrix-versions/{ver}')
check('F-6.8 the version with 8 positions is Effective', v['status'] == 'EFFECTIVE', v['status'])
st, pdf = get_bytes(admin, f'/training/matrix-versions/{ver}/export?format=pdf')
check('F-6.9 APD.0011 is produced', st == 200 and pdf[:4] == b'%PDF', st)
doc = fitz.open(stream=pdf, filetype='pdf')
check('F-6.10 eight positions: the page is landscape', doc[0].rect.width > doc[0].rect.height, doc[0].rect)
save_apd('F-11', 'APD0011_eight_positions_landscape', f'APD.0011 ma trận Quality Control với {len(v["positions"]) if "positions" in v else 8} vị trí: giấy xoay ngang, tên vị trí nằm ngang', pdf, 'pdf', pages=2, dpi=70)
st, w = get_bytes(admin, f'/training/matrix-versions/{ver}/export?format=docx')
check('F-6.11 the Word file has a landscape section', st == 200 and b'w:orient="landscape"' in zipfile.ZipFile(io.BytesIO(w)).read('word/document.xml'), st)
b.shot('admin', f'/training-management/matrix/{ver}', 'F-10b', 'Matrix_effective_8_positions', 'Ma trận Quality Control (Effective) với 8 vị trí công việc')

# ------------------------------------------------------------------------------------------------ APD.0024
step('F-7 APD.0024: the notes are not printed; the cell of the assignor')
ja = s3['ja']
st, pdf = get_bytes(admin, f'/training/job-assignments/{ja}/export?format=pdf')
check('F-7.1 APD.0024 of the staff member is produced', st == 200 and pdf[:4] == b'%PDF', st)
txt = pdf_text(pdf)
head_qc = name_of('uat31.head.qc')
print(txt[-700:])
check('F-7.2 the two notes of the form are not printed', 'Đối với trường hợp người nhận việc' not in txt and 'In case the person receiving' not in txt and norm('speficy head of department') not in norm(txt), '')
check('F-7.3 the receiver is staff: the cell of the assignor names the head of the department of the employee', norm('Head of department: ' + head_qc + ' (Quality Control)') in norm(txt), txt[-500:])
save_apd('F-13', 'APD0024_staff_receiver_head_of_department', f'APD.0024 bổ nhiệm Mai Văn Tâm (nhân viên): ô Assignor ghi trưởng đơn vị của nhân viên ({head_qc}); không in hai ghi chú của biểu mẫu', pdf, 'pdf', pages=2)

if 'ja_head' not in S:
    body = {'personUserId': uid('uat31.head.qc'), 'positionIds': [s3['micro']], 'directSuperiorTitle': 'QA Manager', 'subordinateTitles': 'QC staff', 'substituteTitle': 'QC Supervisor', 'jurisdiction': 'UAT31 the head of QC takes QC Microbiology',
            'duties': [{'responsibility': 'Phụ trách vi sinh', 'description': 'Phê duyệt kết quả vi sinh', 'responsibilityEn': 'In charge of microbiology', 'descriptionEn': 'Approves microbiology results'}]}
    c, j, t = attempt(admin, 'POST', '/training/job-assignments', body)
    print('draft for the head:', c, t[:200])
    if c == 200:
        S['ja_head'] = j['id']
        state['f6b'] = S
        save(state)
if 'ja_head' in S:
    jh = S['ja_head']
    j = admin.call('GET', f'/training/job-assignments/{jh}')
    if j['status'] == 'DRAFT':
        c, d, t = attempt(admin, 'POST', f'/training/job-assignments/{jh}/submit', {'version': j['version'], 'signatureToken': sign(admin), 'assignorTitle': 'QA Manager'})
        print('submit for the head:', c, t[:300])
        if c != 200 and 'MATRIX_INCOMPLETE' in t:
            el = admin.call('GET', f'/training/job-assignments/{jh}/exception/eligible-approvers?limit=50')
            people = el.get('data', el)
            print('eligible exception approvers:', [(x.get('fullName'), x.get('id') or x.get('userId')) for x in people][:8])
            ap = next((x for x in people if (x.get('id') or x.get('userId')) not in (admin.user['id'], uid('uat31.head.qc'))), None)
            apc = U(ap.get('username') or 'approver.test1') if ap and ap.get('username') else qa
            c, d, t = attempt(admin, 'POST', f'/training/job-assignments/{jh}/exception', {'reason': 'UAT31 the head of the department is appointed before the training (test of APD.0024)', 'approverUserId': (ap.get('id') or ap.get('userId')) if ap else qa.user['id']})
            print('exception:', c, t[:200])
            if c == 200:
                who = next((x for x in (qa, approve2, dco) if x.user['id'] == ((ap.get('id') or ap.get('userId')) if ap else qa.user['id'])), qa)
                c, d, t = attempt(who, 'POST', f'/training/job-assignments/{jh}/exception/approve', {'signatureToken': sign(who)})
                print('exception approved:', c, t[:200])
                j = admin.call('GET', f'/training/job-assignments/{jh}')
                c, d, t = attempt(admin, 'POST', f'/training/job-assignments/{jh}/submit', {'version': j['version'], 'signatureToken': sign(admin), 'assignorTitle': 'QA Manager'})
                print('submit after exception:', c, t[:200])
    j = admin.call('GET', f'/training/job-assignments/{jh}')
    if j['status'] == 'PENDING_RECEIVER':
        hc = U('uat31.head.qc')
        c, d, t = attempt(hc, 'POST', f'/training/job-assignments/{jh}/accept', {'version': j['version'], 'signatureToken': sign(hc)})
        print('accept by the head:', c, t[:200])
    j = admin.call('GET', f'/training/job-assignments/{jh}')
    print('head assignment status', j['status'])
    st, pdf = get_bytes(admin, f'/training/job-assignments/{jh}/export?format=pdf')
    if st == 200:
        txt = pdf_text(pdf)
        if j['status'] in ('PENDING_RECEIVER', 'EFFECTIVE', 'ACCEPTED'):
            check('F-7.4 the receiver is the head of a department: the cell of the assignor says the title of the assignor', norm('Title of the assignor: QA Manager') in norm(txt) and norm('Head of department: ') not in norm(txt.split('Assignor')[-1]), txt[-500:])
            save_apd('F-14', 'APD0024_head_receiver_title_of_assignor', 'APD.0024 bổ nhiệm trưởng phòng QC: ô Assignor ghi chức danh của người giao việc (QA Manager)', pdf, 'pdf', pages=2)
        else:
            print('head case not signed yet; the status is', j['status'])

# ------------------------------------------------------------------------------------------------ APD.0014
step('F-8 APD.0014: the highest degree')
person = uid('uat31.s3.new')
if not sql(f"select 1 from user_educations where user_id='{person}'"):
    for deg, field, inst, yr in (('Cao đẳng', 'Hoá phân tích', 'UAT31 College', '2016'), ('Thạc sĩ', 'Hoá dược', 'UAT31 University of Pharmacy', '2012'), ('Đại học', 'Dược học', 'UAT31 University of Medicine', '2020')):
        sql(f"insert into user_educations(id,user_id,degree,field_of_study,institution,graduation_year,created_at,updated_at) values (gen_random_uuid(),'{person}','{deg}','{field}','{inst}','{yr}',now(),now())")
print(sql(f"select e.degree, l.display_order, e.graduation_year from user_educations e left join education_degree_levels l on lower(trim(l.name))=lower(trim(e.degree)) where user_id='{person}' order by 2 desc"))
c, exp, t = attempt(admin, 'POST', '/training/record-exports', {'personUserId': person, 'reason': 'UAT31 personal record: highest degree', 'approverUserId': qa.user['id'], 'signatureToken': sign(admin)})
check('F-8.1 APD.0014 is asked for', c == 200, (c, t[:200]))
if c == 200:
    attempt(qa, 'POST', f"/training/record-exports/{exp['id']}/approve", {'signatureToken': sign(qa)})
    st, pdf = get_bytes(admin, f"/training/record-exports/{exp['id']}/download")
    check('F-8.2 APD.0014 as PDF', st == 200 and pdf[:4] == b'%PDF', st)
    txt = pdf_text(pdf)
    print(txt[:500])
    check('F-8.3 the qualification is the HIGHEST degree (Thạc sĩ, graduated 2012) although a college degree (2016) and a university degree (2020) are later', norm('Thạc sĩ') in norm(txt) and norm('Cao đẳng') not in norm(txt) and norm('Dược học') not in norm(txt), txt[:600])
    save_apd('F-15', 'APD0014_qualification_highest_degree', 'APD.0014 hồ sơ đào tạo cá nhân của Mai Văn Tâm: "Trình độ chuyên môn" = bằng cao nhất (Thạc sĩ), dù có bằng Cao đẳng (2016) và Đại học (2020) mới hơn', pdf, 'pdf', pages=1)
finish('p6b', b)
