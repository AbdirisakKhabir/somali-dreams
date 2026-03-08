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

    try {
      await prisma.$transaction([
      prisma.paymentInvoice.update({
        where: { id: pi.id },
        data: { status: "Success", memberId },
      }),
      ...(pi.memberId
        ? [
            prisma.member.update({
              where: { id: pi.memberId },
              data: { status: "Active" },
            }),
          ]
        : []),
      prisma.membershipPayment.create({
        data: {
          memberId: memberId!,
          amount: pi.amount || amount,
          paymentMethod: "E-Dahab",
          externalTransactionId: String(invoiceId),
        },
      }),
    ]);
    } catch (txErr) {
      console.error("[confirm-payment] Transaction failed:", txErr);
      throw txErr;
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
        const waUrl = `${baseUrl.replace(/\/$/, "")}/api/whatsapp`;
        const waRes = await fetch(waUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: waPhone,
            template: "payment_confirmation",
            referralCode: member.referralCode,
            referralLink,
            membersAreaUrl: membersUrl,
          }),
        });
        const waBody = await waRes.text();
        if (!waRes.ok) {
          console.error("[WhatsApp] Send failed:", waRes.status, waUrl, waBody);
        } else {
          try {
            const parsed = JSON.parse(waBody);
            if (!parsed.success && !parsed.message?.includes("successfully")) {
              console.error("[WhatsApp] API returned error:", parsed);
            }
          } catch {
            // Response might not be JSON
          }
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
      { error: "Failed to confirm payment" },
      { status: 500 }
    );
  }
}
