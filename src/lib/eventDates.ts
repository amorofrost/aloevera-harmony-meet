/**
 * Shared event date helpers.
 *
 * formatEventDate auto-includes the year whenever the date is not in the current
 * calendar year — so past events from prior years and events scheduled in future
 * years both render unambiguously, while same-year dates stay terse.
 *
 * isEventPast treats an event as past once its end (when set) or its start has
 * passed. Used to split events into upcoming vs past lists.
 */
export function formatEventDate(date: Date, locale: string = 'ru-RU'): string {
  const sameYear = date.getFullYear() === new Date().getFullYear();
  const options: Intl.DateTimeFormatOptions = sameYear
    ? { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function isEventPast(date: Date, endDate?: Date | null, now: Date = new Date()): boolean {
  const reference = endDate ?? date;
  return reference.getTime() < now.getTime();
}
