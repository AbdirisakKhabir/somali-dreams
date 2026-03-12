const DEFAULT_REFERRAL_DISCOUNT_RATE = 20;
const DEFAULT_COMMISSION_PAYOUT_LIMIT = 10;
const DEFAULT_REFERRAL_COMMISSION = 0.5;

function toNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function inRange(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getReferralDiscountRatePercent(): number {
  const serverValue = toNumber(process.env.REFERRAL_DISCOUNT_RATE_PERCENT);
  const publicValue = toNumber(process.env.NEXT_PUBLIC_REFERRAL_DISCOUNT_RATE_PERCENT);
  const value = serverValue ?? publicValue ?? DEFAULT_REFERRAL_DISCOUNT_RATE;
  return inRange(value, 0, 100);
}

export function getReferralDiscountFactor(): number {
  return 1 - getReferralDiscountRatePercent() / 100;
}

export function getCommissionPayoutLimit(): number {
  const serverValue = toNumber(process.env.COMMISSION_PAYOUT_LIMIT);
  const publicValue = toNumber(process.env.NEXT_PUBLIC_COMMISSION_PAYOUT_LIMIT);
  const value = serverValue ?? publicValue ?? DEFAULT_COMMISSION_PAYOUT_LIMIT;
  return Math.max(0, value);
}

export function getReferralCommissionAmount(): number {
  const value = toNumber(process.env.REFERRAL_COMMISSION_AMOUNT);
  return value != null && value >= 0 ? value : DEFAULT_REFERRAL_COMMISSION;
}

export function getPayBaseUrl(): string {
  return (process.env.SOMALI_DREAMS_PAY_URL || "https://app.somalidreams.com/pay").replace(/\/$/, "");
}
