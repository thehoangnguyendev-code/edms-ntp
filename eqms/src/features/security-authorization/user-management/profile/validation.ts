export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_REGEX = /^\d{7,15}$/;

export const normalizeDigitsOnly = (value: string) => value.replace(/\D/g, "");

export const isValidEmail = (value: string) => EMAIL_REGEX.test(value.trim());

export const isValidPhone = (value: string) => PHONE_REGEX.test(value.trim());

export const isFutureDateValue = (value: string) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date.getTime() > today.getTime();
};

