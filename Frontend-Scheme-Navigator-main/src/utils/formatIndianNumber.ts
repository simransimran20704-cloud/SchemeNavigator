/**
 * Formats a number using the Indian numbering system (en-IN locale).
 * e.g. 1500000 → "15,00,000"
 */
export function formatIndianNumber(value: number | string): string {
  const num = typeof value === 'number' ? value : Number(value) || 0;
  return num.toLocaleString('en-IN');
}

/**
 * Formats a rupee amount using the Indian numbering system.
 * e.g. 1500000 → "₹15,00,000"
 */
export function formatIndianRupee(value: number | string): string {
  const num = typeof value === 'number' ? value : Number(value) || 0;
  return `₹${num.toLocaleString('en-IN')}`;
}

/**
 * Converts an income number to a human-readable lakh/crore string.
 * e.g. 450000 → "₹4.5 Lakh"
 */
export function formatIncomeInLakh(value: number | string): string {
  const num = typeof value === 'number' ? value : Number(value) || 0;
  if (num >= 10000000) {
    return `₹${(num / 10000000).toFixed(2).replace(/\.?0+$/, '')} Crore`;
  }
  if (num >= 100000) {
    return `₹${(num / 100000).toFixed(2).replace(/\.?0+$/, '')} Lakh`;
  }
  return formatIndianRupee(num);
}
