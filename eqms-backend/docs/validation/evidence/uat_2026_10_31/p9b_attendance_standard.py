"""Part 9b: the signatures of the attendance list (APD.0117) are written in the Standard frame; no line "Signed electronically" stands for a signature."""
import sys, io, zipfile, re
sys.path.insert(0, 'D:/tmp/pymupdf')
from lib7 import *
import urllib.request
import api as _api

def fetch(path):
    req = urllib.request.Request(_api.BASE + path); req.add_header('Authorization', 'Bearer ' + admin.token)
    with admin.opener.open(req) as resp:
        return resp.read()

step('J-6 the attendance list of an activity with signed roll calls')
act = 'cb654097-a08a-41d2-8dbf-6c04220984b8'
raw = fetch(f'/training/activities/{act}/attendance-list?format=docx')
z = zipfile.ZipFile(io.BytesIO(raw)); xml = z.read('word/document.xml').decode('utf-8')
text = re.sub(r'<w:br[^>]*/>|</w:p>', '\n', xml); text = re.sub(r'<[^>]+>', '', text)
print('TEXT:', repr(text[-1500:]), flush=True)
check('J-6.1 the signatures say "Electronically ..." and the date and time (the Standard frame)', re.search(r'Electronically [a-z ]+\n\d\d/\d\d/\d{4} \d\d:\d\d \(UTC[+-]\d\d', text) is not None, '')
check('J-6.2 no line "Signed electronically" and no "Ký điện tử / Signed ..." status line', 'Signed electronically' not in text and 'Ký điện tử / ' not in text, '')
check('J-6.3 the meaning of an attendance signature is Attendance Has Been Taken', 'attendance has been taken' in text.lower(), '')
check('J-6.4 an acronym keeps its capitals (sent to QA)', 'sent to QA' in text and 'sent to qa' not in text, '')
finish('p9b')
