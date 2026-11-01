"""Scenario 3, part b: a QC employee (Mai Van Tam) is appointed to TWO more Work Positions, QC Microbiology and QC Physicochemistry (APD.0024). The appointment cannot be signed until the trainings that the matrix
assigns to the two positions are passed: (1) the topic of QC Microbiology (he FAILS the test first, is retrained and passes), (2) the topic of QC Physicochemistry (test), (3) the document SOP (self-reading with the
e-signature of the employee and the confirmation of the head). Then the head signs the assignment and the employee accepts with an e-signature. Shots and APD files are named S3-xx."""
from flows31 import *

state = load()
S = state['s3']
P = 'uat31.s3.new'
person = uid(P)
b = Browser()
JA = f"/training-management/job-assignments"


def elig():
    e = admin.call('GET', f"/training/job-assignments/eligibility?person={person}&position={S['micro']}")
    e2 = admin.call('GET', f"/training/job-assignments/eligibility?person={person}&position={S['phys']}")
    miss = {i['title'] for el in (e, e2) for i in el.get('items', []) if i.get('lastDone') is None}
    return miss


def classroom_single(topic, score, exam, tag, parent=None):
    """A one-person classroom training with a test. Returns (aid, sid, pid)."""
    if parent:
        a = admin.call('POST', f'/training/activities/{parent}/supplementary', {'participantIds': [parent_pid], 'reason': 'UAT31 retraining after the failed test'})
        aid = a['id']
        sid, pid = run_to_start(aid, 'CLASSROOM', 'TEST', None, topic, exam=exam)
        pid = pid[P]
    else:
        a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'dueDate': (TODAY + datetime.timedelta(days=30)).isoformat()})
        aid = a['id']
        sid, pid = run_to_start(aid, 'CLASSROOM', 'TEST', [P], topic, exam=exam)
        pid = pid[P]
    code, d, t = attempt(admin, 'POST', f'/training/participants/{pid}/attendance', {'state': 'ATTENDED'})
    check(f'{tag} attendance', code == 200, (code, t))
    code, d, t = attempt(admin, 'POST', f'/training/participants/{pid}/assessments', {'scoreObtained': score, 'scoreMax': 10, 'remarks': 'UAT31 ' + tag})
    check(f'{tag} score {score}/10', code == 200, (code, t))
    a = get(aid)
    code, d, t = attempt(admin, 'POST', f'/training/activities/{aid}/send-attendance-list', {'version': a['version'], 'signatureToken': sign(admin)})
    f, c = finish_and_confirm(aid)
    check(f'{tag} finished and confirmed by QA', f[0] == 200 and c[0] == 200 and get(aid)['status'] == 'COMPLETED', (f[2], c[2]))
    return aid, sid, pid


step('S3-b.1 the appointment of two positions: a draft is made and the check shows what is missing')
if 'ja' not in S:
    body = {'personUserId': person, 'positionIds': [S['micro'], S['phys']], 'directSuperiorTitle': 'Head of Quality Control', 'subordinateTitles': 'None', 'substituteTitle': 'QC Supervisor',
            'jurisdiction': 'UAT31 QC Microbiology and QC Physicochemistry',
            'duties': [{'responsibility': 'Thực hiện kiểm nghiệm vi sinh theo SOP', 'description': 'Kiểm nghiệm vi sinh, giám sát môi trường', 'responsibilityEn': 'Perform microbiological testing per SOP', 'descriptionEn': 'Microbiological testing and environmental monitoring'},
                       {'responsibility': 'Thực hiện kiểm nghiệm hoá lý theo SOP', 'description': 'Kiểm nghiệm hoá lý, vận hành HPLC', 'responsibilityEn': 'Perform physicochemical testing per SOP', 'descriptionEn': 'Physicochemical testing, HPLC operation'}]}
    code, j, t = attempt(admin, 'POST', '/training/job-assignments', body)
    if not check('S3-b.1 the draft of the assignment is created', code == 200, (code, t)):
        finish('p3c', b)
    S['ja'] = j['id']
    save(state)
ja = S['ja']
miss = elig()
check('S3-b.2 three trainings are missing before any training', len(miss) == 3, miss)
b.shot('admin', f'{JA}/{ja}', 'S3-05', 'Job_assignment_draft_missing_trainings', 'Job Assignment (APD.0024) bản nháp của Mai Văn Tâm: 2 vị trí QC Microbiology + QC Physicochemistry, kiểm tra điều kiện đào tạo: 3 đào tạo còn thiếu')

