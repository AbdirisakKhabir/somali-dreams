import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import {
  getCommissionPayoutLimit,
  getPayBaseUrl,
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

    await prisma.$transaction(async (tx) => {
      if (transactionRef) {
        const existingPayment = await tx.membershipPayment.findFirst({
          where: {
            memberId: id,
            externalTransactionId: transactionRef,
          },
        });
        if (!existingPayment) {
          await tx.membershipPayment.create({
            data: {
              memberId: id,
              amount: paymentAmount,
              paymentMethod,
              externalTransactionId: transactionRef,
            },
          });
        }
      } else {
        await tx.membershipPayment.create({
          data: {
            memberId: id,
            amount: paymentAmount,
            paymentMethod,
          },
        });
      }

      await tx.member.update({
        where: { id },
        data: { status: "Active" },
      });
    });

    // Send WhatsApp with referral code and welcome
    const membersUrl = process.env.SOMALI_DREAMS_MEMBERS_URL || "https://somalidreams.com/members";
    const payBase = getPayBaseUrl();
    const referralLink = member.referralCode
      ? `${payBase}?ref=${encodeURIComponent(member.referralCode)}`
      : membersUrl;

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
        const waRes = await sendWhatsAppMessage(member.phone, msg);
        if (!waRes.success) {
          console.error("WhatsApp send failed:", waRes.error);
        }
      }
    } catch (waErr) {
      console.error("WhatsApp send error:", waErr);
    }

    const updated = await prisma.member.findUnique({
      where: { id },
      include: {
        referredBy: { select: { id: true, name: true, referralCode: true } },
        referrals: { select: { id: true, name: true, phone: true, referralCode: true } },
        membershipPayments: { orderBy: { paidAt: "desc" } },
      },
    });

    return NextResponse.json({
      success: true,
      member: updated,
      message: sendWhatsApp
        ? "Payment confirmed. WhatsApp sent."
        : "Payment confirmed.",
    });
  } catch (e) {
    console.error("Confirm payment error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
