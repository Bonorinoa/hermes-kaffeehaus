/** Local civil-time input for the artistic scene, not astronomical solar time. */
export function sampleSceneTime({ now, overrideHour = null }) {
  if (overrideHour !== null) {
    if (!Number.isFinite(overrideHour)) {
      throw new TypeError('overrideHour must be a finite number or null');
    }
    const remainder = overrideHour % 24;
    // Avoid shifting valid fractions by 24; canonicalize negative zero.
    const hour = remainder < 0 ? (remainder + 24) % 24 : remainder + 0;
    return { mode: 'manual', hour };
  }
  const date = now();
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw new TypeError('now() must return a valid Date');
  }
  return {
    mode: 'auto',
    hour: date.getHours() + date.getMinutes() / 60
      + date.getSeconds() / 3600 + date.getMilliseconds() / 3_600_000,
  };
}
