export function fmt(n: number, decimals = 2): string {
  if (!isFinite(n)) return "0";
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("en-IN");
}

export function fmtMoney(n: number): string {
  return "₹" + fmtInt(n);
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB"); // dd/mm/yyyy
}