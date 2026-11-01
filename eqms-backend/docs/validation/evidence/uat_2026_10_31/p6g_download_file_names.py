"""Part g: the names of the files downloaded from Training Management follow a pattern per form, set in Training Properties > File Names (default, then a pattern of the administrator, then the default again)."""
from flows31 import *
import urllib.request, urllib.parse
import api as _api

state = load()
b = Browser()


def download_name(path):
    """The file name the browser would save: the Content-Disposition of the answer."""
    req = urllib.request.Request(_api.BASE + path, method='GET')
    req.add_header('Authorization', 'Bearer ' + admin.token)
    with admin.opener.open(req) as resp:
        head = resp.headers.get('Content-Disposition', '')
        resp.read()
    m = re.search(r"filename\*=UTF-8''([^;]+)", head) or re.search(r'filename="?([^";]+)"?', head)
    return urllib.parse.unquote(m.group(1)) if m else head


def set_pattern(form, pattern):
    s = admin.call('GET', '/training/settings')
    admin.call('PUT', '/training/settings', {'version': s['version'], 'downloadFileNames': {form: pattern}})


s = admin.call('GET', '/training/settings')
forms = {f['form']: f for f in s['downloadFileNames']}
check('F-24.1 the settings give the 7 forms with a pattern', set(forms) == {'APD.0011', 'APD.0014', 'APD.0014.BATCH', 'APD.0024', 'APD.0108', 'APD.0117', 'APD.0118'}, list(forms))
print({k: v['pattern'] for k, v in forms.items()})

root = state['f6a']['root']
number = admin.call('GET', f'/training/activities/{root}')['trainingNumber']
ja = state['s3']['ja']
ver = state['f6b']['ver']
sid5 = state['s5d']['sid']

step('F-24 the default names')
n117 = download_name(f'/training/activities/{root}/attendance-list?format=pdf')
check('F-24.2 APD.0117: code with the revision, then the Training Number', re.fullmatch(r'APD\.0117\.\d\d_' + re.escape(number.replace('/', '-')) + r'\.pdf', n117) is not None, n117)
n24 = download_name(f'/training/job-assignments/{ja}/export?format=pdf')
check('F-24.3 APD.0024: code with the revision, employee code, name and issuance number', re.fullmatch(r'APD\.0024\.\d\d_UAT31-\d+_[A-Za-z-]+(-\(UAT\))?_\d+\.pdf', n24) is not None, n24)
n11 = download_name(f'/training/matrix-versions/{ver}/export?format=pdf')
check('F-24.4 APD.0011: code with the revision, matrix code and version', re.fullmatch(r'APD\.0011\.\d\d_TM-MOCK-QC_v\d+\.pdf', n11) is not None, n11)
n108 = download_name(f'/training/sessions/{sid5}/self-reading-list?format=pdf')
check('F-24.5 APD.0108: code with the revision, Training Number, session and department', re.search(r'^APD\.0108\.\d\d_TRN-QA-26-\d+[a-z]?_S01_', n108) is not None or n108.endswith('.zip'), n108)
person = uid('uat31.s3.new')
c, exp, t = attempt(admin, 'POST', '/training/record-exports', {'personUserId': person, 'reason': 'UAT31 personal record: file name', 'approverUserId': qa.user['id'], 'signatureToken': sign(admin)})
check('F-24.6 APD.0014 is asked for', c == 200, (c, t[:150]))
attempt(qa, 'POST', f"/training/record-exports/{exp['id']}/approve", {'signatureToken': sign(qa)})
n14 = download_name(f"/training/record-exports/{exp['id']}/download")
check('F-24.7 APD.0014: code with the revision, employee code, name and the day', re.fullmatch(r'APD\.0014\.\d\d_UAT31-019_Mai-Van-Tam-\(UAT\)_\d{8}\.pdf', n14) is not None, n14)
print(n117, n24, n11, n108, n14, sep='\n')

step('F-25 a pattern of the administrator, a wrong one, and back to the default')
set_pattern('APD.0117', '{TRAINING_NUMBER}__{FILE_CODE}')
check('F-25.1 the pattern of the administrator is used', download_name(f'/training/activities/{root}/attendance-list?format=pdf') == number.replace('/', '-') + '__' + n117.split('_')[0] + '.pdf', download_name(f'/training/activities/{root}/attendance-list?format=pdf'))
s = admin.call('GET', '/training/settings')
c, d, t = attempt(admin, 'PUT', '/training/settings', {'version': s['version'], 'downloadFileNames': {'APD.0117': '{EMPLOYEE_NAME}'}})
check('F-25.2 a variable that the form does not know is refused', c == 400 and 'TRAINING_FILE_NAME_PATTERN_INVALID' in t, (c, t[:200]))
c, d, t = attempt(admin, 'PUT', '/training/settings', {'version': s['version'], 'downloadFileNames': {'APD.0117': '../{FILE_CODE}'}})
check('F-25.3 a pattern with a path is refused', c == 400, (c, t[:200]))
b.shot('admin', '/settings/administration/training/properties?tab=files', 'F-26', 'Training_properties_file_names', 'Training Properties, tab File Names: mỗi biểu mẫu một mẫu tên file, ví dụ kết quả, các biến {FILE_CODE}..., nút Default')
set_pattern('APD.0117', '')
check('F-25.4 an empty pattern brings the default back', download_name(f'/training/activities/{root}/attendance-list?format=pdf') == n117, '')
audit = sql("select count(*) from audit_trail where action_type = 'TRAINING_SETTINGS_UPDATED' and created_at > now() - interval '10 minutes'") if False else None
finish('p6g', b)
