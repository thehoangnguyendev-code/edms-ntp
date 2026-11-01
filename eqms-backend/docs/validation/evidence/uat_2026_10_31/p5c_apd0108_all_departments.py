"""Scenario 5, part c: APD.0108 of the self-reading (scenario 5) for each department, saved under its own name (the first run saved the three files of the zip under one name, so only the last one was kept)."""
from flows31 import *
import zipfile as _zip

state = load()
S = state['s5']
sid = S['sid']
tag = {'QA': 'Quality_Assurance', 'QC': 'Quality_Control', 'PROD': 'Production'}
for fmt in ('docx', 'pdf'):
    st, body = get_bytes(admin, f'/training/sessions/{sid}/self-reading-list?format={fmt}')
    check(f'S5c.1 APD.0108 ({fmt}) downloads', st == 200, st)
    z = _zip.ZipFile(io.BytesIO(body))
    names = z.namelist()
    check(f'S5c.2 the zip holds one {fmt} file for each of the three departments', len(names) == 3, names)
    for n in names:
        key = next((k for k in tag if re.search(r'-' + k + r'\.', n)), None)
        data = z.read(n)
        save_apd('S5-08', 'APD0108_' + tag[key], f'APD.0108 danh sách tự đọc phòng {tag[key].replace("_", " ")} ({fmt}): chữ ký điện tử của từng nhân viên, người ghi Vắng mặt (nghỉ việc / nghỉ dài hạn), xác nhận và nhận xét của trưởng bộ phận', data, fmt, pages=2)
        text = pdf_text(data) if fmt == 'pdf' else words(data)
        norm = lambda x: ''.join(ch for ch in x.lower() if ch.isalnum() and ch not in 'of')
        if key == 'QC':
            check('S5c.3 QC: the person who left is "Vắng mặt", the signed people and the head are written', 'Vắng mặt' in text and norm(name_of('uat31.s2.qc.pass')) in norm(text) and norm(name_of('uat31.head.qc')) in norm(text), text[:200])
        if key == 'QA':
            check('S5c.4 QA: the person on long leave is "Vắng mặt", the signed people and the head are written', 'Vắng mặt' in text and norm(name_of('uat31.s2.qa.pass')) in norm(text) and norm(name_of('uat31.head.qa')) in norm(text), text[:200])
        if key == 'PROD':
            check('S5c.5 PROD: the signed person and the head are written', norm(name_of('uat31.s2.pr.fail')) in norm(text) and norm(name_of('uat31.head.prod')) in norm(text), text[:200])
# the old single file that held only the last department is removed from the folder and the index
import os as _os
for f in ('S5-08__APD0108_dept.docx', 'S5-08__APD0108_dept.pdf'):
    p = _os.path.join(APDDIR, f)
    if _os.path.exists(p):
        _os.remove(p)
idx = json.load(open(INDEX, encoding='utf-8'))
idx = [x for x in idx if 'APD0108_dept' not in x['file']]
json.dump(idx, open(INDEX, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
finish('p5c')
