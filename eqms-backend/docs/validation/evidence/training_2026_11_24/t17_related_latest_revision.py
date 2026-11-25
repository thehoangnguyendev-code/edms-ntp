"""T17: the revision of a related document that the training shows and opens is the latest one that is not closed (the one released with the document), never an older one in force."""
from lib24 import *
import lib31


def new_doc(name, requires=True, related=None):
    body = {'documentName': name, 'documentType': 'Standard Operating Procedure', 'businessUnit': 'Quality Unit', 'department': 'Quality Assurance', 'author': admin.user['id'], 'language': 'English',
            'requiresTraining': requires, 'trainingPeriodDays': 14 if requires else None, 'description': 'RUN24 ' + name, 'isTemplate': False, 'coAuthorIds': [],
            'reviewerUserIds': [dco.user['id']], 'approverUserIds': [qa.user['id']], 'relatedDocumentIds': related or [], 'correlatedDocumentIds': []}
    if not requires:
        body['reasonForSkippingTraining'] = 'RUN24 form: level 4'
    return admin.call('POST', '/documents', body)


form = new_doc('RUN24 form with two revisions (T17)', requires=False)
r1 = admin.call('POST', f"/documents/{form['id']}/revisions", {})['id']
check('T17.1 revision 1 approved', not approve_revision(r1, 'RUN24 rev 1', 'RUN24'), '')
st, problems = publish_revision(r1)
check('T17.2 revision 1 is Effective', str(st).upper() == 'EFFECTIVE' or str(admin.call('GET', f'/revisions/{r1}').get('status')).upper() == 'EFFECTIVE', (st, problems))
sop = new_doc('RUN24 SOP that lists the form (T17)', related=[form['id']])
aid = rows_of_document(sop['documentNumber'])[0]['id']
rev1 = admin.call('GET', f'/revisions/{r1}').get('revisionNumber')
r2 = admin.call('POST', f"/documents/{form['id']}/revisions", {})['id']
rev2 = admin.call('GET', f'/revisions/{r2}').get('revisionNumber')
print('revisions:', rev1, rev2)
src = admin.call('GET', f'/training/activities/{aid}/document-sources')
row = [d for d in src['documents'] if d['documentNumber'] == form['documentNumber']][0]
print('row:', row)
check('T17.3 the form is shown with the NEW revision (not the one in force)', row['revisionId'] == r2 and row['revisionNumber'] == rev2, row)
check('T17.4 the new revision is not approved yet: no Open, marked as changed', row['approved'] is False and row['unchanged'] is False, row)
check('T17.5 after its approval the new revision is shown as approved (and is the one to open)', not approve_revision(r2, 'RUN24 rev 2', 'RUN24'), '')
src = admin.call('GET', f'/training/activities/{aid}/document-sources')
row = [d for d in src['documents'] if d['documentNumber'] == form['documentNumber']][0]
check('T17.6 approved and still the new revision', row['revisionId'] == r2 and row['approved'] is True, row)
