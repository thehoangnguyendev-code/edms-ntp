"""Builds the tokenized Word templates of the Training Annex from the real APD files (docs/training_docs).

    python -I tools/annex-templates/build_annex_templates.py

Output: docs/training_docs/annex-tokenized/<code>.docx. The tokens of each form are the contract of PLAN-TR-004 section 8 and of TrainingAnnexContract.java.
"""
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from annex_lib import *  # noqa: E402,F403

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "docs", "training_docs")
OUT = os.path.join(SRC, "annex-tokenized")
STARTERS = os.path.join(ROOT, "eqms-backend", "src", "main", "resources", "training-annex")

FILES = {
    "APD.0117": "APD.0117.01 Training attendence sheet_260815.docx",
    "APD.0108": "APD.0108.01 List of personnel for SOP seft_reading.docx",
    "APD.0118": "APD.0118.01 training requirement.docx",
    "APD.0011": "APD.0011.02 Training matrix_260810.docx",
    "APD.0024": "APD.0024.02 Job assignment VIE.docx",
    "APD.0014": "APD.0014.02 Personel training record.docx",
}


def body_para_starting(doc, text):
    for e in doc.element.body:
        if e.tag == qn("w:p") and ptext(e).replace(" ", " ").strip().lstrip("-").strip().startswith(text):
            return e
    raise KeyError(text)


def strip_top_notes(doc, last_needle):
    """The lines that describe the form (header, footer, content) are not written; the header table goes to the header of the file first."""
    first = next(e for e in doc.element.body if e.tag in (qn("w:p"), qn("w:tbl")))
    last = body_para_starting(doc, last_needle)
    omit_between(first, last)


def single_data_row(tbl, header_rows, texts):
    keep_rows(tbl, header_rows + 1)
    row_tokens(tbl, header_rows, texts)


def apd_0117(doc):
    t = tables(doc)
    header, general, topics, attendance, preparer, trainers, completion = t[0], t[1], t[2], t[3], t[4], t[5], t[6]
    move_header_table(doc, header, "{{TRAINING_NUMBER}}")
    for tr, token in zip(rows(general), ("{{ACTIVITY_CONTENT}}", "{{DEPARTMENT}}", "{{TRAINING_TYPE}}")):
        cell_set(cells(tr)[1], token)
    single_data_row(topics, 1, ["{{TOPIC.SESSION_NO}}", "{{TOPIC.DOCUMENT_NUMBER}}", "{{TOPIC.TITLE}}", "{{TOPIC.MODE}}", "{{TOPIC.TRAINER}}", "{{TOPIC.EXECUTION_DATE}}"])
    # one block for each session: its label and its list
    label = body_para_starting(doc, "SS01")
    set_p(label, "{{SESSION.LABEL}}:")
    single_data_row(attendance, 1, ["{{ATTENDEE.NO}}", "{{ATTENDEE.CODE}}", "{{ATTENDEE.NAME}}", "{{ATTENDEE.DEPARTMENT}}", "{{SIGNATURE:ATTENDEE.ATTENDANCE}}", "{{ATTENDEE.RESULT}}", "{{ATTENDEE.RETRAINING_RESULT}}"])
    # the column of the electronic signature is wide enough for its two lines (name, then the meaning and the time)
    set_widths(attendance, [5, 11, 17, 13, 26, 14, 14])
    wrap(label, attendance, "EACH", "SESSION")
    # the list preparer
    cell_set(cells(rows(preparer)[1])[0], "{{LIST_PREPARER_NAME}}")
    cell_set(cells(rows(preparer)[1])[1], "{{SIGNATURE:LIST_PREPARED}}")
    # the trainer of each session
    single_data_row(trainers, 1, ["{{TRAINER.SESSION_NO}}", "{{TRAINER.NAME}}", "{{SIGNATURE:TRAINER.SENT}}"])
    # QA completion
    cell_set(cells(rows(completion)[1])[1], "{{SIGNATURE:QA_COMPLETION}}")
    cell_add(cells(rows(completion)[1])[0], "{{QA_CONFIRMER_NAME}}")
    # the note about an external training belongs to the case
    ext = body_para_starting(doc, "Đối với đào tạo bên ngoài")
    wrap(ext, ext, "CASE", "EXTERNAL")
    omit_history(doc)


