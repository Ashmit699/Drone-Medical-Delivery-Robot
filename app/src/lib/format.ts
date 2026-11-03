const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export const rupees = (n: number) => inr.format(n);

export const grams = (g: number) => (g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${g} g`);

export const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

export function duration(s: number) {
  if (s < 60) return `${Math.max(0, Math.round(s))} s`;
  const m = Math.floor(s / 60);
  const rest = Math.round(s % 60);
  return rest && m < 10 ? `${m} min ${rest} s` : `${Math.round(s / 60)} min`;
}

/** SQLite stores UTC as 'YYYY-MM-DD HH:MM:SS'. */
export const parseDb = (s: string) => new Date(s.replace(' ', 'T') + 'Z');

export function dateTime(s: string) {
  return parseDb(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function time(s: string) {
  return parseDb(s).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export function timeAgo(s: string) {
  const sec = (Date.now() - parseDb(s).getTime()) / 1000;
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`;
  return `${Math.floor(sec / 86400)} d ago`;
}

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');
