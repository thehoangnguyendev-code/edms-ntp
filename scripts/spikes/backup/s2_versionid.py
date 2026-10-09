"""
S2 spike: how MinIO RELEASE.2025-04-22 handles versionId.
Throw-away containers only (spike-s1, spike-s2). Never touches the eqms MinIO or any eqms bucket.
"""
import io, json, sys, time, datetime
sys.stdout.reconfigure(encoding='utf-8')
from minio import Minio
from minio.minioadmin import MinioAdmin
from minio.commonconfig import COMPLIANCE
from minio.objectlockconfig import ObjectLockConfig
from minio.versioningconfig import VersioningConfig, ENABLED
from minio.credentials import StaticProvider
from minio.commonconfig import CopySource
from minio.error import S3Error

KEY, SEC = "spike", "spike-secret-123"
RESULT = {}


def client(port):
    return Minio(f"localhost:{port}", access_key=KEY, secret_key=SEC, secure=False)


def versions(c, bucket, prefix=""):
    return [(o.object_name, o.version_id, o.is_delete_marker) for o in c.list_objects(bucket, prefix=prefix, recursive=True, include_version=True)]


c1, c2 = client(9301), client(9302)

# ---------- Part A: plain S3 behaviour on one server
c1.make_bucket("spike-a1"); c1.set_bucket_versioning("spike-a1", VersioningConfig(ENABLED))
c1.make_bucket("spike-a2"); c1.set_bucket_versioning("spike-a2", VersioningConfig(ENABLED))
r1 = c1.put_object("spike-a1", "doc/x.pdf", io.BytesIO(b"hello"), 5)
r2 = c1.put_object("spike-a1", "doc/x.pdf", io.BytesIO(b"hello"), 5)  # same bytes again
cp = c1.copy_object("spike-a2", "doc/x.pdf", CopySource("spike-a1", "doc/x.pdf", version_id=r1.version_id))
RESULT["A_put_same_key_twice_versionIds_differ"] = r1.version_id != r2.version_id
RESULT["A_server_copy_new_versionId_differs_from_source"] = cp.version_id != r1.version_id
# can a caller choose the versionId? try the header some S3 implementations ignore
try:
    r3 = c1.put_object("spike-a1", "doc/y.pdf", io.BytesIO(b"x"), 1, metadata={"x-amz-version-id": "CHOSEN-VERSION"})
    RESULT["A_caller_can_choose_versionId"] = r3.version_id == "CHOSEN-VERSION"
except Exception as e:
    RESULT["A_caller_can_choose_versionId"] = f"error: {e}"

# ---------- Part B: site replication preserves versionIds?
admin1 = MinioAdmin(endpoint="localhost:9301", credentials=StaticProvider(KEY, SEC), secure=False)
from minio.minioadmin import PeerSite
try:
    # s2 is empty; s1 holds buckets a1/a2, which is allowed (only one site may hold data).
    out = admin1.add_site_replication([PeerSite("s1", "http://spike-s1:9000", KEY, SEC), PeerSite("s2", "http://spike-s2:9000", KEY, SEC)])
    RESULT["B_site_replication_added"] = True
except Exception as e:
    RESULT["B_site_replication_added"] = f"error: {e}"

time.sleep(15)
try:
    s1 = versions(c1, "spike-a1"); s2 = versions(c2, "spike-a1")
    RESULT["B_existing_objects_replicated_with_same_versionIds"] = sorted(v for _, v, _ in s1) == sorted(v for _, v, _ in s2) and len(s1) > 0
    RESULT["B_versions_s1"] = len(s1); RESULT["B_versions_s2"] = len(s2)
except Exception as e:
    RESULT["B_existing_objects_replicated_with_same_versionIds"] = f"error: {e}"

# locked bucket created after replication is set up
try:
    c1.make_bucket("spike-locked1", object_lock=True)
    c1.set_object_lock_config("spike-locked1", ObjectLockConfig(COMPLIANCE, 1, "Days"))
    l1 = c1.put_object("spike-locked1", "records/a.pdf", io.BytesIO(b"locked one"), 10)
    l2 = c1.put_object("spike-locked1", "records/a.pdf", io.BytesIO(b"locked two"), 10)
    time.sleep(15)
    lv2 = versions(c2, "spike-locked1")
    RESULT["B_locked_bucket_appears_on_s2"] = len(lv2) > 0
    RESULT["B_locked_versionIds_equal"] = sorted([l1.version_id, l2.version_id]) == sorted(v for _, v, _ in lv2)
    ret = c2.get_object_retention("spike-locked1", "records/a.pdf", version_id=l1.version_id)
    RESULT["B_retention_replicated"] = f"{ret.mode} until {ret.retain_until_date.date()}" if ret else None
    try:
        c2.remove_object("spike-locked1", "records/a.pdf", version_id=l1.version_id)
        RESULT["B_s2_can_delete_locked_version"] = True
    except S3Error as e:
        RESULT["B_s2_can_delete_locked_version"] = f"refused: {e.code}"
except Exception as e:
    RESULT["B_locked"] = f"error: {e}"

print(json.dumps(RESULT, indent=2, ensure_ascii=False, default=str))
json.dump(RESULT, open("s2_partAB.json", "w", encoding="utf-8"), indent=2, default=str)
