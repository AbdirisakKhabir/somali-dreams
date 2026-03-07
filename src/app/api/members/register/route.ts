import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Generate unique referral code: SODR + 6 random digits
function generateReferralCode(): string {
  let code = "SODR";
  for (let i = 0; i < 6; i++) {
    code += Math.floor(Math.random() * 10);
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

// Public endpoint - pre-registration before payment (no auth)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      phone,
      whatsappPhone,
      referralCode: friendReferralCode,
    } = body;

    if (!name?.trim() || !phone?.trim()) {
      return NextResponse.json(
        { error: "Name and phone are required" },
        { status: 400 }
      );
    }

    // Phone format: 6XXXXXXX or 2526XXXXXXX (Somalia/Somaliland)
    let phoneClean = phone.replace(/\D/g, "");
    if (phoneClean.startsWith("252")) phoneClean = phoneClean.slice(3);
    if (!phoneClean.match(/^6\d{7,}$/)) {
      return NextResponse.json(
        { error: "Invalid phone. Use format 6XXXXXXX (e.g. 612345678)" },
        { status: 400 }
      );
    }
    const phoneStored = "252" + phoneClean;

    // WhatsApp number: use whatsappPhone if provided (full intl format), else phone
    const waNumber = whatsappPhone?.trim()
      ? whatsappPhone.replace(/\D/g, "")
      : phoneStored;

    // Find referrer if code provided
    let referredById: number | undefined;
    if (friendReferralCode?.trim()) {
      const referrer = await prisma.member.findUnique({
        where: { referralCode: friendReferralCode.trim().toUpperCase() },
      });
      if (referrer) referredById = referrer.id;
    }

    const myReferralCode = await ensureUniqueReferralCode();

    const member = await prisma.member.create({
      data: {
        name: name.trim(),
        phone: phoneStored,
        referralCode: myReferralCode,
        referredById: referredById ?? undefined,
        status: "Pending", // Active only when E-Dahab payment succeeds
      },
    });

    // WhatsApp sent only when payment succeeds (see /api/edahab/confirm-payment)

    return NextResponse.json({
      success: true,
      member: {
        id: member.id,
        name: member.name,
        phone: member.phone,
        referralCode: member.referralCode,
        status: member.status,
      },
      message: "Registration successful. Complete payment to become a member.",
    });
  } catch (e) {
    console.error("Member register error:", e);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
