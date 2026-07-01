export function wrapTimestamp(isoString: string | null) {
  if (!isoString) return null;
  const d = new Date(isoString);
  return {
    toDate: () => d,
    seconds: Math.floor(d.getTime() / 1000),
    nanoseconds: 0,
  };
}
