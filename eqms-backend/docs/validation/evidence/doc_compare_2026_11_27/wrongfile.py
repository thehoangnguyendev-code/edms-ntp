"""Can any path show or store the wrong file? Tampered storage, a save between announcing and fetching, and an editor left open across a file replacement."""
import hashlib, io, re, sys, time, zipfile
sys.stdout.reconfigure(encoding="utf-8")
S = sys.argv[1]
exec(open(S + "/e2e.py", encoding="utf-8").read().split("author, trainee = login(")[0].replace("sys.stdout.reconfigure", "(lambda **k: 0)"))
from playwright.sync_api import sync_playwright
author, reviewer = login("author.test1"), login("reviewer.test1")
old = open(S + "/spike/old.docx", "rb").read()
new = open(S + "/spike/new.docx", "rb").read()
third = open(S + "/spike/v1.docx", "rb").read()
sha = lambda b: hashlib.sha256(b).hexdigest()
body = lambda b: re.sub(r"<[^>]+>", " ", zipfile.ZipFile(io.BytesIO(b)).read("word/document.xml").decode())
local = lambda url: url.replace("host.docker.internal", "localhost")

s, created = call("POST", f"/documents/{DOC}/revisions/upload", author, files={"file": ("n.docx", new)})
assert s == 200, (s, created)
rid = created["id"]
print("--- comparison: pinned to what was announced")
s, config = call("GET", f"/revisions/{rid}/onlyoffice/compare-config?baselineId={EFF}", author)
url = local(config["document"]["url"])
check("announced comparison is served", call("GET", url, raw=True)[0] == 200)
call("POST", f"/revisions/{rid}/upload", author, files={"file": ("t.docx", third)})
s, b = call("GET", url, raw=True)
check("after another save the old link is refused, not served with new content", s >= 400, s)
s, b = call("GET", url.split("&comparison=")[0], raw=True)
check("a link without the announced comparison is refused", s >= 400, s)

print("--- stored file swapped under the record")
eff_sha = sql(f"select source_file_checksum from document_revisions where id='{EFF}'")
sql(f"update document_revisions set source_file_checksum='{'0' * 64}' where id='{EFF}'")
for label, path in [("marked comparison", f"/revisions/{rid}/onlyoffice/compare-config?baselineId={EFF}"),
                    ("side by side", f"/revisions/{rid}/onlyoffice/side-by-side-config?baselineId={EFF}")]:
    s, b = call("GET", path, author)
    check(label + " refuses a file that is not the recorded one", s >= 400 and "REVISION_FILE_INTEGRITY_MISMATCH" in json.dumps(b), (s, b))
s, b = call("POST", f"/revisions/{rid}/source-from-effective", author)
check("copy into the next revision refuses it too", s >= 400 and "REVISION_FILE_INTEGRITY_MISMATCH" in json.dumps(b), (s, b))
sql(f"update document_revisions set source_file_checksum='{eff_sha}' where id='{EFF}'")

print("--- editor left open while the file is replaced")


def editor_session(replace):
    """Open the editor, type, replace the file behind it, then close the editor so the Document Server saves its own (old) copy."""
    with sync_playwright() as pw:
        br = pw.chromium.launch(channel="msedge", headless=True)
        p = br.new_page(viewport={"width": 1500, "height": 900})
        p.goto("http://localhost:3113/login", wait_until="domcontentloaded"); p.wait_for_timeout(7000)
        p.locator("input").nth(0).press_sequentially("author.test1", delay=20)
        p.locator("input[type=password]").press_sequentially(PW, delay=15); p.keyboard.press("Enter"); p.wait_for_timeout(8000)
        p.goto(f"http://localhost:3113/documents/revisions/{rid}/onlyoffice-editor", wait_until="domcontentloaded"); p.wait_for_timeout(16000)
        p.mouse.click(750, 420); p.keyboard.type(" TYPEDINOLDEDITOR", delay=30); p.wait_for_timeout(2000)
        replace()
        p.wait_for_timeout(2000)
        br.close()
    time.sleep(30)


def stored():
    path = sql(f"select file_path from document_revisions where id='{rid}'")
    key = re.match(r"minio://([^?]+)", path).group(1)
    import subprocess
    content = subprocess.check_output(["docker", "exec", "eqms-compare-minio", "mc", "cat", "t/" + key])
    return content, sql(f"select source_file_checksum from document_revisions where id='{rid}'")


def typed_is_saved():
    editor_session(lambda: None)
    content, recorded = stored()
    check("control: without a replacement the editor's typing is saved", "TYPEDINOLDEDITOR" in body(content) and sha(content) == recorded, body(content)[:120])


call("POST", f"/revisions/{rid}/upload", author, files={"file": ("n.docx", new)})
typed_is_saved()
for label, replace in [("Replace Source File", lambda: call("POST", f"/revisions/{rid}/upload", author, files={"file": ("t.docx", third)})),
                       ("Use Effective File", lambda: call("POST", f"/revisions/{rid}/source-from-effective", author))]:
    call("POST", f"/revisions/{rid}/upload", author, files={"file": ("n.docx", new)})
    expected = third if label == "Replace Source File" else old
    editor_session(replace)
    content, recorded = stored()
    check(label + ": the replaced file is not overwritten by the old editor", sha(content) == sha(expected) == recorded, body(content)[:160])
print(f"\n{sum(results)}/{len(results)} passed")
