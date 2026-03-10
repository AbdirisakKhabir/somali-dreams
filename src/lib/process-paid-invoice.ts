import { prisma } from "@/lib/prisma";

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "SD-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function ensureUniqueReferralCode(): Promise<string> {
  let code = generateReferralCode();
  let exists = await prisma.member.findUnique({ where: { referralCode: code } });
  while (exists) {
    code = generateReferralCode();
    exists = await prisma.member.findUnique({ where: { referralCode: code } });
  }
  return code;
}

async function findReferrerByCode(code: string): Promise<number | undefined> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return undefined;
  const referrer = await prisma.member.findFirst({
    where: { referralCode: trimmed },
  });
  if (referrer) return referrer.id;
  const exact = await prisma.member.findFirst({
    where: { referralCode: code.trim() },
  });
  return exact?.id;
}

/**
 * Process a paid invoice: create member, payment record, update invoice.
 * Used by confirm-payment API and process-pending-payments cron.
 */
export async function processPaidInvoice(
  invoiceId: string,
  amount: number
): Promise<{ success: boolean; memberId?: number; error?: string }> {
  const pi = await prisma.paymentInvoice.findUnique({
    where: { invoiceId },
  });

  if (!pi) {
    return { success: false, error: "Invoice not found" };
  }

  if (pi.status === "Success" && pi.memberId) {
    return { success: true, memberId: pi.memberId };
  }

  if (!pi.registrationName?.trim() || !pi.registrationPhone?.trim()) {
    return { success: false, error: "Missing registration data" };
  }

  let memberId = pi.memberId;
  if (!memberId) {
    const referralCode = await ensureUniqueReferralCode();
    const referredById = await findReferrerByCode(pi.registrationReferralCode ?? "");

    const newMember = await prisma.member.create({
      data: {
        name: pi.registrationName.trim(),
        phone: pi.registrationPhone.trim(),
        referralCode,
        referredById: referredById ?? undefined,
        status: "Active",
      },
    });
    memberId = newMember.id;
  }

  try {
    await prisma.$transaction([
      prisma.membershipPayment.create({
        data: {
          memberId: memberId!,
          amount: pi.amount || amount,
          paymentMethod: "E-Dahab",
          externalTransactionId: String(invoiceId),
        },
      }),
      prisma.paymentInvoice.update({
        where: { id: pi.id },
        data: { status: "Success", memberId },
      }),
    ]);
  } catch (txErr) {
    console.error("[process-paid-invoice] Transaction failed:", invoiceId, txErr);
    return { success: false, error: String(txErr) };
  }

  // Optional: membership dates and referral commission
  const plan = pi.plan === "yearly" ? "yearly" : "monthly";
  const startDate = new Date();
  const endDate = new Date(startDate);
  if (plan === "yearly") {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }

  try {
    const memberData = await prisma.member.findUnique({
      where: { id: memberId! },
      select: { referredById: true },
    });
    const referrerIdForCommission = memberData?.referredById ?? null;

    const membershipPayment = await prisma.membershipPayment.findFirst({
      where: { memberId: memberId!, externalTransactionId: String(invoiceId) },
      orderBy: { createdAt: "desc" },
    });

    await prisma.$transaction(async (tx) => {
      await tx.member.update({
        where: { id: memberId! },
        data: {
          status: "Active",
          membershipStartDate: startDate,
          membershipEndDate: endDate,
        },
      });
      if (referrerIdForCommission && membershipPayment) {
        await tx.referralCommission.create({
          data: {
            referrerId: referrerIdForCommission,
            referredMemberId: memberId!,
            amount: 0.5,
            membershipPaymentId: membershipPayment.id,
          },
        });
      }
    });
  } catch (optErr) {
    console.warn("[process-paid-invoice] Optional update failed:", invoiceId, optErr);
  }

  return { success: true, memberId: memberId! };
}
