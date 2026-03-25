/**
 * Prefix values that spreadsheets may interpret as formulas (CSV injection).
 * @see https://owasp.org/www-community/attacks/CSV_Injection
 */
function sanitizeSpreadsheetScalar(str: string): string {
  if (str.length === 0) return str;
  const first = str[0];
  if (first === '=' || first === '+' || first === '-' || first === '@' || first === '\t' || first === '\r') {
    return `\t${str}`;
  }
  return str;
}

export function escapeCsvField(str: string): string {
  const sanitized = sanitizeSpreadsheetScalar(str);
  const needsQuote =
    sanitized.includes(',') ||
    sanitized.includes('"') ||
    sanitized.includes('\n') ||
    sanitized.includes('\r');
  if (!needsQuote) return sanitized;
  return `"${sanitized.replace(/"/g, '""')}"`;
}
