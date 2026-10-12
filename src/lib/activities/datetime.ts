/** Activity forms use Beijing time, independent of the Vercel server timezone. */
export function parseActivityDateTime(value: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value) ? `${value}+08:00` : value);
}

export function formatActivityDateTime(value: Date): string {
  return new Date(value.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16);
}
