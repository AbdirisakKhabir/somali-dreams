import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

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
    const { amount = 0, paymentMethod = "E-Dahab", externalTransactionId } = body;

    const member = await prisma.member.findUnique({ where: { id } });
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.membershipPayment.create({
        data: {
          memberId: id,
          amount: Number(amount),
          paymentMethod,
          externalTransactionId: externalTransactionId || null,
        },
      }),
      prisma.member.update({
        where: { id },
        data: { status: "Active" },
      }),
    ]);

    // Send WhatsApp with referral code and welcome
    const membersUrl = process.env.SOMALI_DREAMS_MEMBERS_URL || "https://somalidreams.com/members";
    const payBase = (process.env.SOMALI_DREAMS_PAY_URL || "https://app.somalidreams.com/pay").replace(/\/$/, "");
    const referralLink = member.referralCode
      ? `${payBase}?ref=${encodeURIComponent(member.referralCode)}`
      : membersUrl;

    try {
      const msg = `Hambalyo! Ku Soo dhawoow Somali Dreams! 🎉

Lacag bixintaada waa la ansixiyay. Xubinnimadaadu hadda waa Active.

Referral Code-kaaga: ${member.referralCode}

Xiriirka ku wadaag asxaabtaada (20% discount bisha 1aad):
${referralLink}

Members Area:
${membersUrl}

Mahadsanid! Somali Dreams`;
      const waRes = await sendWhatsAppMessage(member.phone, msg);
      if (!waRes.success) {
        console.error("WhatsApp send failed:", waRes.error);
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
      message: "Payment confirmed. WhatsApp sent.",
    });
  } catch (e) {
    console.error("Confirm payment error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
