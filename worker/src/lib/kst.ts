const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function toKst(now: Date): { date: string; hour: number; minute: number } {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return { date: `${y}${m}${d}`, hour: kst.getUTCHours(), minute: kst.getUTCMinutes() };
}

export function addDays(yyyymmdd: string, days: number): string {
  const date = new Date(
    Date.UTC(Number(yyyymmdd.slice(0, 4)), Number(yyyymmdd.slice(4, 6)) - 1, Number(yyyymmdd.slice(6, 8)) + days),
  );
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('');
}
