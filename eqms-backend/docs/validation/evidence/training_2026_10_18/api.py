"""Small DEV API client: logs in as a test user (password from the environment variable DEVPW, never written to disk) and calls the backend."""
import json, os, sys, urllib.request, urllib.error, http.cookiejar

BASE = 'http://localhost:5000/api'

class Client:
    def __init__(self, username):
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.token = None
        r = self.call('POST', '/auth/login', {'username': username, 'password': os.environ['DEVPW']})
        self.user = r.get('user', r)
        self.token = r.get('accessToken') or r.get('token') or (r.get('tokens') or {}).get('accessToken')
        if not self.token:
            for c in self.jar:
                if c.name == 'accessToken' and c.value:
                    self.token = c.value

    def upload(self, path, field, filename, content, content_type, params=''):
        boundary = '----e2eboundary7d4a'
        nl = chr(13) + chr(10)
        head = '--' + boundary + nl + 'Content-Disposition: form-data; name="' + field + '"; filename="' + filename + '"' + nl + 'Content-Type: ' + content_type + nl + nl
        body = head.encode() + content + (nl + '--' + boundary + '--' + nl).encode()
        req = urllib.request.Request(BASE + path + params, data=body, method='POST')
        req.add_header('Content-Type', 'multipart/form-data; boundary=' + boundary)
        req.add_header('Authorization', 'Bearer ' + self.token)
        try:
            with self.opener.open(req) as resp:
                return json.loads(resp.read() or b'{}')
        except urllib.error.HTTPError as e:
            raise SystemExit(f'UPLOAD {path} -> {e.code} {e.read()[:300]}')

    def call(self, method, path, body=None, raw=False):
        data = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(BASE + path, data=data, method=method)
        req.add_header('Content-Type', 'application/json')
        if self.token:
            req.add_header('Authorization', 'Bearer ' + self.token)
        try:
            with self.opener.open(req) as resp:
                payload = resp.read()
                if raw:
                    return resp.status, payload
                return json.loads(payload) if payload else {}
        except urllib.error.HTTPError as e:
            payload = e.read()
            try:
                body = json.loads(payload)
            except Exception:
                body = payload[:200]
            if raw:
                return e.code, payload
            raise SystemExit(f'{method} {path} -> {e.code} {body}')

def tick_all(client, session_id):
    """Tick the four lines of the Preparation checklist of a session: the server starts the training only when they are done."""
    for item in ('VENUE', 'EQUIPMENT', 'MATERIALS', 'NOTICE'):
        client.call('PUT', f'/training/sessions/{session_id}/preparation/{item}', {'status': 'DONE'})


def finish_for_qa(client, aid, token):
    """The trainer's steps that come before 'Send results to QA': send the attendance list, then finish the training (each signed). Idempotent; a refusal is left for the caller's own check to show."""
    for step, done in (('send-attendance-list', 'attendanceSentAt'), ('finish-training', 'resultsFinishedAt')):
        a = client.call('GET', f'/training/activities/{aid}')
        if a.get(done):
            continue
        client.call('POST', f'/training/activities/{aid}/{step}', {'version': a['version'], 'signatureToken': token()}, raw=True)


if __name__ == '__main__':
    c = Client(sys.argv[1])
    print('token' if c.token else 'no token', list(c.user.keys())[:6])
