// Singapore cash transactions round to the nearest 10 cents (no 1c/5c coins
// given as change). Exact 5c remainders round up — e.g. 13.55 -> 13.60.
// Mirrors src/utils/money.js on the backend, which is what actually charges.
export function roundCashAmount(amount: number): number {
  const cents = Math.round(amount * 100);
  const dimes = Math.floor(cents / 10);
  const remainder = cents - dimes * 10;
  const roundedDimes = remainder >= 5 ? dimes + 1 : dimes;
  return (roundedDimes * 10) / 100;
}
