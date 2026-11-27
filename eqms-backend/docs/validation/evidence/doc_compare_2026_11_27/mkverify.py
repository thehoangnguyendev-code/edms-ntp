import sys, re, shlex
S = sys.argv[1]
out = open(S + "/verify.sh", "w", newline="\n", encoding="utf-8")
out.write('mc alias set d http://localhost:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1\n')
n = 0
for line in open(S + "/files.txt", encoding="utf-8"):
    rid, path, sha = line.rstrip("\n").rsplit("|", 2) if False else (line.split("|")[0], "|".join(line.rstrip("\n").split("|")[1:-1]), line.rstrip("\n").split("|")[-1])
    m = re.match(r"minio://([^?]+)(?:\?versionId=(.*))?$", path)
    key, version = m.group(1), m.group(2)
    opt = "--version-id " + shlex.quote(version) + " " if version and version != "null" else ""
    out.write("h=$(mc cat %s%s 2>/dev/null | sha256sum | cut -c1-64); echo %s %s $h\n" % (opt, shlex.quote("d/" + key), rid, sha or "-"))
    n += 1
out.write("mc alias remove d >/dev/null\n")
print("commands", n)
