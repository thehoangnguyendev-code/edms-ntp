"""DEV: the watermark of the preview settings is on the PDF that the system makes for a person to look at, and only on that: the attendance list asked as a preview, the preview of an assessment, the preview of a
material; the file that is downloaded (the same endpoint without preview) and the test copies have none. Needs PyMuPDF. The password comes from DEVPW."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import fitz
from api import Client
from e2e21_matrix import check, admin, results, mini_pdf


def text(pdf):
    d = fitz.open(stream=pdf, filetype='pdf')
    return ' '.join(p.get_text() for p in d)


acts = admin.call('GET', '/training/activities?limit=50')['data']
act = next(a for a in acts if a['status'] in ('IN_PROGRESS', 'NOTIFIED', 'COMPLETED', 'PENDING_QA_CONFIRMATION'))
st, plain = admin.call('GET', f"/training/activities/{act['id']}/attendance-list?format=pdf", raw=True)
st2, marked = admin.call('GET', f"/training/activities/{act['id']}/attendance-list?format=pdf&preview=true", raw=True)
check('1 the attendance list is made as a PDF both ways', st == 200 and st2 == 200 and plain[:4] == b'%PDF' and marked[:4] == b'%PDF', (st, st2))
tp, tm = text(plain), text(marked)
check('2 the PDF of the preview has the watermark and the one that is downloaded has none', 'PREVIEW' in tm.upper() and 'PREVIEW' not in tp.upper(), (tm[-200:], tp[-100:]))
check('3 the preview carries the name or code of the viewer when the settings ask for it (or nothing more than the text)', len(tm) >= len(tp), (len(tm), len(tp)))
lib = admin.call('GET', '/training/assessments?limit=5')['data']
a = admin.call('GET', f"/training/assessments/{lib[0]['id']}")
body = {'title': a['title'], 'kind': a['kind'], 'durationMinutes': a.get('durationMinutes'), 'key': False,
        'items': [{'kind': i['kind'], 'prompt': i['prompt'], 'options': [{'text': o['text']} for o in i['options']], 'correct': i['correct'], 'points': i['points'], 'modelAnswer': i.get('modelAnswer')} for i in a['items']]}
st, pdf = admin.call('POST', '/training/assessments/preview', body, raw=True)
check('4 the preview of an assessment has the watermark', st == 200 and 'PREVIEW' in text(pdf).upper(), (st, text(pdf)[-150:]))
body['sideBySide'] = True
st, both = admin.call('POST', '/training/assessments/preview', body, raw=True)
d = fitz.open(stream=both, filetype='pdf')
d1 = fitz.open(stream=pdf, filetype='pdf')
check('5 the side by side paper is ONE PDF with the pages two papers wide, with the watermark', st == 200 and d.page_count >= 1 and d[0].rect.width > 1.8 * d1[0].rect.width and 'PREVIEW' in text(both).upper(), (st, d[0].rect.width, d1[0].rect.width))
txt = text(both)
check('6 it holds the paper and the answer key together', 'ANSWER KEY' in txt.upper() or 'ĐÁP ÁN' in txt.upper(), txt[:200])
d[0].get_pixmap(dpi=60).save(os.environ.get('E2E_OUT', '.') + os.sep + 'preview-side-by-side.png')
print(sum(1 for r in results if r[1]), 'of', len(results), 'checks passed')
