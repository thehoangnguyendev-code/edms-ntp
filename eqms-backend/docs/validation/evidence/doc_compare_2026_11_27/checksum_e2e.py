"""MD5 records (older form) work; a changed file is refused by comparison, copy and publishing."""
import hashlib, sys
sys.stdout.reconfigure(encoding="utf-8")
S = sys.argv[1]
exec(open(S + "/e2e.py", encoding="utf-8").read().split("author, trainee = login(")[0].replace("sys.stdout.reconfigure", "(lambda **k: 0)"))
author, dco = login("author.test1"), login("dco.test1")
old = open(S + "/spike/old.docx", "rb").read()
new = open(S + "/spike/new.docx", "rb").read()
md5 = lambda b: hashlib.md5(b).hexdigest()
setsum = lambda rid, value: sql(f"update document_revisions set source_file_checksum='{value}' where id='{rid}'")
mismatch = lambda r: r[0] >= 400 and "REVISION_FILE_INTEGRITY_MISMATCH" in json.dumps(r[1])

setsum(EFF, md5(old))
s, created = call("POST", f"/documents/{DOC}/revisions/upload", author, files={"useEffectiveSource": "true"})
check("MD5 record: copy into the next revision works", s == 200, (s, created if s != 200 else ""))
rid = created["id"]
changes = sql(f"select new_value from audit_logs where entity_id='{rid}' and action_type='REVISION_SOURCE_COPIED_FROM_EFFECTIVE'")
check("and the audit trail calls it an identical copy", "identical copy" in changes, changes)
call("POST", f"/revisions/{rid}/upload", author, files={"file": ("n.docx", new)})
check("MD5 record: marked comparison works", call("GET", f"/revisions/{rid}/onlyoffice/compare-config?baselineId={EFF}", author)[0] == 200)
check("MD5 record: side by side works", call("GET", f"/revisions/{rid}/onlyoffice/side-by-side-config?baselineId={EFF}", author)[0] == 200)

setsum(EFF, md5(new))
check("wrong MD5 record is refused", mismatch(call("GET", f"/revisions/{rid}/onlyoffice/side-by-side-config?baselineId={EFF}", author)))
setsum(EFF, md5(old))

sql(f"update document_revisions set status_code='READY_FOR_PUBLISHING', editing_status='COMPLETED', source_locked=true where id='{rid}'")
good = sql(f"select source_file_checksum from document_revisions where id='{rid}'")
r = call("POST", f"/revisions/{rid}/publishing-workspace/generate-preview", dco, body={})
check("publishing preview of an intact file", r[0] == 200, r if r[0] != 200 else "")
setsum(rid, "0" * 64)
r = call("POST", f"/revisions/{rid}/publishing-workspace/generate-preview", dco, body={})
check("publishing preview refused for a file that is not the recorded one", mismatch(r), r)
r = call("POST", f"/revisions/{rid}/publishing-workspace/publish", dco, body={})
check("publish refused too", r[0] >= 400, r)
check("revision stays Ready for Publishing", revision(rid)["status"] == "READY_FOR_PUBLISHING")
setsum(rid, good)
check("works again once record and file agree", call("POST", f"/revisions/{rid}/publishing-workspace/generate-preview", dco, body={})[0] == 200)
print(f"\n{sum(results)}/{len(results)} passed")
