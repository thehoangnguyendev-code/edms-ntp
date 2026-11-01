"""Part 8a: the complete test of Legacy Import with Training Management on DEV (API side). It looks for what is still wrong, not for what works: several revisions in one import, the normal
flow after a Legacy Import (Upgrade Revision), the personal training record (APD.0014), voiding a record, the notification and the audit, bad files, two people at the same time, the rights of
people of another department, and what cannot be done."""
from lib7 import *
import concurrent.futures, urllib.parse, urllib.request, io
import api as _api

state = load()
reviewer = sql("select id from app_users where username = 'reviewer.test1'")[0][0]
approver_id = sql("select id from app_users where username = 'approver.test1'")[0][0]
base = max(int(sql("select max(last_serial) from training_number_sequences where year = 2026 and last_serial < 100000")[0][0]),
           int(sql("select max(substring(training_number from '-([0-9]+)$')::int) from training_activities where training_number like 'TRN/QA/26-%' and length(training_number) < 16")[0][0])) + 20
_next = [base]


def number():
    _next[0] += 1
    return 'TRN/QA/26-%d' % _next[0]


def records(act):
    return [dict(zip(('id', 'person', 'method', 'doc', 'rev', 'source'), r)) for r in sql(
        f"select id, person_user_id, method, document_number, document_revision, source from training_records where activity_id = '{act}' order by method, document_number, document_revision")]


def activity_of(num):
    rows = sql(f"select id, kind, status from training_activities where upper(training_number) = upper('{num}')")
    return rows[0] if rows else None


t1, t2 = trainees
people = {t1, t2}

step('G-1 several revisions in one import (3 revisions: a number, a lost paper, a second number)')
Na, Nb = number(), number()
docM = free_number()
s1 = section('1.0.0', number=Na, people=[t1, t2], effective='22/09/2020')
s2 = section('2.0.0', number=None, scan=False, lost=True, effective='22/09/2021')
s3 = section('3.0.0', number=Nb, people=[t1], effective='22/09/2022')
code, data, text = do_import(docM, 'UAT8 three revisions', [s1, s2, s3], [SCAN, SCAN], reviewers=[reviewer], approvers=[approver_id])
check('G-1.1 the import of three revisions is accepted', code == 200, (code, text[:300]))
st = sql(f"select r.revision_number, r.status_code from document_revisions r join documents d on d.id = r.document_id where d.document_number = '{docM}' order by r.revision_number")
check('G-1.2 only the last revision is Effective, the others are Obsoleted', [x[1] for x in st] == ['OBSOLETED', 'OBSOLETED', 'EFFECTIVE'], st)
actA, actB = activity_of(Na), activity_of(Nb)
check('G-1.3 each paper number has its own historical activity', actA and actB and actA[0] != actB[0], (actA, actB))
ev = sql(f"select r.revision_number, e.status, e.not_evidenced, e.activity_id is not null from training_legacy_evidence e join document_revisions r on r.id = e.revision_id join documents d on d.id = r.document_id where d.document_number = '{docM}' order by 1")
check('G-1.4 three evidences: two scans linked to an activity, one declaration without', [(x[0], x[2], x[3]) for x in ev] == [('1.0.0', 'f', 't'), ('2.0.0', 't', 'f'), ('3.0.0', 'f', 't')], ev)
ra, rb = records(actA[0]), records(actB[0])
check('G-1.5 records of the first number: 2 trainees and the author; of the second: 1 trainee and the author',
      sorted(x['method'] for x in ra) == ['PAPER', 'PAPER', 'SIGNATORY'] and sorted(x['method'] for x in rb) == ['PAPER', 'SIGNATORY'], (ra, rb))
check('G-1.6 each record names the document and the revision it was for', all(x['doc'] == docM for x in ra + rb) and {x['rev'] for x in ra} == {'1.0.0'} and {x['rev'] for x in rb} == {'3.0.0'}, (ra, rb))
links = admin.call('GET', '/training/links/documents/' + sql(f"select id from documents where document_number = '{docM}'")[0][0])
check('G-1.7 Document Control shows the training of the document from Training Management (number, status)', links.get('trainingNumber') in (Nb, Na) and links.get('status') == 'COMPLETED', links)
rev3 = sql(f"select r.id from document_revisions r join documents d on d.id = r.document_id where d.document_number = '{docM}' and r.revision_number = '3.0.0'")[0][0]
rlink = admin.call('GET', f'/training/links/revisions/{rev3}')
check('G-1.8 the revision shows its activity: number, completed, origin legacy, can be opened', rlink.get('trainingNumber') == Nb and rlink.get('status') == 'COMPLETED' and rlink.get('origin') == 'LEGACY_IMPORT' and rlink.get('activityId'), rlink)
rev2 = sql(f"select r.id from document_revisions r join documents d on d.id = r.document_id where d.document_number = '{docM}' and r.revision_number = '2.0.0'")[0][0]
rlink2 = admin.call('GET', f'/training/links/revisions/{rev2}')
check('G-1.9 the revision whose paper is lost has no number and no activity (and says it is legacy)', rlink2.get('trainingNumber') in (None, '') and rlink2.get('origin') == 'LEGACY_IMPORT', rlink2)

