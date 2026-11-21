import json, urllib.request, time, re
B="http://localhost:5100/api";PW=__import__("os").environ["PROBE_PW"]
lg=lambda u:json.loads(urllib.request.urlopen(urllib.request.Request(B+"/auth/login",method="POST",data=json.dumps({"username":u,"password":PW}).encode(),headers={"Content-Type":"application/json"})).read())["accessToken"]
ta=lg("admin")
ep=[e for e in json.load(open("endpoints.json")) if e["method"]=="GET" and "{" not in e["path"] and not re.search(r"/stream|/export|download|/logout|/maintenance|health",e["path"])]
rows=[]
for e in ep:
    r=urllib.request.Request(B+e["path"],headers={"Authorization":"Bearer "+ta})
    t=time.time()
    try:
        x=urllib.request.urlopen(r,timeout=60);b=x.read();s=x.status
    except urllib.error.HTTPError as ex: b=ex.read();s=ex.code
    except Exception as ex: b=b"";s=-1
    ms=(time.time()-t)*1000
    n=None
    try:
        j=json.loads(b)
        if isinstance(j,list): n=len(j)
        elif isinstance(j,dict): n=len(j.get("data") or j.get("content") or []) if ("data" in j or "content" in j) else None
    except Exception: pass
    rows.append({"path":e["path"],"status":s,"ms":round(ms),"bytes":len(b),"rows":n})
json.dump(rows,open("perf_results.json","w"))
ok=[r for r in rows if r["status"]==200]
print("GET endpoints without ids:",len(rows),"| 200:",len(ok))
print("== slowest (ms)");[print(f"  {r['ms']:6d} ms {r['bytes']//1024:6d} KB rows={r['rows']} {r['path']}") for r in sorted(ok,key=lambda r:-r["ms"])[:15]]
print("== biggest payloads");[print(f"  {r['bytes']//1024:6d} KB {r['ms']:5d} ms rows={r['rows']} {r['path']}") for r in sorted(ok,key=lambda r:-r["bytes"])[:12]]
print("== unpaginated arrays with >=100 items");[print(f"  rows={r['rows']} {r['bytes']//1024}KB {r['path']}") for r in sorted(ok,key=lambda r:-(r['rows'] or 0)) if (r['rows'] or 0)>=100]
