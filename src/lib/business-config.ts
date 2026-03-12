const DEFAULT_REFERRAL_DISCOUNT_RATE = 20;
const DEFAULT_COMMISSION_PAYOUT_LIMIT = 10;
const DEFAULT_REFERRAL_COMMISSION = 0.5;
const DEFAULT_MONTHLY_MEMBER_FEE = 1.99;
const DEFAULT_YEARLY_MEMBER_FEE = 17.99;

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

function getPositiveOrDefault(value: number | null, fallback: number): number {
  return value != null && value > 0 ? value : fallback;
}

export function getMembershipFeeAmounts(): { monthly: number; yearly: number } {
  const monthlyServer = toNumber(process.env.MEMBERSHIP_FEE_MONTHLY);
  const monthlyPublic = toNumber(process.env.NEXT_PUBLIC_MEMBERSHIP_FEE_MONTHLY);
  const yearlyServer = toNumber(process.env.MEMBERSHIP_FEE_YEARLY);
  const yearlyPublic = toNumber(process.env.NEXT_PUBLIC_MEMBERSHIP_FEE_YEARLY);

  const monthly = getPositiveOrDefault(
    monthlyServer ?? monthlyPublic,
    DEFAULT_MONTHLY_MEMBER_FEE
  );
  const yearly = getPositiveOrDefault(
    yearlyServer ?? yearlyPublic,
    DEFAULT_YEARLY_MEMBER_FEE
  );

  return {
    monthly: Math.round(monthly * 100) / 100,
    yearly: Math.round(yearly * 100) / 100,
  };
}