step('G-2 the author is also a trainee: one record, not two')
Nc = number()
docD = free_number()
code, data, text = do_import(docD, 'UAT8 author is trainee', [section('1.0.0', number=Nc, people=[admin_id, t1])], [SCAN])
check('G-2.1 the import is accepted', code == 200, (code, text[:300]))
actC = activity_of(Nc)
rc = records(actC[0]) if actC else []
mine = [x for x in rc if x['person'] == admin_id]
check('G-2.2 the author has one record for the document, as a trainee', len(mine) == 1 and mine[0]['method'] == 'PAPER', mine)

step('G-3 the normal flow after a Legacy Import: Upgrade Revision of a document that requires training')
docM_id = sql(f"select id from documents where document_number = '{docM}'")[0][0]
code, data, text = attempt(admin, 'POST', f'/documents/{docM_id}/upgrade-revision')
check('G-3.1 a new revision can be made from the imported document', code == 200, (code, text[:300]))
if code == 200:
    newrev = data.get('id')
    row = sql(f"select training_origin, training_mode, training_activity_id, training_number, revision_number from document_revisions where id = '{newrev}'")
    check('G-3.2 the new revision is a normal one (not legacy) and got its own training activity', row and row[0][0] == 'NATIVE' and row[0][2] not in ('', None) and row[0][3], row)
    if row and row[0][2]:
        act_new = sql(f"select kind, status, training_number from training_activities where id = '{row[0][2]}'")
        check('G-3.3 that activity is not the historical one and waits for the revision to be approved (RESERVED)', act_new and act_new[0][0] != 'LEGACY' and act_new[0][1] == 'RESERVED', act_new)
        check('G-3.4 its Training Number is a new one of the system (after the paper log)', act_new and act_new[0][2] not in (Na, Nb), act_new)
    legacy_after = sql(f"select status from training_activities where id in ('{actA[0]}', '{actB[0]}')")
    check('G-3.5 the historical activities are untouched (still COMPLETED)', [x[0] for x in legacy_after] == ['COMPLETED', 'COMPLETED'], legacy_after)
    check('G-3.6 the records of the paper training are untouched', len(records(actA[0])) == 3 and len(records(actB[0])) == 2, '')

step('G-4 the personal training record (APD.0014) lists what was trained on paper')
export = None
code, data, text = attempt(admin, 'POST', '/training/record-exports', {'personUserId': t1, 'reason': 'UAT8 legacy records in the personal record', 'approverUserId': approver_id, 'signatureToken': sign(admin)})
check('G-4.1 the export is asked for', code == 200, (code, text[:200]))
if code == 200:
    appr = U('approver.test1')
    attempt(appr, 'POST', f"/training/record-exports/{data['id']}/approve", {'signatureToken': sign(appr)})
    req = urllib.request.Request(_api.BASE + f"/training/record-exports/{data['id']}/download")
    req.add_header('Authorization', 'Bearer ' + admin.token)
    try:
        with admin.opener.open(req) as resp:
            pdf = resp.read()
        sys.path.insert(0, 'D:/tmp/pymupdf')
        import fitz
        doc = fitz.open(stream=pdf, filetype='pdf')
        text_pdf = ' '.join(page.get_text() for page in doc)
        check('G-4.2 the personal record shows the paper training (its number and topic)', Na in text_pdf and text_pdf.count('TRN/QA/26-') >= 3, text_pdf[:600])
    except Exception as e:
        check('G-4.2 the personal record could be downloaded', False, str(e)[:200])

