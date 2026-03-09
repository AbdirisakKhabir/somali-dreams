import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const EDAHAB_CHECK_URL = "https://edahab.net/api/api/CheckInvoiceStatus";

// Match format used in members API: SD- + 6 chars (e.g. SD-Q9EHQN)
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

// Find referrer by code (handles SD-Q9EHQN format, case variations)
async function findReferrerByCode(code: string): Promise<number | undefined> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return undefined;
  const referrer = await prisma.member.findFirst({
    where: { referralCode: trimmed },
  });
  if (referrer) return referrer.id;
  // Fallback: try exact match (in case DB has mixed case)
  const exact = await prisma.member.findFirst({
    where: { referralCode: code.trim() },
  });
  return exact?.id;
}

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.EDAHAB_API_KEY;
    const secret = process.env.EDAHAB_SECRET;
    const amount = Number(process.env.EDAHAB_AMOUNT ?? "500");

    if (!apiKey || !secret) {
      return NextResponse.json(
        { error: "E-Dahab is not configured" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const invoiceIdParam = searchParams.get("invoiceId") ?? searchParams.get("InvoiceId");
    const invoiceId = invoiceIdParam?.trim() ?? "";

    if (!invoiceId) {
      return NextResponse.json(
        { error: "Invoice ID is required" },
        { status: 400 }
      );
    }

    // E-Dahab uses UUID string for invoiceId - pass as-is to API
    const requestBody = { apiKey, invoiceId };
    const bodyString = JSON.stringify(requestBody);
    // Hash must use minified body (no whitespace) + secret, per E-Dahab spec
    const minifiedBody = bodyString.replace(/\s/g, "");
    const hash = crypto
      .createHash("sha256")
      .update(minifiedBody + secret)
      .digest("hex");

    const response = await fetch(`${EDAHAB_CHECK_URL}?hash=${hash}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyString,
    });

    const data = (await response.json()) as {
      StatusCode?: number;
      InvoiceStatus?: string;
      StatusDescription?: string;
    };

    if (data.StatusCode !== 0) {
      return NextResponse.json(
        { error: data.StatusDescription || "Failed to check invoice" },
        { status: 400 }
      );
    }

    // E-Dahab returns InvoiceStatus: "Paid" and StatusDescription: "Success" when payment succeeds
    const invoiceStatus = (data.InvoiceStatus || "").toLowerCase();
    const statusDesc = (data.StatusDescription || "").toLowerCase();
    const isPaid =
      invoiceStatus === "paid" ||
      invoiceStatus === "success" ||
      statusDesc === "success";

    if (!isPaid) {
      return NextResponse.json({
        success: false,
        paid: false,
        status: data.InvoiceStatus || "Pending",
        message:
          invoiceStatus === "pending"
            ? "Payment is still pending"
            : "Payment was not successful",
      });
    }

    const pi = await prisma.paymentInvoice.findUnique({
      where: { invoiceId },
    });

    if (!pi) {
      console.error("[confirm-payment] Invoice not found:", invoiceId);
      return NextResponse.json(
        { error: "Invoice not found. Please contact support with your payment details." },
        { status: 404 }
      );
    }

    if (!pi.registrationName?.trim() || !pi.registrationPhone?.trim()) {
      console.error("[confirm-payment] Missing registration data for invoice:", invoiceId, pi);
      return NextResponse.json(
        { error: "Invalid invoice data. Please contact support." },
        { status: 400 }
      );
    }

    // Already processed - member exists
    if (pi.status === "Success" && pi.memberId) {
      const existingMember = await prisma.member.findUnique({
        where: { id: pi.memberId },
      });
      if (existingMember) {
        return NextResponse.json({
          success: true,
          paid: true,
          alreadyProcessed: true,
          member: {
            id: existingMember.id,
            name: existingMember.name,
            referralCode: existingMember.referralCode,
            status: existingMember.status,
          },
        });
      }
    }

    // First-time success: create Member from registration data (no member until payment succeeds)
    let memberId = pi.memberId;
    if (!memberId) {
      try {
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
      } catch (createErr) {
        console.error("[confirm-payment] Member creation failed:", createErr);
        throw createErr;
      }
    }

    // Core flow: must succeed for member to appear in list
    // Use simple transaction - no referral_commissions or membership dates (VPS may not have migration)
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
      console.error("[confirm-payment] Core transaction failed:", invoiceId, txErr);
      throw txErr;
    }

    // Optional: membership dates and referral commission (may fail if migration not run on VPS)
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
      // Non-critical: membership dates & commission - log but don't fail
      console.warn("[confirm-payment] Optional update failed (migration may be missing):", invoiceId, optErr);
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId! },
    });

    if (member) {
      let baseUrl =
        process.env.NEXTAUTH_URL?.trim() ||
        process.env.SITE_URL?.trim() ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
      if (!baseUrl && typeof req.url === "string") {
        try {
          baseUrl = new URL(req.url).origin;
        } catch {
          baseUrl = "https://app.somalidreams";
        }
      }
      const membersUrl =
        process.env.SOMALI_DREAMS_MEMBERS_URL ||
        "https://somalidreams.com/members";
      const payBase = (process.env.SOMALI_DREAMS_PAY_URL || `${baseUrl.replace(/\/$/, "")}/pay`).replace(/\/$/, "");
      const referralLink = member.referralCode
        ? `${payBase}?ref=${encodeURIComponent(member.referralCode)}`
        : membersUrl;

      // Send WhatsApp to registration number or custom WhatsApp number
      const waPhone = pi.registrationWhatsapp
        ? pi.registrationWhatsapp
        : member.phone;

      try {
        const { sendWhatsAppMessage } = await import("@/lib/whatsapp");
        const msg = `Hambalyo! Ku Soo dhawoow Somali Dreams! 🎉

**Lacag bixintaada waa la aqbalay.** Waxaad hadda kamid tahay Somali Dreams.

**Referral Code-kaaga:** ${member.referralCode}

**Xiriirka ku wadaag asxaabtaada** – saaxiibadaada waxay heli doonaan 20% discount ah bilkii koowaad. Marka ay bixiyaan, waxaad ku heleysaa $0.50 commission:
${referralLink}

**Members Area:**
${membersUrl}

Mahadsanid! Somali Dreams`;
        const waResult = await sendWhatsAppMessage(waPhone, msg);
        if (!waResult.success) {
          console.error("[WhatsApp] Send failed:", waResult.error);
        }
      } catch (waErr) {
        console.error("[WhatsApp] Send error:", waErr);
      }
    }

    return NextResponse.json({
      success: true,
      paid: true,
      member: member
        ? {
            id: member.id,
            name: member.name,
            referralCode: member.referralCode,
            status: member.status,
          }
        : null,
    });
  } catch (e) {
    console.error("E-Dahab confirm payment error:", e);
    return NextResponse.json(
      {
        error:
          "We could not complete your registration. Your payment was received. Please contact support with your payment details.",
      },
      { status: 500 }
    );
  }
}
