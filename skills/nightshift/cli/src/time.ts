/** 时间的本地化显示与时长格式化。报告里给人看的时间一律用本地时区。 */

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** 本地时区的 HH:MM。 */
export function localHM(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 本地时区的 YYYY-MM-DD HH:MM。 */
export function localStamp(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${localHM(d)}`;
}

/** 时长 → 「1h12m」/「12m30s」/「45s」。 */
export function fmtDur(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m${s % 60 > 0 ? String(s % 60).padStart(2, "0") : ""}`;
  const h = Math.floor(m / 60);
  return `${h}h${m % 60 > 0 ? String(m % 60).padStart(2, "0") : ""}`;
}