step('G-5 a record of the paper training can be voided, like any record')
paper_rec = [x for x in records(actC[0]) if x['person'] == t1][0]
code, data, text = attempt(admin, 'POST', f"/training/records/{paper_rec['id']}/void", {'reason': 'UAT8 voided on purpose', 'signatureToken': sign(admin)})
check('G-5.1 the void is accepted', code == 200, (code, text[:200]))
lst = admin.call('GET', f'/training/records?personId={t1}&trainingNumber={urllib.parse.quote(Nc)}&limit=20')
ids = [r['id'] for r in lst['data']]
check('G-5.2 the voided record is no longer in the list of the person', paper_rec['id'] not in ids, ids)
pe = admin.call('GET', f'/training/legacy-evidence/activities/{actC[0]}/people?limit=50')
voided_row = [p for p in pe['data'] if p['personId'] == t1]
check('G-5.3 the tab Persons Trained does not still say "Written" for a voided record', voided_row and voided_row[0]['recordWritten'] is False, voided_row)

step('G-6 notification and audit')
holders = sql("""select count(*) from app_users u where u.status='Active' and lower(trim(u.department)) = 'quality assurance' and u.id <> (select id from app_users where username='admin') and exists (
    select 1 from user_access_profiles uap join access_profile_permission_sets aps on aps.access_profile_id = uap.access_profile_id join permission_set_items psi on psi.permission_set_id = aps.permission_set_id
      join permissions p on p.id = psi.permission_id where uap.user_id = u.id and p.code = 'training.document_impact.manage')""")[0][0]
sent = int(sql(f"select count(*) from user_notifications where title = 'Training: a document was imported from paper' and message like '%{docM}%'")[0][0])
check('G-6.1 the people who hold the document impact permission of the department were told (' + holders + ' of them)', (int(holders) == 0 and sent == 0) or sent >= 1, (holders, sent))
audit = sql(f"select action, count(*) from audit_logs where action in ('TRAINING_LEGACY_ACTIVITY_CREATED','TRAINING_LEGACY_EVIDENCE_FILED') and (entity_name like '%{Na}%' or entity_name like '%{docM}%') group by 1 order by 1")
check('G-6.2 the audit trail has the activity and the evidence', dict((r[0], int(r[1])) for r in audit).get('TRAINING_LEGACY_ACTIVITY_CREATED', 0) >= 1 and dict((r[0], int(r[1])) for r in audit).get('TRAINING_LEGACY_EVIDENCE_FILED', 0) >= 1, audit)

step('G-7 bad scans')
big = b'%PDF-1.4\n' + b'0' * (21 * 1024 * 1024)
code, data, text = do_import(free_number(), 'UAT8 big scan', [section(number=number())], [big])
check('G-7.1 a scan over 20 MB is refused with a clear answer (not a server error)', code in (400, 413) and code != 500, (code, text[:200]))
code, data, text = do_import(free_number(), 'UAT8 text scan', [section(number=number())], [b'this is not a pdf'])
check('G-7.2 a scan that is not a PDF is refused', code == 400 and 'must be a PDF file' in text, (code, text[:200]))
check('G-7.3 and none of those imports left a document or an activity behind', int(sql("select count(*) from documents where document_name in ('UAT8 big scan','UAT8 text scan')")[0][0]) == 0, '')
print('NOTE: ClamAV is on in DEV, but its test string is only detected at the start of a file and our scan must be a PDF, PNG or JPEG: the refusal for a virus is covered by the unit test, not here.')

step('G-8 two people at the same time')
Nd = number()
d1, d2 = free_number(), None
for k in range(7100, 7900):
    cand = f'SOP.{k}'
    if cand != d1 and int(sql(f"select count(*) from documents where document_number = '{cand}'")[0][0]) == 0:
        d2 = cand
        break
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    f1 = pool.submit(do_import, d1, 'UAT8 race A', [section(number=Nd, people=[t1])], [SCAN])
    f2 = pool.submit(do_import, d2, 'UAT8 race B', [section(number=Nd, people=[t2])], [SCAN])
    r1, r2 = f1.result(), f2.result()
codes = sorted([r1[0], r2[0]])
check('G-8.1 the same new paper number at the same moment: one wins, the other is answered clearly (never a server error)', 200 in codes and all(c < 500 for c in codes), (codes, r1[2][:160], r2[2][:160]))
check('G-8.2 there is exactly one activity and one evidence for the number', int(sql(f"select count(*) from training_activities where upper(training_number) = upper('{Nd}')")[0][0]) == 1
      and int(sql(f"select count(*) from training_legacy_evidence e join training_activities a on a.id = e.activity_id where upper(a.training_number) = upper('{Nd}')")[0][0]) == 1, '')
