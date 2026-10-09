import sys, time, json
sys.stdout.reconfigure(encoding='utf-8')
from minio import Minio
from minio.minioadmin import MinioAdmin, PeerSite
from minio.credentials import StaticProvider
KEY, SEC = "spike", "spike-secret-123"
R = {}
c2 = Minio("localhost:9302", access_key=KEY, secret_key=SEC, secure=False)
c1 = Minio("localhost:9301", access_key=KEY, secret_key=SEC, secure=False)
before = {b.name: sorted(o.version_id for o in c2.list_objects(b.name, recursive=True, include_version=True)) for b in c2.list_buckets()}
R["s2_buckets_before"] = {k: len(v) for k, v in before.items()}
admin2 = MinioAdmin(endpoint="localhost:9302", credentials=StaticProvider(KEY, SEC), secure=False)
try:
    info = admin2.get_site_replication_info()
    R["s2_peers_before"] = [p.get("name") if isinstance(p, dict) else str(p) for p in (info.get("sites") or [])] if isinstance(info, dict) else str(info)[:200]
except Exception as e:
    R["s2_peers_before"] = f"error: {e}"
try:
    admin2.remove_site_replication(all_sites=True)
    R["s2_removed_old_group"] = True
except Exception as e:
    R["s2_removed_old_group"] = f"error: {e}"
try:
    admin2.add_site_replication([PeerSite("s2", "http://spike-s2:9000", KEY, SEC), PeerSite("s1b", "http://spike-s1:9000", KEY, SEC)])
    R["s2_readded_with_fresh_s1"] = True
except Exception as e:
    R["s2_readded_with_fresh_s1"] = f"error: {e}"
time.sleep(25)
after = {}
try:
    for b in c1.list_buckets():
        after[b.name] = sorted(o.version_id for o in c1.list_objects(b.name, recursive=True, include_version=True))
except Exception as e:
    R["fresh_s1_list_error"] = str(e)
R["fresh_s1_buckets"] = {k: len(v) for k, v in after.items()}
R["all_versionIds_restored_identically"] = (after == before) and len(before) > 0
print(json.dumps(R, indent=2, ensure_ascii=False, default=str))
