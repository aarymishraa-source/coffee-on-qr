// Shared display formatting for the supply and Kisan screens.
export function qty(n: number, unit = "kg") {
  const v = Math.round(n * 10) / 10;
  return `${Number.isInteger(v) ? v : v.toFixed(1)} ${unit}`;
}

export function rupees(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export function shortDate(iso: string) {
  return new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: iso.length === 10 ? "UTC" : "Asia/Kolkata",
  });
}

export function weekday(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" });
}

export function dateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

export function timeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

export function signedQty(n: number, unit = "kg") {
  if (Math.abs(n) < 0.05) return `0 ${unit}`;
  return `${n > 0 ? "+" : "−"}${qty(Math.abs(n), unit)}`;
}
