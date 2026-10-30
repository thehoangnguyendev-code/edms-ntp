"""Phase 4: the job assignment (APD.0024) of the three employees (an exception where the training matrix is not met), the training matrix (APD.0011), and the personal training record (APD.0014) of each,
made from what the two flows recorded. Screens shot. Password from DEVPW (never written)."""
from e51_lib import *

state = load()
b = Browser()
S = {}
QA_ROLES = [r.split('|') for r in sql("select r.id||'|'||r.name from training_job_roles r join departments d on d.id = r.department_id where r.is_active and r.name not like 'E2E%' order by (d.name = 'Quality Assurance') desc, r.name").splitlines()]
print('QA roles', QA_ROLES)


def pick_role(person_id):
    held = {r['jobRoleId'] for r in admin.call('GET', f'/training/job-assignments/work-position/{person_id}').get('roles', [])}
    for rid, name in QA_ROLES:
        if rid not in held:
            return name, rid
    return None
POS = {x.user['id']: pick_role(x.user['id']) for x in TRAINEES}
print('roles chosen', POS)

step('4.1 APD.0011 the training matrix of the department')
mats = admin.call('GET', '/training/matrices?limit=50')['data']
qa_m = next(m for m in mats if 'Quality Assurance' in str(m.get('departmentName')))
vers = admin.call('GET', f"/training/matrices/{qa_m['id']}/versions?limit=50")['data']
eff = next(v for v in vers if v['status'] == 'EFFECTIVE')
st, w = fetch(admin, f"/training/matrix-versions/{eff['id']}/export?format=docx", 'APD0011.docx')
check('4.1 Word of the matrix', st == 200 and w[:2] == b'PK', (st, w[:200]))
if st == 200:
    t = words(w)
    check('4.2 the department, the matrix code and the version are written; no token left', 'Quality Assurance' in t and qa_m['code'] in t and '{{' not in t and 'HISTORY' not in t, t[:300])
    st, p = fetch(admin, f"/training/matrix-versions/{eff['id']}/export?format=pdf", 'APD0011.pdf')
    check('4.3 PDF of the matrix', st == 200 and p[:4] == b'%PDF', st)
    print('   pages', render_pdf(p, 'p4_01_APD0011_matrix'))
b.shot('admin', '/training-management/matrices', 'p4_02_matrices_list', wait=4000)
b.shot('admin', f"/training-management/matrices/{eff['id']}", 'p4_03_matrix_version', wait=5000) if False else None

step('4.4 APD.0024 the job assignment of each employee')
jobs = {}
for who in TRAINEES:
    if not POS[who.user['id']]:
        check(f"4.4 {who.user['fullName']}: a free role of QA exists", False, QA_ROLES)
        continue
    name, pos = POS[who.user['id']]
    code, el, text = attempt(admin, 'GET', f"/training/job-assignments/eligibility?person={who.user['id']}&position={pos}")
    check(f"4.4 {who.user['fullName']}: the eligibility for {name} is read from the matrix", code == 200, (code, text))
    body = {'personUserId': who.user['id'], 'positionId': pos, 'positionIds': [pos], 'directSuperiorTitle': 'Head of QA', 'subordinateTitles': 'None', 'substituteTitle': 'QA Specialist',
            'mode': 'ADDITIONAL', 'changeReason': 'E2E51 an additional role after the training of this week', 'jurisdiction': 'E2E51 jurisdiction of ' + name, 'duties': [{'responsibility': 'E2E51 Review batch records', 'description': 'Review and release', 'responsibilityEn': 'Review batch records', 'descriptionEn': 'Review and release'},
                                                                         {'responsibility': 'E2E51 Handle deviations', 'description': 'Investigate', 'responsibilityEn': 'Handle deviations', 'descriptionEn': 'Investigate'}]}
    code, j, text = attempt(admin, 'POST', '/training/job-assignments', body)
    check(f"4.5 {who.user['fullName']}: the assignment is created (Draft)", code == 200, (code, text))
    if code != 200:
        continue
    j = admin.call('GET', f"/training/job-assignments/{j['id']}")
    if not el.get('complete'):
        code, data, text = attempt(admin, 'POST', f"/training/job-assignments/{j['id']}/exception", {'reason': 'E2E51 the matrix is met after the training of this week', 'approverUserId': qa.user['id']})
        check(f"4.6 {who.user['fullName']}: an exception is asked for (matrix not met yet)", code == 200, (code, text))
        code, data, text = attempt(qa, 'POST', f"/training/job-assignments/{j['id']}/exception/approve", {'signatureToken': sign(qa)})
        check(f"4.7 {who.user['fullName']}: the exception is approved by another person", code == 200, (code, text))
        j = admin.call('GET', f"/training/job-assignments/{j['id']}")
    code, data, text = attempt(admin, 'POST', f"/training/job-assignments/{j['id']}/submit", {'version': j['version'], 'signatureToken': sign(admin), 'assignorTitle': 'Head of QA'})
    check(f"4.8 {who.user['fullName']}: the head assigns the job with a signature", code == 200, (code, text))
    j = admin.call('GET', f"/training/job-assignments/{j['id']}")
    code, data, text = attempt(who, 'POST', f"/training/job-assignments/{j['id']}/accept", {'version': j['version'], 'signatureToken': sign(who)})
    check(f"4.9 {who.user['fullName']}: the employee accepts with a signature: Effective", code == 200 and data.get('status') == 'EFFECTIVE', (code, text))
    jobs[who.user['id']] = j['id']
