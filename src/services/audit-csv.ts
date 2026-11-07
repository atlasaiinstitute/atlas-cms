export function csvEscape(value: unknown) {
  let text = typeof value === "string" ? value : value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
