import os, json, urllib.request, urllib.error
BASE = 'http://localhost:5000/api'
_tok = {}
def call(method, path, body=None, tok=None):
    h = {'Content-Type': 'application/json'}
    if tok: h['Authorization'] = 'Bearer ' + tok
    req = urllib.request.Request(BASE + path, data=None if body is None else json.dumps(body).encode(), headers=h, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=60); raw = r.read()
        return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode('utf-8', 'replace')
        try: return e.code, json.loads(raw)
        except Exception: return e.code, raw[:400]
def login(u):
    if u not in _tok:
        s, b = call('POST', '/auth/login', {'username': u, 'password': os.environ['DEVPW']})
        assert s == 200, (u, s, b)
        _tok[u] = b['accessToken']
    return _tok[u]
def sign(u):
    s, b = call('POST', '/auth/verify-signature', {'username': u, 'password': os.environ['DEVPW']}, login(u))
    assert s == 200, (s, b)
    return b['signatureToken']
def A(u, method, path, body=None): return call(method, path, body, login(u))
