import sys, collections
S = sys.argv[1]; EMPTY = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
res = collections.Counter(); bad = []
for line in open(S + "/verify.out", encoding="utf-8"):
    parts = line.split()
    if len(parts) != 3: res["unreadable line"] += 1; continue
    rid, rec, got = parts
    kind = "missing" if got == EMPTY else "no recorded checksum" if rec == "-" else "match" if rec.lower() == got else "MISMATCH"
    res[kind] += 1
    if kind != "match": bad.append((rid, kind))
print(dict(res))
open(S + "/bad.txt", "w").write("\n".join(f"{r} {k}" for r, k in bad))
