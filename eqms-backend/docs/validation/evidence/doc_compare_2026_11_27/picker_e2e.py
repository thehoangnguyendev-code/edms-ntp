"""Reviewer: choose the revision to compare with in the full-screen editor, see it, close it."""
import io, re, sys, time, zipfile
sys.stdout.reconfigure(encoding="utf-8")
S = sys.argv[1]
exec(open(S + "/e2e.py", encoding="utf-8").read().split("author, trainee = login(")[0].replace("sys.stdout.reconfigure", "(lambda **k: 0)"))
from playwright.sync_api import sync_playwright
author, reviewer, trainee = login("author.test1"), login("reviewer.test1"), login("trainee.test1")
OLD = sql(f"select id from document_revisions where document_id='{DOC}' and status_code='OBSOLETED' limit 1")
new = open(S + "/spike/new.docx", "rb").read()
s, created = call("POST", f"/documents/{DOC}/revisions/upload", author, files={"file": ("n.docx", new)})
assert s == 200, (s, created)
rid = created["id"]
s, b = call("GET", f"/revisions/{rid}/comparison-baselines", author)
check("author's draft lists the effective revision first, then the obsoleted one", s == 200 and [x["statusCode"] for x in b] == ["EFFECTIVE", "OBSOLETED"], b)
sql(f"update document_revisions set status_code='PENDING_REVIEW', editing_status='COMPLETED', source_locked=true where id='{rid}'")
s, listed = call("GET", f"/revisions/{rid}/comparison-baselines", reviewer)
ids = [x["revisionId"] for x in listed]
check("reviewer gets the revisions to choose from", s == 200 and EFF in ids, listed)
s, b = call("GET", f"/revisions/{rid}/comparison-baselines", trainee)
check("refused to a person who cannot view the revision", s == 403, s)
other = sql(f"select id from document_revisions where document_id<>'{DOC}' and status_code='EFFECTIVE' limit 1")
s, b = call("GET", f"/revisions/{rid}/onlyoffice/compare-config?baselineId={other}", reviewer)
check("a revision of another document is refused", s >= 400, (s, b))


def compared(baseline):
    s, config = call("GET", f"/revisions/{rid}/onlyoffice/compare-config?baselineId={baseline}", reviewer)
    assert s == 200, (s, config)
    content = call("GET", config["document"]["url"].replace("host.docker.internal", "localhost"), raw=True)[1]
    xml = zipfile.ZipFile(io.BytesIO(content)).read("word/document.xml").decode()
    return config, " ".join(re.findall(r"<w:delText[^>]*>([^<]*)<", xml))


config, removed = compared(EFF)
check("compared with the effective revision", "Đoạn này sẽ bị xoá" in removed, removed)
if OLD in ids:
    config2, removed2 = compared(OLD)
    check("compared with the obsoleted revision", "lau bụi" in removed2 and config2["document"]["key"] != config["document"]["key"], removed2)

BASE = "http://localhost:3113"
with sync_playwright() as pw:
    br = pw.chromium.launch(channel="msedge", headless=True)
    p = br.new_page(viewport={"width": 1600, "height": 900})
    errors = []
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.goto(BASE + "/login", wait_until="domcontentloaded"); p.wait_for_timeout(8000)
    p.locator("input").nth(0).press_sequentially("reviewer.test1", delay=30)
    p.locator("input[type=password]").press_sequentially(PW, delay=20); p.keyboard.press("Enter"); p.wait_for_timeout(8000)
    p.goto(f"{BASE}/documents/revisions/{rid}/onlyoffice-editor", wait_until="domcontentloaded"); p.wait_for_timeout(18000)
    button = p.get_by_role("button", name="Compare with Effective")
    check("button in the review editor", button.count() == 1 and button.is_enabled(), button.count())
    button.click(); p.wait_for_timeout(1500)
    p.screenshot(path=S + "/picker.png")
    check("chooser lists both revisions", p.get_by_role("radio").count() == len(ids), p.get_by_role("radio").count())
    p.get_by_role("button", name="Compare", exact=True).click(); p.wait_for_timeout(20000)
    p.screenshot(path=S + "/comparing.png")
    check("comparison and Close Compare shown", p.get_by_role("button", name="Close Compare").count() == 1 and p.locator("iframe").count() >= 2, p.locator("iframe").count())
    p.get_by_role("button", name="Close Compare").click(); p.wait_for_timeout(3000)
    p.screenshot(path=S + "/closed.png")
    check("editor is back", p.get_by_role("button", name="Close Compare").count() == 0 and p.locator("iframe").count() >= 1)
    check("no page error", not errors, errors[:2])
    br.close()
print(f"\n{sum(results)}/{len(results)} passed; listed {len(ids)}")
