"""DEV: the layout of the items of an assessment (APD.0009): the answers of a question one under the other or in two columns, and the number of ruled lines of an essay question. The author chooses
them in the editor; the server stores them, gives them back, keeps them in a new version, refuses a number of lines out of 1 to 30, and the paper drawn from the editor is made. The password comes from DEVPW.
Records are named "E2E-TEST ..."; none is deleted."""
import os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
from e2e21_matrix import admin, check, attempt, results

stamp = str(int(time.time()))[-6:]
items = [
    {'kind': 'SINGLE', 'prompt': 'Câu 1 hai cột', 'options': [{'text': '4 nhóm'}, {'text': '3 nhóm'}, {'text': '2 nhóm'}, {'text': '1 nhóm'}], 'correct': ['B'], 'points': 2, 'optionLayout': 'TWO_COLUMNS'},
    {'kind': 'MULTI', 'prompt': 'Câu 2 chiều dọc', 'options': [{'text': 'Một'}, {'text': 'Hai'}, {'text': 'Ba'}], 'correct': ['A', 'C'], 'points': 2},
    {'kind': 'ESSAY', 'prompt': 'Câu 3 tự luận năm dòng', 'options': [], 'correct': [], 'points': 6, 'answerLines': 5},
    {'kind': 'ESSAY', 'prompt': 'Câu 4 tự luận mặc định', 'options': [], 'correct': [], 'points': 2},
]
code, a, raw = attempt(admin, 'POST', '/training/assessments', {'name': f'E2E-TEST layout {stamp}', 'kind': 'QUESTIONS', 'durationMinutes': 30, 'items': items})
check('1.1 the assessment is created with the layout of its items', code == 200, raw)
d = admin.call('GET', f"/training/assessments/{a['id']}")
it = {i['no']: i for i in d['items']}
check('1.2 the answers in two columns are kept', it[1]['optionLayout'] == 'TWO_COLUMNS', it[1])
check('1.3 the answers one under the other are the default', it[2]['optionLayout'] == 'VERTICAL', it[2])
check('1.4 the lines of an essay are kept, and empty means the default of the form', it[3]['answerLines'] == 5 and it[4]['answerLines'] is None, (it[3], it[4]))
bad = [dict(items[2], answerLines=31)]
code, d2, raw = attempt(admin, 'POST', '/training/assessments', {'name': f'E2E-TEST layout bad {stamp}', 'kind': 'QUESTIONS', 'items': bad})
check('1.5 more than 30 lines is refused (400)', code == 400, (code, raw))
code, d3, raw = attempt(admin, 'POST', '/training/assessments', {'name': f'E2E-TEST layout bad {stamp}', 'kind': 'QUESTIONS', 'items': [dict(items[2], answerLines=0)]})
check('1.6 less than one line is refused (400)', code == 400, (code, raw))
# a layout given for an essay or a number of lines for a question to choose from is not kept
code, mixed, raw = attempt(admin, 'POST', '/training/assessments', {'name': f'E2E-TEST layout mixed {stamp}', 'kind': 'QUESTIONS', 'items': [dict(items[0], answerLines=7), dict(items[2], optionLayout='TWO_COLUMNS')]})
m = admin.call('GET', f"/training/assessments/{mixed['id']}")['items'] if code == 200 else []
check('1.7 the lines are kept only for an essay and the layout only for a question to choose from', code == 200 and m[0]['answerLines'] is None and m[1]['optionLayout'] == 'VERTICAL', m)
st, pdf = admin.call('POST', '/training/assessments/preview', {'name': 'E2E-TEST preview', 'kind': 'QUESTIONS', 'durationMinutes': 30, 'items': items, 'key': False}, raw=True)
check('1.8 the paper drawn from the editor is made as a PDF', st == 200 and pdf[:4] == b'%PDF', (st, pdf[:20]))
print(sum(1 for r in results if r[1]), 'of', len(results), 'checks passed')
