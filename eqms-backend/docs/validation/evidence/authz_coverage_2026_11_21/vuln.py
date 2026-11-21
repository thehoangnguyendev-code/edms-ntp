import json, urllib.request, base64, time, re
B="http://localhost:5100/api";PW=__import__("os").environ["PROBE_PW"]
def raw(m,p,body=None,h=None,base=B,rawbody=None):
    hh={"Content-Type":"application/json"}; hh.update(h or {})
    d=rawbody if rawbody is not None else (None if body is None else json.dumps(body).encode())
    r=urllib.request.Request(base+p,method=m,data=d,headers=hh)
    try:
        x=urllib.request.urlopen(r,timeout=30);return x.status,x.headers,x.read()
    except urllib.error.HTTPError as e:return e.code,e.headers,e.read()
def login(u,p=PW):
    s,h,b=raw("POST","/auth/login",{"username":u,"password":p}); return s,h,b
s,h,b=login("admin"); ta=json.loads(b)["accessToken"]
s2,h2,b2=login(__import__("os").environ["PROBE_USER"]); tn=json.loads(b2)["accessToken"]
A=lambda t:{"Authorization":"Bearer "+t}
print("== 1 login response headers / cookies")
for k in ("Set-Cookie","X-Content-Type-Options","X-Frame-Options","Strict-Transport-Security","Content-Security-Policy","Cache-Control","Referrer-Policy"):
    print(" ",k,":",h.get_all(k) if k=="Set-Cookie" else h.get(k))
print("== 2 security headers on a normal GET")
s,hh,_=raw("GET","/auth/me",h=A(ta))
for k in ("X-Content-Type-Options","X-Frame-Options","Strict-Transport-Security","Content-Security-Policy","Cache-Control","Referrer-Policy","Server","X-Powered-By"): print(" ",k,":",hh.get(k))
print("== 3 actuator / docs reachability (no token | normal user)")
base="http://localhost:5100"
for p in ["/actuator","/actuator/metrics","/actuator/health","/actuator/info","/api/actuator/metrics","/api/v3/api-docs","/api/swagger-ui/index.html","/swagger-ui.html","/api/h2-console","/api/actuator/env","/api/actuator/heapdump"]:
    a=raw("GET",p,base=base)[0]; n=raw("GET",p,h=A(tn),base=base)[0]; print(f"  {p:32s} anon={a} noperm={n}")
print("== 4 CORS with a foreign origin")
s,hh,_=raw("GET","/auth/password-policy",h={"Origin":"https://evil.example"}); print("  GET acao:",hh.get("Access-Control-Allow-Origin"),"cred:",hh.get("Access-Control-Allow-Credentials"))
s,hh,_=raw("OPTIONS","/auth/me",h={"Origin":"https://evil.example","Access-Control-Request-Method":"GET"}); print("  preflight",s,"acao:",hh.get("Access-Control-Allow-Origin"))
print("== 5 forged / tampered tokens on /auth/me")
def b64(x): return base64.urlsafe_b64encode(x).rstrip(b"=").decode()
hdr,pl,sg=ta.split(".")
payload=json.loads(base64.urlsafe_b64decode(pl+"=="))
none_tok=b64(json.dumps({"alg":"none","typ":"JWT"}).encode())+"."+pl+"."
print("  alg=none ->",raw("GET","/auth/me",h=A(none_tok))[0])
print("  tampered signature ->",raw("GET","/auth/me",h=A(hdr+"."+pl+"."+sg[:-3]+"AAA"))[0])
payload2=dict(payload); payload2["sub"]="00000000-0000-0000-0000-000000000000"
print("  tampered payload ->",raw("GET","/auth/me",h=A(hdr+"."+b64(json.dumps(payload2).encode())+"."+sg))[0])
print("  garbage ->",raw("GET","/auth/me",h=A("abc"))[0],"| no token ->",raw("GET","/auth/me")[0])
print("  token claims:",{k:(v if k not in('sub',) else '<id>') for k,v in payload.items()})
print("== 6 error bodies must not leak internals")
for lab,(m,p,b) in {"malformed json":("POST","/auth/login",b"{bad"),"wrong type":("PUT","/auth/me/profile",b'{"fullName":123456,"x":[1]}'),"huge limit":("GET","/documents?limit=99999999&page=-5",None)}.items():
    s,_,body=raw(m,p,h=A(ta),rawbody=b) if b else raw(m,p,h=A(ta))
    t=body.decode("utf-8","replace"); leak=bool(re.search(r"Exception|at com\.|org\.springframework|\.java:|SQL|stack",t))
    print(f"  {lab:15s} -> {s} leak={leak} {t[:110]!r}")
print("== 7 user enumeration at login")
t0=time.time();a=login("admin","wrong-password-1")[::2];ta_=time.time()-t0
t0=time.time();b_=login("no.such.user.zzz","wrong-password-1")[::2];tb=time.time()-t0
print("  existing user  :",a[0],a[1][:120],f"{ta_*1000:.0f}ms"); print("  unknown user   :",b_[0],b_[1][:120],f"{tb*1000:.0f}ms")
