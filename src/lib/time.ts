// SPDX-License-Identifier: AGPL-3.0-only

/** Absolute Date for a step offset (minutes relative to serve). */
export function clockFor(serveTs: number, offsetMinutes: number): Date {
  return new Date(serveTs + offsetMinutes * 60_000);
}

const clockFmt = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

export function fmtClock(d: Date): string {
  return clockFmt.format(d);
}

export function fmtDuration(totalMinutes: number): string {
  const m = Math.round(Math.abs(totalMinutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  if (r === 0) return `${h} h`;
  return `${h} h ${r} min`;
}

/** mm:ss (or h:mm:ss) countdown string from a millisecond delta. */
export function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  const pad = (x: number) => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Format a timestamp for an <input type="datetime-local"> value. */
export function toDatetimeLocal(ts: number): string {
  const d = new Date(ts);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** Parse a datetime-local value (interpreted as local time). */
export function fromDatetimeLocal(value: string): number | null {
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
}

/** Now + n minutes, rounded up to the next 5-minute mark. */
export function roundedFromNow(minutes: number): number {
  const t = Date.now() + minutes * 60_000;
  const step = 5 * 60_000;
  return Math.ceil(t / step) * step;
}
