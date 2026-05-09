export function formatMoney(n: number, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `₹${n.toFixed(2)}`;
  }
}

export function formatDateTime(d: string | Date) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function generateInvoiceNumber(branchName: string) {
  const now = new Date();
  const yymmdd =
    String(now.getFullYear()).slice(-2) +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");
  const rnd = Math.floor(1000 + Math.random() * 9000);
  const prefix = (branchName || "INV").replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "INV";
  return `${prefix}-${yymmdd}-${rnd}`;
}