def apd_0108(doc):
    t = tables(doc)
    header, readers, head = t[0], t[1], t[2]
    move_header_table(doc, header)
    dept = body_para_starting(doc, "Bộ phận")
    label_then(dept, "{{DEPARTMENT}}")
    name = body_para_starting(doc, "Mã và tên tài liệu")
    label_then(name, "{{DOCUMENT_NAME_VERSION}}")
    single_data_row(readers, 1, ["{{READER.NO}}", "{{READER.CODE}}", "{{READER.NAME}}", "{{READER.TRAINING_NUMBER}}", "{{READER.DATE}}", "{{SIGNATURE:READER.CONFIRMED}}"])
    c0, c1, c2 = cells(rows(head)[1])
    for p in cell_paragraphs(c0):
        text = ptext(p)
        if "Họ và tên" in text:
            label_then(p, "{{HEAD_NAME}}")
        elif "Chức vụ" in text:
            label_then(p, "{{HEAD_POSITION}}")
        elif "Ngày" in text:
            label_then(p, "{{HEAD_DATE}}")
    # name and position may share one paragraph (a line break); then the position goes to its own paragraph
    if not any("{{HEAD_POSITION}}" in ptext(p) for p in cell_paragraphs(c0)):
        for p in cell_paragraphs(c0):
            if "{{HEAD_NAME}}" in ptext(p):
                p.addnext(make_p("Chức vụ/ Position: {{HEAD_POSITION}}", p))
    set_widths(head, [36, 34, 30])
    cell_add(c1, "{{SIGNATURE:HEAD}}")
    cell_add(c2, "{{HEAD_REMARKS}}")
    omit_history(doc)


def apd_0118(doc):
    t = tables(doc)
    header, lines, signs = t[0], t[1], t[2]
    for tc in header.iter(qn("w:tc")):
        for p in tc.iter(qn("w:p")):
            pass
    for p in header.iter(qn("w:p")):
        text = ptext(p)
        if text.strip().startswith("Year"):
            set_p(p, "Year: {{YEAR}}")
        elif text.strip().startswith("Request No"):
            set_p(p, "Request No: {{REQUEST_NO}}")
    move_header_table(doc, header)
    for needle, check in (("Đào tạo định kỳ SOP", "KIND_PERIODIC_SOP"), ("Đào định kỳ hàng năm", "KIND_ANNUAL")):
        p = next(e for e in doc.element.body if e.tag == qn("w:p") and needle in ptext(e))
        set_p(p, "{{CHECK:%s}} %s" % (check, strip_checkbox(ptext(p))))
    single_data_row(lines, 1, ["{{LINE.NO}}", "{{LINE.MONTH}}", "{{LINE.TOPIC}}", "{{LINE.CODE}}", "{{LINE.EXECUTION_DATE}}", "{{SIGNATURE:LINE.QA}}", "{{LINE.QA_COMMENT}}"])
    for tc, slot in zip(cells(rows(signs)[1]), ("PREPARED", "REVIEWED", "APPROVED")):
        cell_add(tc, "{{SIGNATURE:%s}}" % slot)
    omit_history(doc)
    # a note of the template that follows the history of revisions: it would leave a page of its own
    for e in list(doc.element.body):
        if e.tag == qn("w:p") and ptext(e).strip().startswith("*Ghi tháng dự kiến"):
            omit_between(e, e)


def apd_0011(doc):
    t = tables(doc)
    matrix = t[0]
    paras = [e for e in doc.element.body if e.tag == qn("w:p")]
    omit_between(paras[0], paras[1])
    title_vi = body_para_starting(doc, "Tên tài liệu")
    set_p(title_vi, "Tên tài liệu: Ma trận đào tạo – {{DEPARTMENT}}")
    title_en = body_para_starting(doc, "Name of document")
    set_p(title_en, "Name of document: Training matrix - {{DEPARTMENT}}")
    content = body_para_starting(doc, "Nội dung/ Content")
    omit_between(content, content)
    department = body_para_starting(doc, "Bộ phận/ Department")
    label_then(department, "{{DEPARTMENT}}")
    department.addnext(make_p("Mã ma trận/ Matrix code: {{MATRIX_CODE}}    Phiên bản/ Version: {{MATRIX_VERSION}}", department))
    management = body_para_starting(doc, "*Đối với các vị trí quản lý")
    omit_between(management, management)
    block = make_p("{{BLOCK:MATRIX}}")
    matrix.addprevious(block)
    matrix.getparent().remove(matrix)
    block.addnext(make_p("{{SIGNATURE:MATRIX}}"))
    omit_history(doc)


