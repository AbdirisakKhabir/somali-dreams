import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import {
  getCommissionPayoutLimit,
  getPayBaseUrl,
  getReferralCommissionAmount,
  getReferralDiscountRatePercent,
} from "@/lib/business-config";

function buildApprovalMessage(params: {
  referralCode: string;
  referralLink: string;
  membersUrl: string;
}): string {
  const discountRate = getReferralDiscountRatePercent();
  const payoutLimit = getCommissionPayoutLimit();
  return `Hambalyo! Ku Soo dhawoow Somali Dreams! 🎉

Lacag bixintaada waa la ansixiyay. Xubinnimadaadu hadda waa Active.

Referral Code-kaaga: ${params.referralCode}

Ku wadaag linkigan asxaabtaada (${discountRate}% discount bisha 1aad):
${params.referralLink}

Marka commission-kaagu gaaro $${payoutLimit.toFixed(2)} waxaad codsan kartaa payout.

Members Area:
${params.membersUrl}

Mahadsanid! Somali Dreams`;
}

// Confirm payment: create payment record, set member Active, send WhatsApp
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = parseInt((await params).id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      amount: rawAmount,
      paymentMethod = "E-Dahab",
      externalTransactionId,
      customMessage,
      sendWhatsApp = true,
    } = body;

    const member = await prisma.member.findUnique({ where: { id } });
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const latestInvoice = await prisma.paymentInvoice.findFirst({
      where: { memberId: id },
      orderBy: { createdAt: "desc" },
    });

    const amountFromBody = Number(rawAmount);
    const paymentAmount =
      Number.isFinite(amountFromBody) && amountFromBody > 0
        ? amountFromBody
        : (latestInvoice?.amount ?? 0);
    const transactionRef = externalTransactionId || latestInvoice?.invoiceId || null;

    const txResult = await prisma.$transaction(async (tx) => {
      let paymentRecord:
        | { id: number; amount: number; externalTransactionId: string | null }
        | null = null;

      if (transactionRef) {
        const existingPayment = await tx.membershipPayment.findFirst({
          where: {
            memberId: id,
            externalTransactionId: transactionRef,
          },
        });
        if (!existingPayment) {
          paymentRecord = await tx.membershipPayment.create({
            data: {
              memberId: id,
              amount: paymentAmount,
              paymentMethod,
              externalTransactionId: transactionRef,
            },
          });
        } else {
          paymentRecord = existingPayment;
        }
      } else {
        paymentRecord = await tx.membershipPayment.create({
          data: {
            memberId: id,
            amount: paymentAmount,
            paymentMethod,
          },
        });
      }

      // Credit the referrer once this member payment is approved.
      if (member.referredById && paymentRecord) {
        const existingCommission = await tx.referralCommission.findFirst({
          where: {
            membershipPaymentId: paymentRecord.id,
          },
        });
        if (!existingCommission) {
          await tx.referralCommission.create({
            data: {
              referrerId: member.referredById,
              referredMemberId: id,
              amount: getReferralCommissionAmount(),
              membershipPaymentId: paymentRecord.id,
            },
          });
        }
      }

      await tx.member.update({
        where: { id },
        data: { status: "Active" },
      });

      return { paymentId: paymentRecord?.id ?? null };
    });

    // Send WhatsApp with referral code and welcome
    const membersUrl = process.env.SOMALI_DREAMS_MEMBERS_URL || "https://somalidreams.com/members";
    const payBase = getPayBaseUrl();
    const referralLink = member.referralCode
      ? `${payBase}?ref=${encodeURIComponent(member.referralCode)}`
      : membersUrl;

    const whatsappTarget = latestInvoice?.registrationWhatsapp?.trim() || member.phone;
    let whatsappSent = false;
    let whatsappError: string | undefined;
    try {
      if (sendWhatsApp) {
        const msg =
          typeof customMessage === "string" && customMessage.trim()
            ? customMessage
                .replace(/\{referralCode\}/g, member.referralCode)
                .replace(/\{referralLink\}/g, referralLink)
                .replace(/\{membersUrl\}/g, membersUrl)
            : buildApprovalMessage({
                referralCode: member.referralCode,
                referralLink,
                membersUrl,
              });
        const waRes = await sendWhatsAppMessage(whatsappTarget, msg);
        if (!waRes.success) {
          whatsappError = waRes.error;
          console.error("WhatsApp send failed:", waRes.error);
        } else {
          whatsappSent = true;
        }
      }
    } catch (waErr) {
      whatsappError = (waErr as Error).message || "Unknown WhatsApp error";
      console.error("WhatsApp send error:", waErr);
    }

    const updated = await prisma.member.findUnique({
      where: { id },
      include: {
        referredBy: { select: { id: true, name: true, referralCode: true } },
        referrals: { select: { id: true, name: true, phone: true, referralCode: true } },
        membershipPayments: { orderBy: { paidAt: "desc" } },
        referralCommissions: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            amount: true,
            referredMemberId: true,
            createdAt: true,
            referredMember: { select: { id: true, name: true, referralCode: true } },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      member: updated,
      paymentId: txResult.paymentId,
      whatsappSent,
      whatsappError,
      message: sendWhatsApp
        ? whatsappSent
          ? "Payment confirmed. WhatsApp sent."
          : "Payment confirmed, but WhatsApp could not be sent."
        : "Payment confirmed.",
    });
  } catch (e) {
    console.error("Confirm payment error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
