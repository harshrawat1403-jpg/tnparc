/**
 * RFC 4180 compliant CSV generator with spreadsheet formula injection protection.
 *
 * Prevents CSV Injection / Formula Injection by neutralizing cells beginning with
 * '=', '+', '-', '@', '\t', or '\r'.
 */

export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }

  let str = String(value);

  // If the string (including any leading whitespace) starts with a formula trigger
  // or whitespace control character, prefix it with a single quote to force spreadsheet
  // software to treat it as literal text and prevent formula execution.
  if (/^\s*[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }

  // Escape any existing double quotes by doubling them per RFC 4180
  const escaped = str.replace(/"/g, '""');

  // Enclose the cell in double quotes
  return `"${escaped}"`;
}

export function generateCsv(
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): string {
  const headerLine = headers.map(sanitizeCsvCell).join(",");
  const rowLines = rows
    .map((row) => row.map(sanitizeCsvCell).join(","))
    .join("\r\n");

  return headerLine + (rowLines.length > 0 ? "\r\n" + rowLines : "") + "\r\n";
}