def apd_0024(doc):
    t = tables(doc)
    header, employee, case, initial, change, duties, signs = t[0], t[1], t[2], t[3], t[4], t[5], t[6]
    move_header_table(doc, header, "{{EMPLOYEE_CODE}}")
    for tr, token in zip(rows(employee), ("{{EMPLOYEE_NAME}}", "{{EMPLOYEE_CODE}}", "{{ISSUANCE_NO}}")):
        cell_set(cells(tr)[1], token)
    a, b = cells(rows(case)[0])
    cell_set(a, "{{CHECK:CASE_INITIAL}} " + strip_checkbox(ptext(cell_paragraphs(a)[0])))
    cell_set(b, "{{CHECK:CASE_CHANGE}} " + strip_checkbox(ptext(cell_paragraphs(b)[0])))
    completed = body_para_starting(doc, "Đã hoàn thiện đào tạo")
    label_then(completed, "{{MATRIX_CODE_VERSION}}")
    for tbl, names in ((initial, ("DEPARTMENT", "POSITION", "SUPERIOR", "SUBORDINATES", "SUBSTITUTE")),
                       (change, ("CURRENT_POSITION", "CHANGE_REASON", "NEW_POSITION", "SUPERIOR", "SUBORDINATES", "SUBSTITUTE"))):
        for tr, n in zip(rows(tbl), names):
            cell_set(cells(tr)[1], "{{%s}}" % n)
    fill_initial = body_para_starting(doc, "Điền bảng này nếu là bổ nhiệm lần đầu")
    fill_change = body_para_starting(doc, "Điền bảng này nếu là thay đổi")
    wrap(fill_initial, initial, "CASE", "INITIAL")
    wrap(fill_change, change, "CASE", "CHANGE")
    omit_between(fill_initial, fill_initial)
    omit_between(fill_change, fill_change)
    juris = body_para_starting(doc, "3. Quyền hạn")
    juris.addnext(make_p("{{JURISDICTION}}", juris))
    single_data_row(duties, 1, ["{{DUTY.RESPONSIBILITY}}", "{{DUTY.DESCRIPTION}}"])
    cell_add(cells(rows(signs)[0])[0], "{{ASSIGNOR_TITLE}}")
    cell_add(cells(rows(signs)[0])[0], "{{SIGNATURE:ASSIGNOR}}")
    cell_add(cells(rows(signs)[0])[1], "{{SIGNATURE:RECEIVER}}")
    omit_history(doc, "LỊCH SỬ SỬA ĐỔI")


def apd_0014(doc):
    t = tables(doc)
    header, employee, history, signs = t[0], t[1], t[2], t[3]
    move_header_table(doc, header, "{{EMPLOYEE_CODE}}")
    name_cell = cells(rows(employee)[0])[0]
    label_then(cell_paragraphs(name_cell)[0], "{{EMPLOYEE_NAME}}")
    q, j = cells(rows(employee)[1])
    append_p(cell_paragraphs(q)[-1], ": {{QUALIFICATION}}")
    append_p(cell_paragraphs(j)[-1], ": {{JOIN_DATE}}")
    single_data_row(history, 1, ["{{RECORD.CONTENT}}", "{{RECORD.DATE}}", "{{RECORD.NUMBER}}"])
    d0, d1 = cells(rows(signs)[0])
    label_then(cell_paragraphs(d0)[0], "{{PREPARED_DATE}}")
    label_then(cell_paragraphs(d1)[0], "{{APPROVED_DATE}}")
    p0, p1 = cells(rows(signs)[1])
    cell_add(p0, "{{SIGNATURE:PREPARED}}")
    cell_add(p1, "{{SIGNATURE:APPROVED}}")
    omit_history(doc)


NOTE_END = {"APD.0117": "3.  Nội dung", "APD.0108": "3. Nội dung", "APD.0118": "Nội dung", "APD.0024": "Nội dung", "APD.0014": "3. Nội dung"}
BUILD = {"APD.0117": apd_0117, "APD.0108": apd_0108, "APD.0118": apd_0118, "APD.0011": apd_0011, "APD.0024": apd_0024, "APD.0014": apd_0014}


def main():
    os.makedirs(OUT, exist_ok=True)
    for code, name in FILES.items():
        doc = open_doc(os.path.join(SRC, name))
        BUILD[code](doc)
        if code in NOTE_END:
            strip_top_notes(doc, NOTE_END[code])
        footer_line(doc)
        no_split_rows(doc)
        force_font(doc)
        path = os.path.join(OUT, code + ".docx")
        doc.save(path)
        os.makedirs(STARTERS, exist_ok=True)
        shutil.copyfile(path, os.path.join(STARTERS, code + ".docx"))
        print("written", path)


if __name__ == "__main__":
    main()
