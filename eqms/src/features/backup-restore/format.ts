export const formatBytes = (bytes?: number | null) => {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value >= 100 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
};

export const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : "—");
export const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : "—");

export const formatDuration = (seconds?: number | null) => {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes}m ${seconds % 60}s` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};