step('S3-b.3 the head cannot sign while the trainings are missing')
j = admin.call('GET', f'/training/job-assignments/{ja}')
code, d, t = attempt(admin, 'POST', f'/training/job-assignments/{ja}/submit', {'version': j['version'], 'signatureToken': sign(admin), 'assignorTitle': 'Head of Quality Control'})
check('S3-b.3 signing is refused: TRAINING_MATRIX_INCOMPLETE', code == 409 and 'TRAINING_MATRIX_INCOMPLETE' in t, (code, t))

step('S3-b.4 training 1 (QC Microbiology): the employee FAILS the test')
if 'aidA' not in S:
    aidA, sidA, pidA = classroom_single(S['topic_micro'], 4, 'UAT31 test of aseptic technique', 'S3-b.4')
    S.update(aidA=aidA, sidA=sidA, pidA=pidA)
    save(state)
aidA = S['aidA']
check('S3-b.5 the failed test leaves the training missing: the appointment is still blocked', S['topic_micro'] in elig(), elig())
check('S3-b.6 a work-suspension flag is raised for the failed test', sql(f"select count(*) from training_work_suspensions where person_user_id='{person}' and status='OPEN'") != [['0']], sql(f"select count(*) from training_work_suspensions where person_user_id='{person}'"))
b.shot('admin', f'/training-management/activities/{aidA}', 'S3-06', 'Training_A_failed_participants', 'Đào tạo chủ đề QC Microbiology: Mai Văn Tâm trượt bài kiểm tra (4/10, Failed)', action=tab('Participants'))

step('S3-b.7 retraining of the failed employee (supplementary activity) and the new test passes')
if 'aidA2' not in S:
    parent_pid = S['pidA']
    aidA2, sidA2, pidA2 = classroom_single(S['topic_micro'], 9, 'UAT31 retest of aseptic technique', 'S3-b.7', parent=aidA)
    S.update(aidA2=aidA2, sidA2=sidA2, pidA2=pidA2)
    save(state)
aidA2 = S['aidA2']
a2 = get(aidA2)
print('retraining:', a2['trainingNumber'], a2['status'], a2.get('kind'), a2.get('kindReason'))
check('S3-b.8 the retraining keeps the number of the original with a letter', a2['trainingNumber'].startswith(get(aidA)['trainingNumber']) and a2['trainingNumber'] != get(aidA)['trainingNumber'], a2['trainingNumber'])
check('S3-b.9 the topic of QC Microbiology is no longer missing', S['topic_micro'] not in elig(), elig())
check('S3-b.10 the work-suspension flag of the failed test is cleared by the pass', sql(f"select count(*) from training_work_suspensions where person_user_id='{person}' and status='OPEN'") == [['0']], sql(f"select status, count(*) from training_work_suspensions where person_user_id='{person}' group by 1"))
b.shot('admin', f'/training-management/activities/{aidA2}', 'S3-07', 'Training_A_retraining_passed', f"Đào tạo lại {a2['trainingNumber']} (số gốc + chữ cái): Mai Văn Tâm đạt 9/10", action=tab('Participants'))

step('S3-b.11 training 2 (QC Physicochemistry): the test passes')
if 'aidB' not in S:
    aidB, sidB, pidB = classroom_single(S['topic_phys'], 8, 'UAT31 test of HPLC operation', 'S3-b.11')
    S.update(aidB=aidB)
    save(state)
check('S3-b.12 the topic of QC Physicochemistry is no longer missing; the SOP is still missing', S['topic_phys'] not in elig() and elig() == {'UAT31 SOP Handling of QC samples'}, elig())

step('S3-b.13 training 3 (the SOP document): self-reading with the e-signature of the employee and the confirmation of the head')
if 'aidC' not in S:
    a = admin.call('POST', '/training/activities', {'kind': 'UNPLANNED', 'kindReason': 'OTHER', 'dueDate': (TODAY + datetime.timedelta(days=30)).isoformat()})
    aidC = a['id']
    sidC, pidC = run_to_start(aidC, 'SELF_READING', 'SELF_READING_CONFIRMATION', [P], 'UAT31 SOP Handling of QC samples, revision 2', rid=state['s1']['rid2'])
    S.update(aidC=aidC, sidC=sidC, pidC=pidC[P])
    save(state)
aidC, sidC, pidC = S['aidC'], S['sidC'], S['pidC']
b.shot(P, '/training-management/my-training', 'S3-08', 'My_Training_employee_to_read', 'My Training của Mai Văn Tâm: SOP cần đọc và xác nhận bằng chữ ký điện tử')
bad = self_reading_all(aidC, sidC, {P: pidC}, 'uat31.head.qc', reason='UAT31 I read SOP Handling of QC samples and understood it')
check('S3-b.13 the employee signs the reading, the head of Quality Control confirms', not bad, bad)
f, c = finish_and_confirm(aidC)
check('S3-b.14 the self-reading is finished and confirmed by QA', f[0] == 200 and c[0] == 200 and get(aidC)['status'] == 'COMPLETED', (f[2], c[2]))
check('S3-b.15 nothing is missing now', elig() == set(), elig())

