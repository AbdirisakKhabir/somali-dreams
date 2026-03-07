import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
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

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const members = await prisma.member.findMany({
      include: {
        referredBy: { select: { id: true, name: true, referralCode: true } },
        referrals: { select: { id: true, name: true, phone: true, referralCode: true, createdAt: true } },
        membershipPayments: { select: { id: true, amount: true, paymentMethod: true, paidAt: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(members);
  } catch (e) {
    console.error("Members list error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, phone, email, referredByCode, status, sendWelcome } = body;

    if (!name?.trim() || !phone?.trim()) {
      return NextResponse.json(
        { error: "Name and phone are required" },
        { status: 400 }
      );
    }

    let referredById: number | undefined;
    if (referredByCode?.trim()) {
      const referrer = await prisma.member.findUnique({
        where: { referralCode: referredByCode.trim().toUpperCase() },
      });
      if (referrer) referredById = referrer.id;
    }

    const referralCode = await ensureUniqueReferralCode();

    const member = await prisma.member.create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        email: email?.trim() || null,
        referralCode,
        referredById: referredById ?? undefined,
        status: status || "Active",
      },
      include: {
        referredBy: { select: { id: true, name: true, referralCode: true } },
        referrals: { select: { id: true, name: true, phone: true, referralCode: true } },
      },
    });

    // Optionally send welcome WhatsApp
    if (sendWelcome) {
      try {
        const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}` : "";
        const membersUrl = process.env.SOMALI_DREAMS_MEMBERS_URL || "https://somalidreams.com/members";
        await fetch(`${baseUrl}/api/whatsapp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: member.phone,
            template: "welcome",
            referralCode: member.referralCode,
            membersAreaUrl: membersUrl,
          }),
        });
      } catch (waErr) {
        console.error("WhatsApp send failed:", waErr);
      }
    }

    return NextResponse.json(member);
  } catch (e) {
    console.error("Create member error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
