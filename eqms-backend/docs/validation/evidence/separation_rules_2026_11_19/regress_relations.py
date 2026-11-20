import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'phase1.py'), encoding='utf-8').read().split('try:')[0])

def rows(pid, forbidden):
    return sorted(q("select relation_definition_id from workflow_action_policy_relations where policy_id='%s' and forbidden=%s" % (pid, forbidden)).split())

def put(path, body):
    body['signatureToken'] = sign('admin'); body['reason'] = 'regression test'
    return A('admin', 'PUT', path, body)

# required relations (policy with one required relation)
pid = '00bf8c3e-0f5d-4670-9355-05a5f010278b'
before = rows(pid, 'false'); fb = rows(pid, 'true')
r = put('/authorization/workflow-policies/%s/relations' % pid, {'relationDefinitionIds': before, 'relationMatchRule': 'ANY'})
expect('required relations: saving the same set keeps them (%d)' % len(before), r[0] == 200 and rows(pid, 'false') == before, r[0])
r = put('/authorization/workflow-policies/%s/relations' % pid, {'relationDefinitionIds': [], 'relationMatchRule': 'ANY'})
expect('required relations: saving an empty set removes them', r[0] == 200 and rows(pid, 'false') == [], (r[0], rows(pid, 'false')))
r = put('/authorization/workflow-policies/%s/relations' % pid, {'relationDefinitionIds': before, 'relationMatchRule': 'ANY'})
expect('required relations: put back as they were', r[0] == 200 and rows(pid, 'false') == before, (r[0], rows(pid, 'false')))
expect('required relations: the forbidden ones were not touched', rows(pid, 'true') == fb, rows(pid, 'true'))

# forbidden relations (report template approval has two forbidden, no required)
pid = '07bbb4bd-ffdc-4a94-a868-828e0fe79d79'
fb = rows(pid, 'true'); rq = rows(pid, 'false')
r = put('/authorization/workflow-policies/%s/forbidden-relations' % pid, {'relationDefinitionIds': fb})
expect('forbidden relations: saving the same two keeps them', r[0] == 200 and rows(pid, 'true') == fb, (r[0], rows(pid, 'true')))
r = put('/authorization/workflow-policies/%s/forbidden-relations' % pid, {'relationDefinitionIds': fb[:1]})
expect('forbidden relations: saving one removes the other', r[0] == 200 and rows(pid, 'true') == fb[:1], (r[0], rows(pid, 'true')))
r = put('/authorization/workflow-policies/%s/forbidden-relations' % pid, {'relationDefinitionIds': fb})
expect('forbidden relations: put back both', r[0] == 200 and rows(pid, 'true') == fb, (r[0], rows(pid, 'true')))
expect('forbidden relations: the required ones were not touched', rows(pid, 'false') == rq, rows(pid, 'false'))
print('\n%d/%d passed' % (sum(R), len(R)))
