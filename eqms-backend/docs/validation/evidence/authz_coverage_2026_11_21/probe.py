import json, urllib.request, urllib.error, sys, time, concurrent.futures as cf
B="http://localhost:5100/api"; import os; PW=os.environ["PROBE_PW"]
def raw(m,p,body=None,t=None):
    h={"Content-Type":"application/json"}
    if t:h["Authorization"]="Bearer "+t
    r=urllib.request.Request(B+p,method=m,data=None if body is None else json.dumps(body).encode(),headers=h)
    try:
        x=urllib.request.urlopen(r,timeout=25);return x.status
    except urllib.error.HTTPError as e:return e.code
    except Exception as e:return -1
def login(u):
    r=urllib.request.Request(B+"/auth/login",method="POST",data=json.dumps({"username":u,"password":PW}).encode(),headers={"Content-Type":"application/json"})
    return json.loads(urllib.request.urlopen(r,timeout=30).read())["accessToken"]
NOPERM=os.environ["PROBE_USER"]
tn=login(NOPERM); ta=login("admin")
Z="00000000-0000-0000-0000-000000000000"
import re
eps=json.load(open("endpoints.json"))
SKIP=re.compile(r"^/(auth/(login|logout)|system/maintenance|health)")   # do not log out the probe sessions
def prep(p): return re.sub(r"\{[^}]*\}",Z,p)
def one(e):
    p=prep(e["path"]); m=e["method"]
    body={} if m in("POST","PUT","PATCH","DELETE") else None
    sn=raw(m,p,body,tn); 
    return {**e,"noperm":sn}
res=[]
todo=[e for e in eps if not SKIP.match(e["path"])]
with cf.ThreadPoolExecutor(8) as ex:
    for r in ex.map(one,todo): res.append(r)
json.dump(res,open("probe_results.json","w"))
import collections
c=collections.Counter(("2xx" if 200<=r["noperm"]<300 else r["noperm"]) for r in res); print(len(res),dict(c))
