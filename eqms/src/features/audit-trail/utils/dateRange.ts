export const DEFAULT_AUDIT_TRAIL_RANGE_DAYS = 30;

const formatDate = (date: Date) => {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`;
};

export const getDefaultAuditTrailDateRange = () => {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date();
  start.setDate(start.getDate() - (DEFAULT_AUDIT_TRAIL_RANGE_DAYS - 1));
  start.setHours(0, 0, 0, 0);

  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  };
};