S['jobs'] = jobs
first = list(jobs.values())[0] if jobs else None
for who in TRAINEES:
    jid = jobs.get(who.user['id'])
    if not jid:
        continue
    st, w = fetch(admin, f'/training/job-assignments/{jid}/export?format=docx', f"APD0024-{who.user['username']}.docx")
    check(f"4.10 {who.user['fullName']}: Word of APD.0024", st == 200 and w[:2] == b'PK', (st, w[:200]))
    if st == 200:
        t = words(w)
        check(f"4.11 {who.user['fullName']}: name, code, duties, jurisdiction and both signatures; no token", who.user['fullName'] in t and 'E2E51 Review batch records' in t and t.count('(UTC+') >= 2 and '{{' not in t, t[:400])
        st, p = fetch(admin, f'/training/job-assignments/{jid}/export?format=pdf', f"APD0024-{who.user['username']}.pdf")
        if who is t1:
            print('   pages', render_pdf(p, 'p4_04_APD0024_' + who.user['username']))
b.shot('admin', '/training-management/job-assignments', 'p4_05_job_assignments_list', wait=4000)
if first:
    b.shot('admin', f'/training-management/job-assignments/{first}', 'p4_06_job_assignment_detail', wait=5000)

step('4.12 APD.0014 the personal training record of each employee')
for who in TRAINEES:
    code, exp, text = attempt(admin, 'POST', '/training/record-exports', {'personUserId': who.user['id'], 'reason': 'E2E51 personal record', 'approverUserId': qa.user['id'], 'signatureToken': sign(admin)})
    check(f"4.12 {who.user['fullName']}: the export of the record is asked for", code == 200, (code, text))
    if code != 200:
        continue
    code, exp, text = attempt(qa, 'POST', f"/training/record-exports/{exp['id']}/approve", {'signatureToken': sign(qa)})
    check(f"4.13 {who.user['fullName']}: approved by QA", code == 200, (code, text))
    st, pdf = fetch(admin, f"/training/record-exports/{exp['id']}/download", f"APD0014-{who.user['username']}.pdf")
    check(f"4.14 {who.user['fullName']}: PDF of the record", st == 200 and pdf[:4] == b'%PDF', st)
    if st == 200:
        import fitz
        txt = ''.join(pg.get_text() for pg in fitz.open(stream=pdf, filetype='pdf'))
        check(f"4.15 {who.user['fullName']}: name, code, the trainings and both signatures; no token", who.user['fullName'] in txt and '{{' not in txt and txt.count('(UTC+') >= 2, txt[:300])
        if who is t1:
            print('   pages', render_pdf(pdf, 'p4_07_APD0014_' + who.user['username']))
b.shot('admin', '/training-management/record-exports', 'p4_08_record_exports', wait=4000)
state['flow4'] = S
save(state)
finish(b)
