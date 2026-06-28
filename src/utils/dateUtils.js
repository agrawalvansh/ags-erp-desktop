/**
 * Returns today's date in YYYY-MM-DD format using local timezone.
 * 
 * IMPORTANT: Do NOT use `new Date().toISOString().split('T')[0]` for dates —
 * that uses UTC, which gives the wrong date between midnight and 5:30 AM IST.
 * Always use this function instead.
 */
export function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
