import json, urllib.request, re, collections, concurrent.futures as cf
B="http://localhost:5100/api";PW=__import__("os").environ["PROBE_PW"]
def call(p,t,m="GET"):
    r=urllib.request.Request(B+p,method=m,headers={"Authorization":"Bearer "+t})
    try:
        x=urllib.request.urlopen(r,timeout=40);return x.status,x.read()
    except urllib.error.HTTPError as e:return e.code,e.read()
    except Exception: return -1,b""
lg=lambda u:json.loads(urllib.request.urlopen(urllib.request.Request(B+"/auth/login",method="POST",data=json.dumps({"username":u,"password":PW}).encode(),headers={"Content-Type":"application/json"})).read())["accessToken"]
tn=lg(__import__("os").environ["PROBE_USER"]); ta=lg("admin")
def ids(p,t,n=400,key="id"):
    out=[];pg=1
    while len(out)<n and pg<=n//100+1:
        s,b=call(f"{p}{'&' if '?' in p else '?'}limit=100&page={pg}",t)
        if s!=200: break
        j=json.loads(b); d=j.get("data") or j.get("content") or (j if isinstance(j,list) else [])
        out+= [x[key] for x in d if isinstance(x,dict) and key in x]
        if len(d)<100: break
        pg+=1
    return out
sets={}
for kind,p in {"documents":"/documents","revisions":"/revisions","copies":"/controlled-copies"}.items():
    mine=set(ids(p,tn,600)); allids=ids(p,ta,600); sets[kind]=[i for i in allids if i not in mine][:3]
    print(kind,"hidden ids tried:",len(sets[kind]))
ep=json.load(open("endpoints.json"))
prefix={"documents":"/documents/{","revisions":"/revisions/{","copies":"/controlled-copies/{"}
tests=[]
for kind,pre in prefix.items():
    for e in ep:
        if e["method"]!="GET" or not e["path"].startswith(pre): continue
        vars_=re.findall(r"\{([^}]*)\}",e["path"])
        if len(vars_)!=1: continue
        for i in sets[kind]: tests.append((kind,e["path"],re.sub(r"\{[^}]*\}",i,e["path"])))
def one(t):
    s,b=call(t[2],tn); return t,s,len(b)
res=[]
with cf.ThreadPoolExecutor(6) as ex: res=list(ex.map(one,tests))
agg=collections.defaultdict(list)
for (k,pat,url),s,l in res: agg[(k,pat)].append(s)
leaks=[(k,p,v) for (k,p),v in agg.items() if 200 in v]
print("endpoints x hidden ids:",len(res),"| endpoint patterns:",len(agg))
print("answered 403/404 for every hidden id:",sum(1 for v in agg.values() if 200 not in v and not any(x==500 for x in v)))
print("== patterns that returned 200 to a person without access to the record:")
for k,p,v in sorted(leaks): print(" ",k,p,v)
print("== patterns with 500:", [(k,p) for (k,p),v in agg.items() if 500 in v])
