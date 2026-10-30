"""Helpers that turn a real APD Word file into a tokenized template of the Training Annex (PLAN-TR-004, token syntax in section 7).

A template is the original file with tokens written in it: the layout, the wording and the logo stay as the QA approved them. What is added is only {{TOKENS}}; what is taken out of
the output is wrapped in {{#OMIT}} ... {{/OMIT}} (the notes that describe the form, its revision history).
"""
import copy
import re

from docx import Document
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt

R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
FONT = "Times New Roman"


# ------------------------------------------------------------------------------------------------------------------------------ text
def ptext(p):
    return "".join(t.text or "" for t in p.iter(qn("w:t")))


def _style_run(r):
    rpr = r.find(qn("w:rPr"))
    if rpr is None:
        rpr = OxmlElement("w:rPr")
        r.insert(0, rpr)
    for tag in ("w:rFonts", "w:sz", "w:szCs", "w:i", "w:iCs"):
        for e in rpr.findall(qn(tag)):
            rpr.remove(e)
    f = OxmlElement("w:rFonts")
    for a in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        f.set(qn(a), FONT)
    rpr.insert(0, f)
    for tag in ("w:sz", "w:szCs"):
        s = OxmlElement(tag)
        s.set(qn("w:val"), "24")
        rpr.append(s)


def make_run(text, bold=None, size=None):
    r = OxmlElement("w:r")
    _style_run(r)
    if size:
        for sz in r.find(qn("w:rPr")).findall(qn("w:sz")) + r.find(qn("w:rPr")).findall(qn("w:szCs")):
            sz.set(qn("w:val"), str(size))
    if bold:
        r.find(qn("w:rPr")).append(OxmlElement("w:b"))
    t = OxmlElement("w:t")
    t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    t.text = text
    r.append(t)
    return r


def _size_of(p):
    """The size (half points) the paragraph is written in: its first run, else its paragraph mark; None when it says nothing."""
    for r in p.iter(qn("w:r")):
        sz = r.find(qn("w:rPr") + "/" + qn("w:sz"))
        if sz is not None:
            return sz.get(qn("w:val"))
    sz = p.find(qn("w:pPr") + "/" + qn("w:rPr") + "/" + qn("w:sz"))
    return sz.get(qn("w:val")) if sz is not None else None


def clear_runs(p):
    for ch in list(p):
        if ch.tag != qn("w:pPr"):
            p.remove(ch)


def set_p(p, text):
    """The paragraph holds only `text`, in the font of a filled form and the size the paragraph was written in."""
    size = _size_of(p)
    clear_runs(p)
    p.append(make_run(text, size=size))


def append_p(p, text):
    p.append(make_run(text, size=_size_of(p)))


def make_p(text, like=None):
    p = OxmlElement("w:p")
    if like is not None and like.find(qn("w:pPr")) is not None:
        p.append(copy.deepcopy(like.find(qn("w:pPr"))))
    if text:
        p.append(make_run(text, size=_size_of(like) if like is not None else None))
    return p


def label_then(p, token):
    """'Full name: ......' -> 'Full name: {{TOKEN}}' (everything after the last colon is replaced)."""
    t = ptext(p)
    i = t.rfind(":")
    set_p(p, (t[: i + 1] if i >= 0 else t).rstrip() + " " + token)


def cell_paragraphs(tc):
    return tc.findall(qn("w:p"))


def cell_set(tc, text):
    ps = cell_paragraphs(tc)
    for extra in ps[1:]:
        tc.remove(extra)
    set_p(ps[0], text)


def cell_add(tc, text):
    """A new paragraph under what the cell holds. The empty lines the form keeps for a hand signature are taken out first, so that the value follows the label with no gap."""
    ps = cell_paragraphs(tc)
    while len(ps) > 1 and not ptext(ps[-1]).strip():
        tc.remove(ps[-1])
        ps = cell_paragraphs(tc)
    p = make_p(text, ps[-1])
    ps[-1].addnext(p)
    return p


def cells(tr):
    return tr.findall(qn("w:tc"))


def rows(tbl):
    return tbl.findall(qn("w:tr"))


def keep_rows(tbl, count):
    for tr in rows(tbl)[count:]:
        tbl.remove(tr)


