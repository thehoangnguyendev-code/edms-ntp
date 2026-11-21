import re, glob, json, os
ROOT=os.environ.get("EQMS_JAVA_ROOT", "eqms-backend/src/main/java/com/eqms")
files=[f for f in glob.glob(ROOT+"/**/*.java",recursive=True) if re.search(r"@(Rest)?Controller",open(f,encoding='utf-8').read())]
def paths(args):
    m=re.findall(r'"([^"]*)"',args or "")
    return m or [""]
out=[]
for f in files:
    s=open(f,encoding='utf-8').read()
    cm=re.search(r'@RequestMapping\(([^)]*)\)\s*(?:public\s+)?(?:final\s+)?class',s) or re.search(r'@RequestMapping\(([^)]*)\)[\s\S]{0,200}?class\s',s)
    base=paths(cm.group(1))[0] if cm else ""
    for m in re.finditer(r'@(Get|Post|Put|Patch|Delete)Mapping(?:\(([^)]*)\))?\s*(?:@[A-Za-z]+(?:\([^)]*\))?\s*)*(?:public\s+)?[\w<>\[\]?, .]+?\s+(\w+)\(',s):
        for p in paths(m.group(2)):
            out.append({"file":os.path.basename(f),"method":m.group(1).upper(),"path":(base+p).replace("//","/"),"handler":m.group(3)})
json.dump(out,open("endpoints.json","w"),indent=0)
print(len(files),"controllers",len(out),"endpoints")
