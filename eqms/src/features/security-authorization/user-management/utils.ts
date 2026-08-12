// User Management Utility Functions

/**
 * Remove Vietnamese accents from string
 * Used for generating usernames from Vietnamese names
 */
export const removeAccents = (str: string): string => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
};

/**
 * Generate unique username from full name
 * Format: lastname + initials (e.g., "Nguyễn Thế Hoàng" -> "hoangnt")
 * Handles collisions by appending numbers (hoangnt1, hoangnt2, etc.)
 */
export const generateUsername = (fullName: string, existingUsernames: string[]): string => {
  const parts = removeAccents(fullName.trim()).toLowerCase().split(' ').filter(p => p);
  if (parts.length === 0) return '';
  
  // Get last name (tên) and first letters of other parts (họ đệm)
  const lastName = parts[parts.length - 1];
  const initials = parts.slice(0, -1).map(p => p[0]).join('');
  const baseUsername = lastName + initials;
  
  // Check if username exists, if yes add number suffix
  let username = baseUsername;
  let counter = 1;
  while (existingUsernames.includes(username)) {
    username = baseUsername + counter;
    counter++;
  }
  
  return username;
};

/**
 * Get next available Employee ID
 * Format: NTP.XXXX (e.g., NTP.0008)
 */
export const getNextEmployeeCode = (users: Array<{ employeeCode: string }>): string => {
  const maxId = users.reduce((max, user) => {
    const numPart = parseInt(user.employeeCode.split('.')[1] || '0');
    return Math.max(max, numPart);
  }, 0);
  return (maxId + 1).toString().padStart(4, '0');
};
