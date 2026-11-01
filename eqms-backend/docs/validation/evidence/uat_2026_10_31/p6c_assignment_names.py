"""Corrections of 2026-10-31, part c: APD.0024 keeps its two notes; the superior, the subordinates and the substitute are people written "Name (Position)" chosen in the screen; the dotted lines of the
jurisdiction go when the jurisdiction is written."""
from flows31 import *
state = load(); S = state.setdefault('f6c', {}); s3 = state['s3']; b = Browser()
norm = lambda x: ''.join(ch for ch in x.lower() if ch.isalnum() and ch not in 'of')
ppl = admin.call('GET', '/training/people?search=Hoang') if False else None
people = admin.call('GET', '/training/people?search=UAT&limit=5')
people = people if isinstance(people, list) else people.get('data', people)
print('people lookup sample:', [(x['fullName'], x.get('position')) for x in people[:3]])
if 'ja' not in S:
    sup, sub, rep = '%s (%s)' % ('Tạ Văn Hùng (UAT)', 'QC Manager'), 'Nguyễn Văn An (UAT) (QC Analyst); Trần Thị Bình (UAT) (QC Analyst)', 'Đỗ Thị Lan (UAT) (QC Analyst)'
    body = {'personUserId': uid('uat31.s2.qc.pass'), 'positionIds': [s3['micro']], 'directSuperiorTitle': sup, 'subordinateTitles': sub, 'substituteTitle': rep, 'jurisdiction': 'UAT31 microbiological testing of water',
            'duties': [{'responsibility': 'Kiểm nghiệm vi sinh', 'description': 'Kiểm nghiệm nước', 'responsibilityEn': 'Microbiological testing', 'descriptionEn': 'Water testing'}]}
    c, j, t = attempt(admin, 'POST', '/training/job-assignments', body)
    check('F-16.1 a draft with people as superior, subordinates and substitute', c == 200, (c, t[:200]))
    S['ja'] = j['id']; state['f6c'] = S; save(state)
st, pdf = get_bytes(admin, f"/training/job-assignments/{S['ja']}/export?format=pdf")
check('F-16.2 APD.0024 is produced', st == 200 and pdf[:4] == b'%PDF', st)
if st == 200:
    import fitz
    txt = pdf_text(pdf)
    d = fitz.open(stream=pdf, filetype='pdf')
    full = ''.join(p.get_text() for p in d)
    check('F-16.3 the two notes of the form are kept', 'In case the person receiving the job is the head' in full and 'In case the' in full.split('head of deparment')[-1], '')
    check('F-16.4 the superior, the subordinates and the substitute are written Name (Position)', all(norm(x) in norm(full) for x in ('Tạ Văn Hùng (UAT) (QC Manager)', 'Nguyễn Văn An (UAT) (QC Analyst)', 'Đỗ Thị Lan (UAT) (QC Analyst)')), full[:900])
    check('F-16.6 the code in the header is the code of the form with the revision in force (APD.0024.0n), not the employee code', re.search(r'APD\.0024\.0\d', full) is not None and 'UAT31-' not in full.split('Code')[1][:30], full[:200])
    check('F-16.5 no dotted line is left under the jurisdiction', '.......' not in full, '')
    save_apd('F-16', 'APD0024_names_notes_kept_no_dots', 'APD.0024: cấp trên / cấp dưới / người thay thế là tên người dùng dạng "Tên (Chức vụ)"; Quyền hạn đã điền nên bỏ các dòng chấm; hai ghi chú cuối biểu mẫu được giữ nguyên', pdf, 'pdf', pages=2)
b.shot('admin', f"/training-management/job-assignments/{S['ja']}", 'F-17', 'Job_assignment_people_pickers', 'Job Assignment bản nháp: Cấp trên / Cấp dưới / Người thay thế chọn người dùng, hiển thị "Tên (Chức vụ)"')
pg = b.page('admin')
try:
    sel = pg.get_by_label('Job title of direct superior').first
    sel.click(); pg.wait_for_timeout(1500)
    b.shot('admin', None, 'F-18', 'Direct_superior_dropdown_Name_Position', 'Mở danh sách chọn "Job title of direct superior": mỗi người hiển thị dạng "Tên (Chức vụ)"')
except Exception as e:
    print('dropdown shot:', str(e)[:150])
finish('p6c', b)