def row_tokens(tbl, row_index, texts):
    """Writes a text in each cell of the row (None leaves the cell as it is)."""
    for tc, text in zip(cells(rows(tbl)[row_index]), texts):
        if text is not None:
            cell_set(tc, text)


# ------------------------------------------------------------------------------------------------------------------------------ body
def body_items(doc):
    return [e for e in doc.element.body if e.tag in (qn("w:p"), qn("w:tbl"))]


def tables(doc):
    return [e for e in doc.element.body if e.tag == qn("w:tbl")]


def find_p(doc, needle, start=0):
    for e in doc.element.body.iter(qn("w:p")):
        if e.getparent() is doc.element.body and needle in ptext(e):
            if start <= 0:
                return e
            start -= 1
    raise KeyError(needle)


def marker(text, like=None):
    return make_p(text, like)


def wrap(first, last, kind, name=None):
    """Writes {{#KIND:name}} before `first` and {{/KIND:name}} after `last` (both are body elements)."""
    tag = kind if name is None else "%s:%s" % (kind, name)
    first.addprevious(make_p("{{#%s}}" % tag))
    last.addnext(make_p("{{/%s}}" % tag))


def omit_between(first, last):
    wrap(first, last, "OMIT")


def omit_from_to(doc, first_needle, last_needle):
    first = find_p(doc, first_needle)
    last = find_p(doc, last_needle)
    omit_between(first, last)


def omit_history(doc, heading_needle="LỊCH SỬ SỬA ĐỔI"):
    """The revision history (a paragraph and its table) is the history of the Word file, not a part of the record."""
    h = find_p(doc, heading_needle)
    tbl = h.getnext()
    while tbl is not None and tbl.tag != qn("w:tbl"):
        tbl = tbl.getnext()
    omit_between(h, tbl)


# ------------------------------------------------------------------------------------------------------------------------------ header and footer
def _field(p, instr):
    for kind in ("begin", None, "separate", "text", "end"):
        r = OxmlElement("w:r")
        _style_run(r)
        if kind in ("begin", "separate", "end"):
            c = OxmlElement("w:fldChar")
            c.set(qn("w:fldCharType"), kind)
            r.append(c)
        elif kind is None:
            it = OxmlElement("w:instrText")
            it.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
            it.text = " %s " % instr
            r.append(it)
        else:
            t = OxmlElement("w:t")
            t.text = "1"
            r.append(t)
        p.append(r)


def page_numbers(p):
    set_p(p, "Page: ")
    _field(p, "PAGE")
    append_p(p, " / ")
    _field(p, "NUMPAGES")


def _clear_hf(doc):
    for s in doc.sections:
        for part in (s.header, s.footer, s.first_page_header, s.first_page_footer, s.even_page_header, s.even_page_footer):
            part.is_linked_to_previous = True
        s.different_first_page_header_footer = False
    doc.settings.element.find(qn("w:evenAndOddHeaders")) is None or doc.settings.element.remove(doc.settings.element.find(qn("w:evenAndOddHeaders")))


def move_header_table(doc, tbl, code_token=None):
    """The table with the logo, the title and the page goes to the header of the file (every page); 'Page:' becomes PAGE / NUMPAGES fields; the line with 'Code:' gets its token."""
    _clear_hf(doc)
    sec = doc.sections[0]
    hdr = sec.header
    hdr.is_linked_to_previous = False
    new = copy.deepcopy(tbl)
    for blip in new.iter("{http://schemas.openxmlformats.org/drawingml/2006/main}blip"):
        rid = blip.get("{%s}embed" % R_NS)
        if rid:
            part = doc.part.related_parts[rid]
            blip.set("{%s}embed" % R_NS, hdr.part.relate_to(part, RT.IMAGE))
    for im in new.iter("{urn:schemas-microsoft-com:vml}imagedata"):
        rid = im.get("{%s}id" % R_NS)
        if rid:
            im.set("{%s}id" % R_NS, hdr.part.relate_to(doc.part.related_parts[rid], RT.IMAGE))
    for p in new.iter(qn("w:p")):
        t = ptext(p)
        if "Page:" in t:
            page_numbers(p)
        elif code_token and re.match(r"\s*Code\s*:", t):
            set_p(p, "Code: " + code_token)
    h = hdr._element
    for ch in list(h):
        h.remove(ch)
    h.append(new)
    h.append(OxmlElement("w:p"))
    tbl.getparent().remove(tbl)


