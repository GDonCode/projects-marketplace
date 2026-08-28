export function formatWeeklyRate(amount: number | null | undefined): string {
  if (amount == null) return "—";
  const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "JMD",
    maximumFractionDigits: 0,
  }).format(amount);
  return `${currency}/wk`;
}