export function csvCell(value: string | number | boolean) {
  const text = String(value)
  // Treat user-provided values as text when opened by spreadsheet applications.
  const safe = /^[\s]*[=+@-]|^[\t\r\n]/.test(text) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}
