export interface TableData {
  headers: string[];
  rows: string[][];
}

export interface ParsedContent {
  type: 'text' | 'table';
  content: string | TableData;
}

/**
 * Parses markdown content and extracts tables
 * @param markdown The markdown content to parse
 * @returns Array of parsed content sections (text and tables)
 */
export function parseMarkdownContent(markdown: string): ParsedContent[] {
  const lines = markdown.split('\n');
  const result: ParsedContent[] = [];
  let currentTextLines: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Check if this line looks like a table header (contains |)
    if (line.includes('|') && line.split('|').length > 2) {
      // Look ahead to see if the next line is a separator (|---|---|)
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';

      if (nextLine.includes('|') && nextLine.includes('-')) {
        // We found a table! First, add any accumulated text
        if (currentTextLines.length > 0) {
          result.push({
            type: 'text',
            content: currentTextLines.join('\n').trim(),
          });
          currentTextLines = [];
        }

        // Parse the table
        const table = parseMarkdownTable(lines, i);
        if (table) {
          result.push({
            type: 'table',
            content: table.data,
          });
          i = table.endIndex;
          continue;
        }
      }
    }

    // Not a table, add to text content
    currentTextLines.push(lines[i]);
    i++;
  }

  // Add any remaining text
  if (currentTextLines.length > 0) {
    result.push({
      type: 'text',
      content: currentTextLines.join('\n').trim(),
    });
  }

  return result;
}

/**
 * Parses a markdown table starting from the given line index
 * @param lines Array of all lines in the markdown
 * @param startIndex Index of the header line
 * @returns Parsed table data and end index, or null if not a valid table
 */
function parseMarkdownTable(lines: string[], startIndex: number): { data: TableData; endIndex: number } | null {
  if (startIndex >= lines.length) return null;

  const headerLine = lines[startIndex].trim();
  const separatorLine = startIndex + 1 < lines.length ? lines[startIndex + 1].trim() : '';

  // Validate header and separator
  if (!headerLine.includes('|') || !separatorLine.includes('|') || !separatorLine.includes('-')) {
    return null;
  }

  // Parse headers
  const headers = headerLine
    .split('|')
    .map(cell => cell.trim())
    .filter(cell => cell.length > 0);

  // Parse rows
  const rows: string[][] = [];
  let i = startIndex + 2; // Skip header and separator

  while (i < lines.length) {
    const line = lines[i].trim();

    // Stop if we hit an empty line or a line that doesn't look like a table row
    if (!line || !line.includes('|')) {
      break;
    }

    const cells = line
      .split('|')
      .map(cell => cell.trim())
      .filter(cell => cell.length > 0);

    // Only add rows that have content
    if (cells.length > 0) {
      // Pad or truncate cells to match header count
      while (cells.length < headers.length) {
        cells.push('');
      }
      if (cells.length > headers.length) {
        cells.splice(headers.length);
      }
      rows.push(cells);
    }

    i++;
  }

  return {
    data: { headers, rows },
    endIndex: i,
  };
}

/**
 * Cleans markdown formatting from text content
 * @param text The text to clean
 * @returns Cleaned text
 */
export function cleanMarkdownText(text: string): string {
  return (
    text
      // Remove bold/italic markers
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      // Remove code markers
      .replace(/`(.+?)`/g, '$1')
      // Clean up extra whitespace
      .replace(/\n\s*\n/g, '\n\n')
      .trim()
  );
}
