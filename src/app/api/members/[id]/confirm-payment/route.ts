import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    let baseUrl =
      process.env.SITE_URL?.trim() ||
      process.env.NEXTAUTH_URL?.trim() ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    if (!baseUrl && typeof req.url === "string") {
      try {
        baseUrl = new URL(req.url).origin;
      } catch {
        /* ignore */
      }
    }
    if (!baseUrl || baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")) {
      baseUrl = process.env.SOMALI_DREAMS_PAY_URL?.replace(/\/pay\/?$/, "") || "https://app.somalidreams.com";
    }
    const membersUrl = process.env.SOMALI_DREAMS_MEMBERS_URL || "https://somalidreams.com/members";
    const payBase = (process.env.SOMALI_DREAMS_PAY_URL || `${baseUrl.replace(/\/$/, "")}/pay`).replace(/\/$/, "");
    const referralLink = member.referralCode
      ? `${payBase}?ref=${encodeURIComponent(member.referralCode)}`
      : membersUrl;

    try {
      const waRes = await fetch(`${baseUrl}/api/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: member.phone,
          template: "payment_confirmation",
          referralCode: member.referralCode,
          referralLink,
          membersAreaUrl: membersUrl,
        }),
      });
      if (!waRes.ok) {
        const err = await waRes.json();
        console.error("WhatsApp send failed:", err);
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
