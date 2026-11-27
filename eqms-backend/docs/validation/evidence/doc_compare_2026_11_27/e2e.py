"""End-to-end check of 'next revision from the Effective file' and 'Compare with Effective' on the isolated stack (:5100)."""
import hashlib, io, json, re, subprocess, sys, urllib.request, uuid, zipfile
sys.stdout.reconfigure(encoding="utf-8")
S = sys.argv[1]
API = "http://localhost:5100/api"
PW = open(S + "/pw.txt").read()
DOC = "9627fd1c-cb14-4164-921f-4b1c4f1bdfdd"
EFF = "90b75400-d8c1-403a-9f52-094eb81d6a3a"
results = []


def check(name, ok, detail=""):
    results.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (" -- " + str(detail)[:260] if detail else ""))


def sql(q):
    return subprocess.check_output(["docker", "exec", "eqms-postgres", "psql", "-U", "eqms", "-d", "eqms_compare_clone", "-Atc", q]).decode("utf-8").strip()


def call(method, path, token=None, body=None, files=None, raw=False):
    headers = {"Accept": "application/json"}
    data = None
    if token:
        headers["Authorization"] = "Bearer " + token
    if files is not None:
        boundary = uuid.uuid4().hex
        data = b""
        for key, value in files.items():
            if isinstance(value, tuple):
                data += (f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"; filename="{value[0]}"\r\n'
                         "Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n\r\n").encode() + value[1] + b"\r\n"
            else:
                data += f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode()
        data += f"--{boundary}--\r\n".encode()
        headers["Content-Type"] = "multipart/form-data; boundary=" + boundary
    elif body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    try:
        with urllib.request.urlopen(urllib.request.Request(path if path.startswith("http") else API + path, data, headers, method=method), timeout=200) as r:
            content = r.read()
            return r.status, content if raw else json.loads(content or b"null")
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(text)
        except ValueError:
            return e.code, text


def login(user):
    status, body = call("POST", "/auth/login", body={"username": user, "password": PW})
    assert status == 200 and body.get("accessToken"), (user, status, body)
    return body["accessToken"]


def revision(rid):
    row = sql(f"select status_code, file_path, source_file_checksum, file_name, coalesce(parent_revision_id::text,'') from document_revisions where id='{rid}'")
    return dict(zip(["status", "path", "sha", "name", "parent"], row.split("|")))


author, trainee = login("author.test1"), login("trainee.test1")
before = revision(EFF)

s, b = call("GET", f"/documents/{DOC}/effective-source", author)
check("option offered to the author", s == 200 and b["available"], b)
s, b = call("GET", f"/documents/{DOC}/effective-source", trainee)
check("option refused without upload permission", s == 403, (s, b))
s, b = call("POST", f"/documents/{DOC}/revisions/upload", trainee, files={"useEffectiveSource": "true"})
check("create refused without upload permission", s == 403, (s, b))
old = open(S + "/spike/old.docx", "rb").read()
new = open(S + "/spike/new.docx", "rb").read()
s, b = call("POST", f"/documents/{DOC}/revisions/upload", author, files={"useEffectiveSource": "true", "file": ("x.docx", new)})
check("two sources at once refused", s in (400, 422) and "REVISION_SOURCE_CHOICE_CONFLICT" in json.dumps(b), (s, b))
s, b = call("POST", f"/documents/{DOC}/revisions/upload", author, files={"changeDescription": "no source"})
check("no source refused", s in (400, 422), (s, b))

s, created = call("POST", f"/documents/{DOC}/revisions/upload", author, files={"useEffectiveSource": "true", "changeDescription": "compare e2e"})
check("revision created from the effective file", s == 200, (s, created if s != 200 else created.get("revisionNumber")))
if s != 200:
    sys.exit(1)
rid = created["id"]
draft = revision(rid)
check("copy has the same content", draft["sha"] == before["sha"] == hashlib.sha256(old).hexdigest(), draft["sha"])
check("copy has its own storage object", draft["path"] != before["path"], draft["path"])
check("parent is the effective revision", draft["parent"] == EFF, draft["parent"])
check("effective revision untouched", revision(EFF) == before)
check("audit trail names the source", sql(f"select count(*) from audit_logs where entity_id='{rid}' and action_type='REVISION_SOURCE_COPIED_FROM_EFFECTIVE'") == "1")

s, info = call("GET", f"/revisions/{rid}/comparison-info", author)
check("comparison offered, clean file", s == 200 and info["comparisonAvailable"] and info["trackedChanges"] == 0, info)

s, b = call("POST", f"/revisions/{rid}/upload", author, files={"file": ("changed.docx", new)})
check("draft file replaced", s == 200, (s, b if s != 200 else ""))
check("effective revision still untouched after editing the draft", revision(EFF) == before)
subprocess.run(["docker", "exec", "eqms-compare-minio", "sh", "-c", "mc cat t/eqms-gmp-revisions/documents/INS.9703/eff/source.docx | sha256sum > /tmp/sha"], check=True)
stored = subprocess.check_output(["docker", "exec", "eqms-compare-minio", "cat", "/tmp/sha"]).decode().split()[0]
check("effective stored bytes unchanged", stored == before["sha"], stored)


