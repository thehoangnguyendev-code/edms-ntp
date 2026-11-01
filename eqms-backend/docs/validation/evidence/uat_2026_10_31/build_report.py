"""Builds REPORT.md from index.json (pictures and APD files with their captions) and results.json (the checks of each phase). Plain python, no password needed. Run: python build_report.py"""
import json, os, re, sys
sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))
idx = json.load(open(os.path.join(HERE, 'index.json'), encoding='utf-8'))
res = json.load(open(os.path.join(HERE, 'results.json'), encoding='utf-8')) if os.path.exists(os.path.join(HERE, 'results.json')) else {}


def key(x):
    m = re.match(r'S(\d+)-(\d+)', x['id'])
    return (int(m.group(1)), int(m.group(2)), x['file']) if m else (99, 0, x['file'])


SCEN = {0: 'Chuẩn bị', 1: 'Kịch bản 1 — nâng revision của Document, publish sang Effective khi còn người vắng / trượt / nghỉ việc',
        2: 'Kịch bản 2 — activity không từ tài liệu, 10 nhân sự, 3 phòng', 3: 'Kịch bản 3 — bổ nhiệm nhân viên QC thêm 2 chức danh (ràng buộc đào tạo)',
        4: 'Kịch bản 4 — xử lý người nghỉ việc, đào tạo bù và đào tạo lại', 5: 'Kịch bản 5 — tự đọc và ký điện tử xác nhận của nhân viên'}
out = ['# Báo cáo UAT Training Management — 2026-10-31', '', 'Mỗi ảnh có tên file chính xác và chú thích. Ảnh nằm trong `shots/`, file APD do hệ thống xuất nằm trong `apd/`.', '']
tot = sum(len(v) for v in res.values())
bad = [(p, dict(c, detail=c.get('resolution', c['detail']))) for p, v in res.items() for c in v if not c['ok'] and (not c.get('resolution') or c.get('open'))]
fixed = [(p, c) for p, v in res.items() for c in v if not c['ok'] and c.get('resolution') and not c.get('open')]
out += [f'**Kiểm tra tự động:** {tot - len(bad) - len(fixed)}/{tot} đạt ngay lần chạy; {len(fixed)} điểm không đạt đã được phân tích và xử lý (bên dưới); {len(bad)} điểm không đạt còn mở.', '']
for p, c in bad:
    out.append(f'- KHÔNG ĐẠT / CHỜ QUYẾT ĐỊNH ({p}): {c["check"]} — {c["detail"][:600]}')
if fixed:
    out += ['', '### Điểm không đạt đã phát hiện trong lúc test và cách xử lý', '']
    for p, c in fixed:
        out.append(f'- **{c["check"][:90]}** ({p}): {c["resolution"]}')
out.append('')
cur = None
for x in sorted([y for y in idx if y['kind'] == 'shot'], key=key):
    s = key(x)[0]
    if s != cur:
        cur = s
        out += ['', f'## {SCEN.get(s, "Khác")}', '']
    out += [f'### {x["file"]}', '', f'*{x["caption"]}*', '', f'![{x["file"]}](shots/{x["file"]})', '']
out += ['', '## Các file APD do hệ thống xuất (bản cuối)', '']
for x in sorted([y for y in idx if y['kind'] == 'apd'], key=key):
    out.append(f'- `apd/{x["file"]}` — {x["caption"]}')
out.append('')
open(os.path.join(HERE, 'REPORT.md'), 'w', encoding='utf-8').write('\n'.join(out))
print('REPORT.md written:', len([y for y in idx if y['kind'] == 'shot']), 'pictures,', len([y for y in idx if y['kind'] == 'apd']), 'APD files')
