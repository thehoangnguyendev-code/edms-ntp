"""DEC-DOC-2026-11-27-04: the copy from a marked Effective file is clean, and the publishing PDF of a marked revision shows no markup."""
import hashlib, io, re, sys, zipfile
sys.stdout.reconfigure(encoding="utf-8")
S = sys.argv[1]
exec(open(S + "/e2e.py", encoding="utf-8").read().split("author, trainee = login(")[0].replace("sys.stdout.reconfigure", "(lambda **k: 0)"))
from pypdf import PdfReader
author, dco = login("author.test1"), login("dco.test1")
before = revision(EFF)
marked = open(S + "/real/marked.docx", "rb").read()

s, created = call("POST", f"/documents/{DOC}/revisions/upload", author, files={"useEffectiveSource": "true"})
check("revision created from a marked effective file", s == 200, created if s != 200 else created["revisionNumber"])
rid = created["id"]
draft = revision(rid)
s, info = call("GET", f"/revisions/{rid}/comparison-info", author)
check("the copy has no tracked change and no comment", info["trackedChanges"] == 0 and info["unresolvedComments"] == 0, info)
check("checksum differs from the marked source", draft["sha"] != before["sha"])
check("effective revision and its file untouched", revision(EFF) == before and before["sha"] == hashlib.sha256(marked).hexdigest())
check("audit says markup was removed", int(sql(f"select count(*) from audit_logs a where a.entity_id='{rid}' and a.action_type='REVISION_SOURCE_COPIED_FROM_EFFECTIVE'")) == 1)

s, config = call("GET", f"/revisions/{rid}/onlyoffice/compare-config", author)
content = call("GET", config["document"]["url"].replace("host.docker.internal", "localhost"), raw=True)[1]
xml = zipfile.ZipFile(io.BytesIO(content)).read("word/document.xml").decode()
check("copy compared with the marked baseline: no difference", not re.search(r"<w:(ins|del) ", xml))

# the draft gets markup again, as during review
s, b = call("POST", f"/revisions/{rid}/upload", author, files={"file": ("marked.docx", marked)})
check("an uploaded draft keeps its markup", s == 200 and revision(rid)["sha"] == before["sha"], s)
s, view = call("GET", f"/revisions/{rid}/onlyoffice/view-config", author)
check("viewer shows markup while drafting", view["editorConfig"]["customization"]["review"]["reviewDisplay"] == "markup")
open(S + "/rid.txt", "w").write(rid)

sql(f"update document_revisions set status_code='READY_FOR_PUBLISHING', editing_status='COMPLETED', source_locked=true where id='{rid}'")
s, view = call("GET", f"/revisions/{rid}/onlyoffice/view-config", author)
check("viewer shows final text after approval", s == 200 and view["editorConfig"]["customization"]["review"]["reviewDisplay"] == "final", s)
s, b = call("POST", f"/revisions/{rid}/publishing-workspace/generate-preview", dco, body={})
check("publishing preview generated", s == 200, (s, b if s != 200 else ""))
if s == 200:
    path = sql(f"select preview_file_path from document_revisions where id='{rid}'")
    key = re.match(r"minio://([^?]+)", path).group(1)
    import subprocess
    pdf = subprocess.check_output(["docker", "exec", "eqms-compare-minio", "mc", "cat", "t/" + key])
    open(S + "/publishing_preview.pdf", "wb").write(pdf)
    reader = PdfReader(io.BytesIO(pdf))
    text = " ".join(page.extract_text() for page in reader.pages)
    compact = text.replace(" ", "")
    check("PDF has the accepted insertion", "INSERTEDWORD" in compact, text[:200])
    check("PDF has no deleted paragraph", "xoá" not in text and "bảnmới" not in compact)
    check("PDF has no comment text", "SECRETCOMMENT" not in compact)
    check("PDF has no comment annotation", not any(page.get("/Annots") for page in reader.pages))
check("the stored draft file keeps its markup", revision(rid)["sha"] == before["sha"])
sql(f"update document_revisions set status_code='PENDING_REVIEW' where id='{rid}'")
print(f"\n{sum(results)}/{len(results)} passed")
