"""Phase 0: the six APD templates written with tokens (Training Annex) are uploaded as a new version and enabled, as the screens do; the screens are shot."""
import os
from e51_lib import *

# the revision in force of each form in Document Control (the files in docs/training_docs): the code of the form is written from it, for example APD.0024.02
REV = {'APD.0011': '2.0.0', 'APD.0014': '2.0.0', 'APD.0024': '2.0.0', 'APD.0108': '1.0.0', 'APD.0117': '1.0.0', 'APD.0118': '1.0.0'}
TITLES = {'APD.0011': 'Training matrix', 'APD.0014': 'Personal training record', 'APD.0024': 'Job assignment', 'APD.0108': 'List of personnel for SOP self-reading',
          'APD.0117': 'Training attendance sheet', 'APD.0118': 'Training requirement'}
SRC = r'D:\edms-project\docs\training_docs\annex-tokenized'

step('0.1 each tokenized template is uploaded, checked, and enabled')
for code, title in TITLES.items():
    VER = REV[code]
    taken = {t['versionLabel'] for t in admin.call('GET', f'/training/form-templates?search={code}&limit=100')['data'] if t['code'] == code}
    while VER in taken and not os.environ.get('E51_REUSE'):
        a, b, c = (VER.split('.') + ['0', '0'])[:3]
        VER = f'{a}.{b}.{int(c) + 1}'
    mine = [t for t in admin.call('GET', f'/training/form-templates?search={code}&limit=100')['data'] if t['code'] == code and t['versionLabel'] == VER]
    if not mine:
        with open(os.path.join(SRC, code + '.docx'), 'rb') as f:
            mine = [admin.upload('/training/form-templates', 'file', code + '.docx', f.read(), DOCX, f'?code={code}&title={title.replace(" ", "%20")}&versionLabel={VER}&remark=E2E51%20tokenized%20starter')]
    t = mine[0]
    check(f'0.1 {code}: the upload is checked against the contract', t.get('tokenMode') == 'TOKENS' and not t.get('checkProblems'), (t.get('tokenMode'), t.get('checkProblems')))
    if t['status'] != 'ENABLED':
        t = admin.call('POST', f"/training/form-templates/{t['id']}/enable", {'signatureToken': sign(admin), 'reason': 'E2E51 tokenized template'})
    check(f'0.1 {code}: enabled', t['status'] == 'ENABLED', t['status'])

step('0.2 the list says Active for each, and the menu follows the state')
page = admin.call('GET', '/training/annex?limit=20')
for r in page['data']:
    if r['code'] in TITLES:
        check(f"0.2 {r['code']}: Active, tokens, actions", r['status'] == 'ACTIVE' and r['tokenMode'] == 'TOKENS' and r['actions']['disable'] is True, r)

step('0.3 the screens')
b = Browser()
b.shot('admin', '/settings/administration/training/annex', 'p0_01_annex_list')
b.shot('admin', '/settings/administration/training/annex/APD.0117', 'p0_02_annex_view_apd0117', wait=9000)
b.shot('admin', '/settings/administration/training/annex/APD.0117/edit', 'p0_03_annex_edit_apd0117', wait=6000)
finish(b)
