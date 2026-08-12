/**
 * GMP (Good Manufacturing Practice) & Regulatory Utilities
 * Specialist calculations and helpers for the Pharmaceutical Industry
 */

/**
 * RPN (Risk Priority Number) Calculator
 * Used in Risk Management (ICH Q9)
 * Formula: Severity (S) x Likelihood (L) x Detectability (D)
 */
export function calculateRPN(s: number, l: number, d: number): number {
  return s * l * d;
}

/**
 * Get Risk Level based on RPN
 */
export function getRiskLevel(rpn: number): 'Low' | 'Medium' | 'High' | 'Critical' {
  if (rpn <= 10) return 'Low';
  if (rpn <= 40) return 'Medium';
  if (rpn <= 100) return 'High';
  return 'Critical';
}

/**
 * Expiry Date Calculator
 * @param manufacturingDate ISO string or Date
 * @param shelfLifeMonth number of months
 */
export function calculateExpiryDate(manufacturingDate: string | Date, shelfLifeMonth: number): Date {
  const date = new Date(manufacturingDate);
  date.setMonth(date.getMonth() + shelfLifeMonth);
  // Pharmaceutical standards often set expiry to the last day of the month or specific rules
  return date;
}

/**
 * Lead Time / Cycle Time Calculator
 * Calculates business days between two dates (simplified for now)
 */
export function getCycleTimeDays(startDate: string | Date, endDate: string | Date = new Date()): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format Batch Number (Example standard: B-YYYY-NNN)
 */
export function formatBatchNumber(year: number, sequence: number): string {
  return `B-${year}-${String(sequence).padStart(3, '0')}`;
}
