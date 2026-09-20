/**
 * Returns the data rows (header and separator rows removed) of the first
 * Markdown table that appears under the given heading line.
 * Each row is a list of trimmed cell strings.
 */
export function tableUnderHeading(markdown: string, heading: string): string[][] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) throw new Error(`Heading not found: ${heading}`);

  const rows: string[][] = [];
  let inTable = false;

  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|')) {
      inTable = true;
      const inner = trimmed.endsWith('|') ? trimmed.slice(1, -1) : trimmed.slice(1);
      rows.push(inner.split('|').map((cell) => cell.trim()));
    } else if (inTable) {
      break;
    }
  }

  return rows.slice(2);
}