Ne = number()
d3 = free_number()
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    g1 = pool.submit(do_import, d3, 'UAT8 same doc A', [section(number=Ne)], [SCAN])
    g2 = pool.submit(do_import, d3, 'UAT8 same doc B', [section(number=number())], [SCAN])
    q1, q2 = g1.result(), g2.result()
codes2 = sorted([q1[0], q2[0]])
check('G-8.3 the same document number at the same moment: one wins, the other gets a clear refusal', codes2[0] == 200 and codes2[1] in (400, 409), (codes2, q1[2][:160], q2[2][:160]))
check('G-8.4 and one document only has that number', int(sql(f"select count(*) from documents where document_number = '{d3}'")[0][0]) == 1, '')

step('G-9 the same number written in another case and with blanks')
docL = free_number()
code, data, text = do_import(docL, 'UAT8 lower case', [section(number='  ' + Na.lower() + '  ', scan=False)], [])
check('G-9.1 it joins the same activity (the number is compared without case and blanks)', code == 200 and sql(f"select r.training_activity_id from document_revisions r join documents d on d.id = r.document_id where d.document_number = '{docL}'")[0][0] == actA[0], (code, text[:200]))
check('G-9.2 the activity is still one', int(sql(f"select count(*) from training_activities where upper(training_number) = upper('{Na}')")[0][0]) == 1, '')

step('G-10 rights of a person of another department (Executive Office, no scope of all departments)')
other = U('dco.lead2')
c10, q10, t10 = attempt(other, 'GET', '/training/legacy-evidence?limit=50')
check('G-10.1 the queue shows nothing of the Quality Assurance documents (or is refused: this person holds no Training permission)', c10 in (401, 403) or not any(r['documentNumber'] == docM for r in q10.get('data', [])), (c10, t10[:120]))
evid_a = sql(f"select id from training_legacy_evidence where activity_id = '{actA[0]}'")[0][0]
code, data, text = attempt(other, 'GET', f'/training/legacy-evidence/{evid_a}/download?inline=true')
check('G-10.2 it cannot open the scan of another department', code in (401, 403, 404), (code, text[:150]))
code, data, text = attempt(other, 'GET', f'/training/legacy-evidence/activities/{actA[0]}/people?limit=5')
check('G-10.3 it cannot see the persons of another department', code in (401, 403, 404), (code, text[:150]))
own = other.user.get('department')
own_row = sql(f"select id, business_unit_id from departments where name = '{own}'")[0]
code, data, text = do_import(free_number(), 'UAT8 no training right', [section(number=number())], [SCAN], department=own_row[0], business_unit=own_row[1], client=other)
check('G-10.4 a person without the Training permission cannot import a training document with evidence (clear words)', code in (400, 403) and ('Training permission' in text or 'own department' not in text), (code, text[:250]))

step('G-11 the queue and its filters')
for st_ in ('FILED', 'VERIFIED', 'MISSING'):
    c, d, t = attempt(admin, 'GET', f'/training/legacy-evidence?status={st_}&limit=5')
    check('G-11.1 filter ' + st_, c == 200, (c, t[:100]))
c, d, t = attempt(admin, 'GET', '/training/legacy-evidence?status=SUBMITTED&limit=5')
check('G-11.2 the old status SUBMITTED no longer exists', c == 400, (c, t[:100]))
for sk in ('document', 'documentName', 'revision', 'paperNo', 'evidence', 'completion', 'submittedBy', 'submittedOn'):
    c, d, t = attempt(admin, 'GET', f'/training/legacy-evidence?sortBy={sk}&sortDirection=asc&limit=5')
    check('G-11.3 sort by ' + sk, c == 200, (c, t[:100]))

step('G-12 what cannot be done (reported, not a failure of the test)')
rev1_id = sql(f"select r.id from document_revisions r join documents d on d.id = r.document_id where d.document_number = '{docD}'")[0][0]
c, d, t = attempt(admin, 'POST', f'/training/legacy-evidence/revisions/{rev1_id}?notEvidenced=false', None)
check('G-12.1 evidence cannot be attached twice to the same revision', c in (400, 409, 415), (c, t[:150]))
print('NOTE: a trainee who was forgotten at import cannot be added afterwards: the evidence and its list are read-only (no endpoint, by design).')

state['p8'] = {'docM': docM, 'Na': Na, 'Nb': Nb, 'actA': actA[0], 'docD': docD, 'Nc': Nc, 'actC': actC[0]}
save(state)
finish('p8a')
