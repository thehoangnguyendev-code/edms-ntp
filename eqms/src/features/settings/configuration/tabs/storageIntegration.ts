import type { IntegrationConfig } from '../types';
import type { StorageTestPayload } from '@/services/api/settings';

/** The longest retention the object storage accepts; the settings call it Permanent. */
export const MAX_RETENTION_YEARS = 100;
/** Years offered when Permanent is switched off. */
export const DEFAULT_FIXED_RETENTION_YEARS = 5;

type Storage = IntegrationConfig['storage'];

/** The retention a storage setting means: a missing value is Permanent, as it always was. */
export const retentionYearsOf = (storage: Pick<Storage, 'minioRetentionYears'> | undefined): number => storage?.minioRetentionYears ?? MAX_RETENTION_YEARS;

export const isPermanentRetention = (years: number): boolean => years >= MAX_RETENTION_YEARS;

/** A retention in words: Permanent, or the number of years. */
export const retentionLabel = (years: number): string => (isPermanentRetention(years) ? 'Permanent' : `${years} ${years === 1 ? 'year' : 'years'}`);

/** The date until which an object stored today would be locked, for a retention of `years`. */
export const retentionLockedUntil = (years: number, from: Date = new Date()): Date => {
  const until = new Date(from.getTime());
  until.setFullYear(until.getFullYear() + years);
  return until;
};

/**
 * The retention change that is waiting to be saved, or null when there is none. Retention only means something for MinIO (the only provider with Object Lock), so a
 * retention left over from a provider that is not selected is not a change.
 */
export const retentionChange = (saved: Storage | undefined, current: Storage | undefined): { from: number; to: number } | null => {
  if (!saved || !current || current.provider !== 'minio') return null;
  const from = retentionYearsOf(saved);
  const to = retentionYearsOf(current);
  return from === to ? null : { from, to };
};

export const buildNasUncPath = (host?: string, shareName?: string) => {
  const cleanedHost = (host || '').trim().replace(/^\\\\+/, '').replace(/^smb:\/\//i, '').replace(/[\\/]+$/, '');
  const cleanedShare = (shareName || '').trim().replace(/^[\\/]+/, '').replace(/[\\/]+$/, '');
  if (!cleanedHost || !cleanedShare) {
    return '';
  }
  return `\\\\${cleanedHost}\\${cleanedShare}`;
};

export const buildStorageTestPayload = (storage: Storage): StorageTestPayload => {
  switch (storage.provider) {
    case 'nas':
      return {
        provider: 'nas',
        nasHost: storage.nasHost,
        nasShareName: storage.nasShareName,
        nasDomain: storage.nasDomain,
        nasPath: storage.nasPath?.trim() || buildNasUncPath(storage.nasHost, storage.nasShareName),
        nasUsername: storage.nasUsername,
        nasPassword: storage.nasPassword,
      };
    case 'minio':
      return {
        provider: 'minio',
        minioEndpoint: storage.minioEndpoint || '',
        minioBucket: storage.minioBucket || '',
        minioAccessKeyId: storage.minioAccessKeyId || '',
        minioSecretAccessKey: storage.minioSecretAccessKey || '',
        minioRetentionYears: storage.minioRetentionYears || MAX_RETENTION_YEARS,
      };
    default:
      return { provider: 'local' };
  }
};

/**
 * What the screen would test now, in the same words the server keeps for the last test ({@code IntegrationCheckService.storageSubject}), so that the two can be
 * compared: a last test of another setup must not be read as the state of this one. Never contains a secret.
 */
export const storageSubject = (storage: Storage): string => {
  switch (storage.provider) {
    case 'minio':
      return `MinIO · ${(storage.minioEndpoint || '').trim()} · ${(storage.minioBucket || '').trim()}`;
    case 'nas': {
      // the test is sent with the resolved SMB path, and that is what the server names
      const path = (storage.nasPath?.trim() || buildNasUncPath(storage.nasHost, storage.nasShareName)).trim();
      return `NAS · ${path || `${(storage.nasHost || '').trim()}/${(storage.nasShareName || '').trim()}`}`;
    }
    default:
      return 'Local server';
  }
};

/** Whether the connection test can be run on the setting as it stands (the same rule the Test button always had). */
export const canTestStorage = (storage: Storage): boolean => {
  if (storage.provider === 'nas') return Boolean((storage.nasPath || buildNasUncPath(storage.nasHost, storage.nasShareName)).trim());
  if (storage.provider === 'minio') {
    return Boolean(storage.minioEndpoint?.trim() && storage.minioBucket?.trim() && storage.minioAccessKeyId?.trim() && storage.minioSecretAccessKey?.trim());
  }
  return true;
};