step('S3-b.16 the head signs the assignment, the employee accepts with an e-signature')
j = admin.call('GET', f'/training/job-assignments/{ja}')
ALREADY = j['status'] == 'EFFECTIVE'
print('eligibility on the assignment:', {k: (j.get('eligibility') or {}).get(k) for k in ('complete', 'missingCount')})
if not ALREADY:
    code, d, t = attempt(admin, 'POST', f'/training/job-assignments/{ja}/submit', {'version': j['version'], 'signatureToken': sign(admin), 'assignorTitle': 'Head of Quality Control'})
    check('S3-b.16 the head signs: the assignment now waits for the employee', code == 200, (code, t))
if not ALREADY:
  b.shot('admin', f'{JA}/{ja}', 'S3-09', 'Job_assignment_pending_receiver', 'Job Assignment sau khi trưởng bộ phận ký: chờ nhân viên nhận (Pending Receiver); không còn đào tạo thiếu')
emp = U(P)
j = emp.call('GET', f'/training/job-assignments/{ja}')
if not ALREADY:
    code, d, t = attempt(emp, 'POST', f'/training/job-assignments/{ja}/accept', {'version': j['version'], 'signatureToken': sign(emp)})
    check('S3-b.17 the employee accepts with an e-signature: Effective', code == 200 and d.get('status') == 'EFFECTIVE', (code, t))
held = sql(f"select string_agg(r.name, ' | ' order by r.name) from training_person_positions pp join training_job_roles r on r.id = pp.position_id where pp.person_user_id='{person}' and pp.valid_to is null")
print('positions held:', held)
held_txt = ' '.join(held[0]) if held else ''
check('S3-b.18 the employee now holds both Work Positions', 'QC Microbiology' in held_txt and 'QC Physicochemistry' in held_txt, held)
b.shot('admin', f'{JA}/{ja}', 'S3-10', 'Job_assignment_effective', 'Job Assignment Effective: Mai Văn Tâm giữ 2 vị trí QC Microbiology và QC Physicochemistry')
b.shot('admin', JA, 'S3-11', 'Job_assignments_list_after', 'Danh sách Job Assignments sau khi bổ nhiệm', tall=False)

step('S3-b.19 APD.0024 and the personal training record APD.0014')
st, w = get_bytes(admin, f'/training/job-assignments/{ja}/export?format=docx')
check('S3-b.19 APD.0024 as Word', st == 200 and w[:2] == b'PK', st)
if st == 200:
    save_apd('S3-12', 'APD0024_job_assignment_Mai_Van_Tam', 'APD.0024 bản giao việc / bổ nhiệm Mai Văn Tâm: QC Microbiology + QC Physicochemistry (2 chữ ký điện tử)', w, 'docx')
    t = words(w)
    check('S3-b.20 name, both positions, the duties and the signatures are written', name_of(P) in t and 'QC Microbiology' in t and 'QC Physicochemistry' in t and t.count('(UTC+') >= 2 and '{{' not in t, t[:400])
st, p = get_bytes(admin, f'/training/job-assignments/{ja}/export?format=pdf')
if st == 200 and p[:4] == b'%PDF':
    save_apd('S3-12', 'APD0024_job_assignment_Mai_Van_Tam', 'APD.0024 bổ nhiệm Mai Văn Tâm (PDF)', p, 'pdf', pages=3)
code, exp, t = attempt(admin, 'POST', '/training/record-exports', {'personUserId': person, 'reason': 'UAT31 personal record after the appointment', 'approverUserId': qa.user['id'], 'signatureToken': sign(admin)})
check('S3-b.21 the export of the personal record (APD.0014) is asked for', code == 200, (code, t))
if code == 200:
    code, d, t = attempt(qa, 'POST', f"/training/record-exports/{exp['id']}/approve", {'signatureToken': sign(qa)})
    st, pdf = get_bytes(admin, f"/training/record-exports/{exp['id']}/download")
    check('S3-b.22 APD.0014 as PDF after approval', st == 200 and pdf[:4] == b'%PDF', st)
    if st == 200:
        save_apd('S3-13', 'APD0014_training_record_Mai_Van_Tam', 'APD.0014 hồ sơ đào tạo cá nhân Mai Văn Tâm (gồm lần trượt, đào tạo lại và các đào tạo đạt)', pdf, 'pdf', pages=3)
        txt = pdf_text(pdf)
        check('S3-b.23 the record lists the three trainings', 'Aseptic' in txt and 'HPLC' in txt and 'SOP.10407' in txt.replace(' ', '') or ('Handling' in txt), txt[:300])
state['s3'] = S
save(state)
finish('p3c', b)
