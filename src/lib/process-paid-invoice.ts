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
  try {
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
          // Payment confirmed, but membership stays Pending until team approval.
          status: "Pending",
        },
      });
      memberId = newMember.id;
    }

    try {
      await prisma.paymentInvoice.update({
        where: { id: pi.id },
        data: { status: "Success", memberId },
      });
    } catch (txErr) {
      const err = txErr as Error;
      console.error("[process-paid-invoice] Transaction failed:", invoiceId, err);
      return { success: false, error: err.message || String(txErr) };
    }

    return { success: true, memberId: memberId! };
  } catch (e) {
    const err = e as Error;
    console.error("[process-paid-invoice] Error:", invoiceId, err);
    return { success: false, error: err.message || String(e) };
  }
}
