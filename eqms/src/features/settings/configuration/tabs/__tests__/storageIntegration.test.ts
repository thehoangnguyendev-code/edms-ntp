import { describe, expect, it } from "vitest";
import type { IntegrationConfig } from "../../types";
import { MAX_RETENTION_YEARS, buildNasUncPath, buildStorageTestPayload, canTestStorage, retentionChange, retentionLabel, retentionLockedUntil, retentionYearsOf, storageSubject } from "../storageIntegration";

type Storage = IntegrationConfig["storage"];
const minio = (extra: Partial<Storage> = {}): Storage => ({ provider: "minio", minioEndpoint: "http://minio:9000", minioBucket: "eqms-gmp-records", minioAccessKeyId: "key", minioSecretAccessKey: "TOP-SECRET", ...extra }) as Storage;

describe("retention", () => {
  it("is Permanent when nothing is set, and says so in words", () => {
    expect(retentionYearsOf(minio())).toBe(MAX_RETENTION_YEARS);
    expect(retentionYearsOf(undefined)).toBe(MAX_RETENTION_YEARS);
    expect(retentionLabel(MAX_RETENTION_YEARS)).toBe("Permanent");
    expect(retentionLabel(1)).toBe("1 year");
    expect(retentionLabel(7)).toBe("7 years");
  });

  it("finds the date until which a record stored today is locked", () => {
    const until = retentionLockedUntil(7, new Date(2026, 10, 19));
    expect([until.getFullYear(), until.getMonth(), until.getDate()]).toEqual([2033, 10, 19]);
  });

  it("is a pending change only for MinIO and only when the years differ from the saved ones", () => {
    expect(retentionChange(minio(), minio())).toBeNull();
    expect(retentionChange(minio(), minio({ minioRetentionYears: 7 }))).toEqual({ from: MAX_RETENTION_YEARS, to: 7 });
    expect(retentionChange(minio({ minioRetentionYears: 7 }), minio())).toEqual({ from: 7, to: MAX_RETENTION_YEARS });
    // a retention left over from a provider that is not selected is not a change
    expect(retentionChange(minio(), { ...minio({ minioRetentionYears: 7 }), provider: "nas" } as Storage)).toBeNull();
    expect(retentionChange(undefined, minio())).toBeNull();
    expect(retentionChange(minio(), undefined)).toBeNull();
  });
});

describe("what is tested", () => {
  it("builds the same words the server keeps for the last test, and never a secret", () => {
    expect(storageSubject(minio())).toBe("MinIO · http://minio:9000 · eqms-gmp-records");
    expect(storageSubject(minio())).not.toContain("TOP-SECRET");
    expect(storageSubject({ provider: "local" } as Storage)).toBe("Local server");
  });

  it("names a NAS by its resolved SMB path, as the test is sent with it", () => {
    const nas = { provider: "nas", nasHost: "nas01", nasShareName: "eqms" } as Storage;
    expect(buildNasUncPath("nas01", "eqms")).toBe("\\\\nas01\\eqms");
    expect(storageSubject(nas)).toBe("NAS · \\\\nas01\\eqms");
    expect(buildStorageTestPayload(nas)).toMatchObject({ provider: "nas", nasPath: "\\\\nas01\\eqms" });
    expect(storageSubject({ provider: "nas", nasHost: "h", nasShareName: "" } as Storage)).toBe("NAS · h/");
  });

  it("can be tested only when the fields the test needs are filled in", () => {
    expect(canTestStorage(minio())).toBe(true);
    expect(canTestStorage(minio({ minioSecretAccessKey: " " }))).toBe(false);
    expect(canTestStorage(minio({ minioBucket: "" }))).toBe(false);
    expect(canTestStorage({ provider: "nas", nasHost: "h", nasShareName: "s" } as Storage)).toBe(true);
    expect(canTestStorage({ provider: "nas" } as Storage)).toBe(false);
    expect(canTestStorage({ provider: "local" } as Storage)).toBe(true);
  });
});