def footer_line(doc):
    """The form has no footer line (owner decision 2026-10-29): the footer is empty, and so does not leave a line at the foot of a page."""
    sec = doc.sections[0]
    ftr = sec.footer
    ftr.is_linked_to_previous = False
    f = ftr._element
    for ch in list(f):
        f.remove(ch)
    f.append(OxmlElement("w:p"))


def strip_checkbox(text):
    return re.sub(r"^[\s☐☒□☑]+", "", text)


def open_doc(path):
    return Document(path)


def _set_fonts(rpr):
    f = rpr.find(qn("w:rFonts"))
    if f is None:
        f = OxmlElement("w:rFonts")
        rpr.insert(0, f)
    for a in list(f.attrib):
        if a.endswith("Theme") or a.endswith("theme") or a.endswith("hint"):
            del f.attrib[a]
    for a in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        f.set(qn(a), FONT)


def force_font(doc):
    """Everything in the file is in Times New Roman (owner decision 2026-10-28): every run of the body, the headers and the footers, and the defaults and styles that a run falls back to."""
    parts = [doc.element.body]
    for s in doc.sections:
        for part in (s.header, s.footer):
            if not part.is_linked_to_previous:
                parts.append(part._element)
    for root in parts:
        for r in root.iter(qn("w:r")):
            rpr = r.find(qn("w:rPr"))
            if rpr is None:
                rpr = OxmlElement("w:rPr")
                r.insert(0, rpr)
            _set_fonts(rpr)
    styles = doc.styles.element
    for rpr in styles.iter(qn("w:rPr")):
        _set_fonts(rpr)
    dd = styles.find(qn("w:docDefaults"))
    if dd is not None:
        rd = dd.find(qn("w:rPrDefault"))
        if rd is not None and rd.find(qn("w:rPr")) is not None:
            _set_fonts(rd.find(qn("w:rPr")))


def set_widths(tbl, fractions):
    """The columns of a table in the given proportions of its width (the grid and the width of each cell), so that a column that holds a signature is wide enough for it."""
    grid = tbl.find(qn("w:tblGrid"))
    cols = grid.findall(qn("w:gridCol"))
    total = sum(int(c.get(qn("w:w"))) for c in cols)
    widths = [int(total * f / sum(fractions)) for f in fractions]
    for c, w in zip(cols, widths):
        c.set(qn("w:w"), str(w))
    for tr in tbl.findall(qn("w:tr")):
        if len(tr.findall(qn("w:tc"))) != len(widths):
            continue
        for tc, w in zip(tr.findall(qn("w:tc")), widths):
            pr = tc.find(qn("w:tcPr"))
            if pr is None:
                pr = OxmlElement("w:tcPr")
                tc.insert(0, pr)
            tw = pr.find(qn("w:tcW"))
            if tw is None:
                tw = OxmlElement("w:tcW")
                pr.insert(0, tw)
            tw.set(qn("w:w"), str(w))
            tw.set(qn("w:type"), "dxa")


def no_split_rows(doc):
    """A row of a table is never cut between two pages (a signature block that is cut leaves its last line alone on the next page)."""
    for tbl in doc.element.body.iter(qn("w:tbl")):
        for tr in tbl.findall(qn("w:tr")):
            pr = tr.find(qn("w:trPr"))
            if pr is None:
                pr = OxmlElement("w:trPr")
                tr.insert(0 if tr.find(qn("w:tblPrEx")) is None else 1, pr)
            if pr.find(qn("w:cantSplit")) is None:
                pr.insert(0, OxmlElement("w:cantSplit"))
            # the lines of a paragraph of a cell stay together (the last line of a signature is not left alone on the next page)
            for p in tr.iter(qn("w:p")):
                ppr = p.find(qn("w:pPr"))
                if ppr is None:
                    ppr = OxmlElement("w:pPr")
                    p.insert(0, ppr)
                if ppr.find(qn("w:keepLines")) is None:
                    kl = OxmlElement("w:keepLines")
                    anchor = ppr.find(qn("w:pStyle"))
                    if anchor is None:
                        ppr.insert(0, kl)
                    else:
                        anchor.addnext(kl)
