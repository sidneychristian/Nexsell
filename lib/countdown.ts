export function remainingSeconds(deadline: number, now: number) {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
export function formatCountdown(seconds: number) {
  const n = Math.max(0, Math.floor(seconds));
  return [Math.floor(n / 3600), Math.floor((n % 3600) / 60), n % 60]
    .map((x) => String(x).padStart(2, "0"))
    .join(" : ");
}
