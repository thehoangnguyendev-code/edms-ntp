"""Helpers of part 7 (Legacy Import and Training Management, end to end on DEV): a multipart import, a section of the request, the numbers.
The scenario itself is in p7b_legacy_import_training.py. Original header: Part 7: Legacy Import and Training Management, end to end on DEV (owner decisions D1-D6, DECISION_LOG LEGACY-IMPORT-TRAINING-2026-11-01).
A document imported from paper with a paper Training Number: the historical activity, the scan, the persons, the signature of the import and the records, a number shared by two
documents, the counter that goes on after the paper log, and what is refused."""
from flows31 import *
import urllib.request, urllib.error, urllib.parse
import api as _api

HERE_DIR = os.path.dirname(os.path.abspath(__file__))
PDF = open(os.path.join(HERE_DIR, 'apd', 'F-01__APD0117_external_trainer_session_01_signature_meaning.pdf'), 'rb').read()
SCAN = open(os.path.join(HERE_DIR, 'apd', 'F-02__APD0117_absent_person_make_up_failed.pdf'), 'rb').read()
state = load()


def multipart(path, parts, client=None):
    """parts: (name, filename|None, content_type|None, bytes). Returns (status, parsed json, text)."""
    client = client or admin
    boundary = '----p7b' + uuid_hex()
    body = b''
    for name, filename, ctype, data in parts:
        head = f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"' + (f'; filename="{filename}"' if filename else '') + '\r\n'
        if ctype:
            head += f'Content-Type: {ctype}\r\n'
        body += head.encode() + b'\r\n' + data + b'\r\n'
    body += f'--{boundary}--\r\n'.encode()
    req = urllib.request.Request(_api.BASE + path, data=body, method='POST')
    req.add_header('Content-Type', 'multipart/form-data; boundary=' + boundary)
    req.add_header('Authorization', 'Bearer ' + client.token)
    try:
        with client.opener.open(req, timeout=240) as resp:
            raw = resp.read()
            return resp.status, json.loads(raw or b'{}'), raw[:400].decode('utf-8', 'ignore')
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            data = json.loads(raw or b'{}')
        except Exception:
            data = {}
        return e.code, data, raw[:600].decode('utf-8', 'ignore')


def uuid_hex():
    import uuid
    return uuid.uuid4().hex[:12]


type_id = sql("select id from document_types where short_code = 'SOP' limit 1")[0][0]
bu_id = sql("select id from business_units where name = 'Quality Unit'")[0][0]
qa = sql("select id from departments where name = 'Quality Assurance'")[0][0]
admin_id = admin.user['id']
trainees = [sql(f"select id from app_users where username = '{u}'")[0][0] for u in ('uat31.s2.qa.pass', 'uat31.s2.qa.fail')]


def free_number():
    for n in range(7100, 7900):
        code = f'SOP.{n}'
        if int(sql(f"select count(*) from documents where document_number = '{code}'")[0][0]) == 0:
            return code
    raise SystemExit('no free document number')


def section(rev='1.0.0', number=None, scan=True, lost=False, people=None, effective='22/09/2020', author=None, paper=None, **more):
    if paper is None:
        paper = bool(number and scan and not lost)
    s = {
        'revisionNumber': rev, 'authorId': author or admin_id, 'legacyHistoricalAuthoredDate': '17/09/2020', 'legacyHistoricalReviewers': 'Jane Doe (QA)',
        'legacyHistoricalApprover': 'Mary QM', 'legacyHistoricalReviewDate': '18/09/2020', 'legacyHistoricalApprovalDate': '20/09/2020',
        'changeDescription': 'Historical revision ' + rev, 'effectiveDate': effective, 'trainingCompletionDate': '21/09/2020', 'trainingNumber': number,
        'hasFile': True, 'noFileJustification': None, 'legacyHistoricalReviewerIds': [], 'legacyHistoricalApproverId': None,
        'traineeIds': people if people is not None else [], 'trainingNotEvidenced': lost,
        'trainingNoEvidenceReason': 'The paper record was lost in the archive move' if lost else None, 'hasTrainingScan': bool(scan and not lost),
        'trainingTopic': 'UAT7 Gowning in grade B' if paper else None, 'trainingTrainer': 'Nguyen Van A (paper)' if paper else None, 'trainingMethod': 'CLASSROOM' if paper else None,
    }
    s.update(more)
    return s


def do_import(number, name, sections, scans, department=qa, requires_training=True, client=None, reviewers=None, approvers=None, business_unit=None, source=None, scan_names=None, source_docx=False):
    doc = {
        'documentName': name, 'documentType': type_id, 'author': admin_id, 'businessUnit': business_unit or bu_id, 'department': department, 'language': 'English', 'requiresTraining': requires_training,
        'trainingPeriodDays': 10 if requires_training else None, 'reasonForSkippingTraining': None if requires_training else 'Not applicable for UAT7', 'legacyDocumentNumber': number, 'legacyOriginalEffectiveDate': '22/09/2020', 'legacyJustification': 'UAT p7b: paper archive',
        'isTemplate': False, 'reviewerUserIds': reviewers or [], 'approverUserIds': approvers or [], 'periodicReviewCycle': 12, 'periodicReviewNotification': 30, 'relatedDocumentIds': [], 'correlatedDocumentIds': [],
    }
    parts = [('document', None, None, json.dumps(doc).encode()), ('revisions', None, None, json.dumps(sections).encode())]
    for _ in sections:
        parts.append(('files', 'source.docx' if source_docx else 'source.pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' if source_docx else 'application/pdf', source if source is not None else PDF))
    for k, data in enumerate(scans):
        parts.append(('trainingScans', (scan_names[k] if scan_names else 'paper-scan.pdf'), 'application/pdf', data))
    parts.append(('legacyJustification', None, None, b'UAT p7b: paper archive'))
    parts.append(('signatureToken', None, None, sign(client or admin).encode()))
    return multipart('/documents/legacy-import', parts, client)


def revision_of(number):
    rows = sql(f"select r.id, r.training_activity_id, r.training_mode, r.training_number, r.training_origin from document_revisions r join documents d on d.id = r.document_id where d.document_number = '{number}' order by r.created_at")
    return rows


import random
FRESH_LAST = ''


def OLD_YEAR():
    """A paper number of an earlier year: it is accepted, and it does not touch the counter of the current year."""
    return 'TRN/QA/24-%d' % random.randint(500000, 599999)


def FRESH():
    global FRESH_LAST
    FRESH_LAST = 'TRN/QA/26-%d' % random.randint(500000, 599999)
    return FRESH_LAST