def viewer_file(token):
    s, config = call("GET", f"/revisions/{rid}/onlyoffice/compare-config", token)
    if s != 200:
        return s, config, None
    url = config["document"]["url"].replace("host.docker.internal", "localhost")
    s2, content = call("GET", url, raw=True)
    assert s2 == 200, (s2, content)
    return s, config, content


s, config, content = viewer_file(author)
check("comparison config made", s == 200, config if s != 200 else config["document"]["title"])
if content:
    p = config["document"]["permissions"]
    check("read only: no edit, comment, download, print", not any(p[k] for k in ("edit", "review", "comment", "download", "print")), p)
    check("view mode with markup", config["editorConfig"]["mode"] == "view" and config["editorConfig"]["customization"]["review"]["reviewDisplay"] == "markup")
    xml = zipfile.ZipFile(io.BytesIO(content)).read("word/document.xml").decode()
    inserted = " ".join(re.findall(r"<w:ins [^>]*>(.*?)</w:ins>", xml, re.S))
    deleted = "".join(re.findall(r"<w:delText[^>]*>([^<]*)<", xml))
    check("insertion shown", "khử trùng" in inserted)
    check("deletion shown", "Đoạn này sẽ bị xoá" in deleted, deleted)
    check("table cell change shown", "70" in deleted)
    check("key of the viewer config", True, config["document"]["key"])
    bad = config["document"]["url"].replace("host.docker.internal", "localhost").replace(rid, EFF)
    s3, b3 = call("GET", bad)
    check("token of one revision refused for another", s3 >= 400, s3)
    s4, config2, _ = viewer_file(author)
    check("same files give the same cached comparison", config2["document"]["key"] == config["document"]["key"])
    call("POST", f"/revisions/{rid}/upload", author, files={"file": ("again.docx", old)})
    s5, config3, content3 = viewer_file(author)
    check("changed file gives a new comparison", config3["document"]["key"] != config["document"]["key"])
    check("comparison viewing is in the audit trail", int(sql(f"select count(*) from audit_logs where entity_id='{rid}' and action_type='VIEW_COMPARISON'")) >= 3)

s, b = call("GET", f"/revisions/{rid}/onlyoffice/compare-config", trainee)
check("comparison refused to a person who cannot view the revision", s == 403, (s, b))
s, b = call("GET", f"/revisions/{rid}/comparison-info", trainee)
check("comparison info refused likewise", s == 403, s)
s, b = call("GET", f"/revisions/{EFF}/comparison-info", author)
check("effective revision itself is not compared", s == 200 and not b["comparisonAvailable"], b)

# a draft with markup: the counts are reported and nothing is blocked
tracked = open(S + "/spike/http_result.docx", "rb").read()
s, b = call("POST", f"/revisions/{rid}/upload", author, files={"file": ("tracked.docx", tracked)})
s, info = call("GET", f"/revisions/{rid}/comparison-info", author)
check("tracked changes counted", s == 200 and info["trackedChanges"] > 0, info)

s, b = call("POST", f"/revisions/{rid}/source-from-effective", trainee)
check("replace-with-effective refused without permission", s == 403, s)
s, b = call("POST", f"/revisions/{rid}/source-from-effective", author)
check("existing draft takes the effective file again", s == 200 and revision(rid)["sha"] == before["sha"], (s, b if s != 200 else ""))
check("effective revision untouched at the end", revision(EFF) == before)
s, b = call("POST", f"/revisions/{EFF}/source-from-effective", author)
check("not allowed on a non-draft revision", s >= 400, s)

# legacy document whose effective revision is a PDF only
sql(f"update document_revisions set file_name='scan.pdf', file_type='application/pdf' where id='{EFF}'")
s, b = call("GET", f"/documents/{DOC}/effective-source", author)
check("PDF-only effective revision: not available, with the reason", s == 200 and not b["available"] and b["unavailableReason"] == "EFFECTIVE_HAS_NO_DOCX", b)
s, b = call("POST", f"/revisions/{rid}/source-from-effective", author)
check("PDF-only effective revision: copy refused", s >= 400 and "EFFECTIVE_HAS_NO_DOCX" in json.dumps(b), (s, b))
sql(f"update document_revisions set file_name='INS.9703_Compare test.docx', file_type=null where id='{EFF}'")

# leave a changed draft for the browser check
call("POST", f"/revisions/{rid}/upload", author, files={"file": ("changed.docx", new)})
open(S + "/rid.txt", "w").write(rid)
print(f"\n{sum(results)}/{len(results)} passed; revision {rid}")
