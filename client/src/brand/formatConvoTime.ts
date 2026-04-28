/**
 * Format a conversation timestamp for the sidebar list.
 * - Today        → "HH:mm"        (e.g. "14:32")
 * - This week    → short weekday   (e.g. "lun", "mar")
 * - Older        → day + short month (e.g. "12 abr")
 *
 * Uses Spanish (es-AR) locale by default; pass a different locale to override.
 */
export function formatConvoTime(input: string | Date | undefined | null, locale = 'es-AR'): string {
  if (!input) {
    return '';
  }
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays >= 0 && diffDays < 7) {
    return date.toLocaleDateString(locale, { weekday: 'short' }).replace('.', '');
  }

  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' }).replace('.', '');
}
