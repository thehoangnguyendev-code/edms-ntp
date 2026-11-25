"""T7: the Due Date appears once on General Information, in the state Reserved (a new SOP not approved yet), as the owner's screenshot of 2026-11-24 showed it twice."""
from lib24 import *
import lib31

b = Browser()
body = {'documentName': 'RUN24 SOP for the Reserved screen', 'documentType': 'Standard Operating Procedure', 'businessUnit': 'Quality Unit', 'department': 'Quality Control', 'author': admin.user['id'],
        'language': 'English', 'requiresTraining': True, 'trainingPeriodDays': 14, 'description': 'RUN24', 'isTemplate': False, 'coAuthorIds': [], 'reviewerUserIds': [dco.user['id']],
        'approverUserIds': [qa.user['id']], 'relatedDocumentIds': [], 'correlatedDocumentIds': []}
doc = admin.call('POST', '/documents', body)
admin.call('POST', f"/documents/{doc['id']}/revisions", {})
rows = rows_of_document(doc['documentNumber'])
aid = rows[0]['id']
a = get(aid)
print('status', a['status'])
check('T7.1 the activity is Reserved (waits for the document to be approved)', a['status'] == 'RESERVED', a['status'])
text = {}


def grab(pg):
    pg.wait_for_timeout(1500)
    text['t'] = pg.inner_text('main') if pg.locator('main').count() else pg.inner_text('body')


b.shot('admin', f'/training-management/activities/{aid}', 'T7-01', 'Reserved_general_information', 'T7: General Information ở trạng thái Reserved: Due Date chỉ một lần', action=grab, tall=True)
n = text.get('t', '').upper().count('DUE DATE')
check('T7.2 the words "Due Date" appear once as a field label on the screen', n == 1, n)
lib31.finish('T7', b)
