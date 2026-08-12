const MAINTENANCE_BYPASS_PERMISSION = 'security.maintenance.bypass';

export const canBypassMaintenance = (permissions?: string[] | null): boolean => {
  const normalized = new Set(
    (permissions ?? [])
      .filter((value): value is string => Boolean(value))
      .map((value) => value.trim().toUpperCase()),
  );
  return normalized.has('*') || normalized.has(MAINTENANCE_BYPASS_PERMISSION.toUpperCase());
};
