import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getReferralDiscountFactor, getReferralDiscountRatePercent } from "@/lib/business-config";

const EDAHAB_API_URL = "https://edahab.net/api/api/IssueInvoice";

// Payment URL format from E-Dahab docs
const PAYMENT_URL = "https://edahab.net/API/Payment";

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

function isLocalhost(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return url.includes("localhost") || url.includes("127.0.0.1");
  }
}

function getReturnUrl(req: NextRequest): string {
  // E-Dahab redirects here after payment. NEVER use localhost - user would never reach our page.
  const env = process.env.EDAHAB_RETURN_URL?.trim();
  if (env && !isLocalhost(env)) {
    const url = env.includes("/pay/return") ? env : env.replace(/\/$/, "") + "/pay/return";
    return url;
  }

  const candidates = [
    process.env.SITE_URL?.trim(),
    process.env.NEXTAUTH_URL?.trim(),
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
  ].filter(Boolean) as string[];

  if (typeof req.url === "string") {
    try {
      const origin = new URL(req.url).origin;
      if (origin && !isLocalhost(origin)) candidates.unshift(origin);
    } catch {
      /* ignore */
    }
  }

  for (const base of candidates) {
    if (!base || isLocalhost(base)) continue;
    const url = base.replace(/\/$/, "") + "/pay/return";
    if (!isLocalhost(url)) return url;
  }

  console.warn("[create-invoice] EDAHAB_RETURN_URL not set. Set EDAHAB_RETURN_URL=https://app.somalidreams.com/pay/return in .env");
  return "https://app.somalidreams.com/pay/return";
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.EDAHAB_API_KEY;
    const secret = process.env.EDAHAB_SECRET;
    const agentCode = process.env.EDAHAB_AGENT_CODE;
    const returnUrl = getReturnUrl(req);

    if (!apiKey || !secret || !agentCode) {
      return NextResponse.json(
        { error: "E-Dahab is not configured" },
        { status: 500 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error("[create-invoice] Invalid JSON body:", parseErr);
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      console.error("[create-invoice] Empty or invalid body:", body);
      return NextResponse.json({ error: "Request body is required" }, { status: 400 });
    }

    // Debug: log received keys (not values) to help diagnose 400 from frontend vs Postman
    console.log("[create-invoice] Received keys:", Object.keys(body));

    const { edahabNumber, name, phone: phoneInput, whatsappPhone, amount: requestAmount, plan, referralCode: referralCodeInput } =
      body;

    // Amount from selected plan: Monthly $1.99, Yearly $17.99 (USD) - numeric only, no symbols
    const planAmounts: Record<string, number> = {
      monthly: 1.99,
      yearly: 17.99,
    };
    const planAmount =
      typeof plan === "string" && planAmounts[plan]
        ? planAmounts[plan]
        : undefined;
    let amount: number;
    if (planAmount !== undefined) {
      // Prefer server-known plan amount to avoid incorrect client payloads.
      amount = planAmount;
    } else if (typeof requestAmount === "number" && requestAmount > 0) {
      amount = Math.round(requestAmount * 100) / 100;
    } else if (typeof requestAmount === "string") {
      const parsed = parseFloat(String(requestAmount).replace(/[^0-9.]/g, ""));
      amount = !isNaN(parsed) && parsed > 0
        ? Math.round(parsed * 100) / 100
        : planAmounts["monthly"];
    } else {
      amount = Number(process.env.EDAHAB_AMOUNT ?? "1.99");
    }

    // Referral discount when valid referral code is used (default: 20%)
    const referralCode = referralCodeInput?.trim?.() || null;
    const discountFactor = getReferralDiscountFactor();
    if (referralCode) {
      const trimmed = referralCode.trim().toUpperCase();
      const referrer =
        (await prisma.member.findFirst({ where: { referralCode: trimmed } })) ??
        (await prisma.member.findFirst({ where: { referralCode: referralCode.trim() } }));
      if (referrer) {
        amount = Math.round(amount * discountFactor * 100) / 100;
      }
    }

    if (!edahabNumber || (typeof edahabNumber === "string" && !edahabNumber.trim())) {
      console.error("[create-invoice] Validation failed: missing edahabNumber. Keys:", Object.keys(body));
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }

    if (!name || (typeof name === "string" && !name.trim())) {
      console.error("[create-invoice] Validation failed: missing name");
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Format: digits only, 6XXXXXXXX - never send 252 prefix to E-Dahab API
    let phone = String(edahabNumber).replace(/\D/g, "");
    if (phone.startsWith("252")) phone = phone.slice(3);
    if (!phone.match(/^6\d{7,}$/)) {
      console.error("[create-invoice] Validation failed: invalid phone format", { edahabNumber, phone });
      return NextResponse.json(
        { error: "Invalid E-Dahab number. Use format 6XXXXXXX (e.g. 612345678)" },
        { status: 400 }
      );
    }

    // Request body - match Postman collection (gateway returnUrl is not supported now)
    const requestBody = {
      apiKey,
      edahabNumber: phone,
      amount: amount.toFixed(2),
      agentCode,
      currency: "USD",
    };

    const bodyString = JSON.stringify(requestBody);
    // Hash must use minified body (no whitespace) + secret, per E-Dahab spec
    const minifiedBody = bodyString.replace(/\s/g, "");
    const hash = crypto
      .createHash("sha256")
      .update(minifiedBody + secret)
      .digest("hex");

    const response = await fetch(`${EDAHAB_API_URL}?hash=${hash}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyString,
    });

    const data = (await response.json()) as {
      StatusCode?: number;
      StatusDescription?: string;
      InvoiceId?: number | string;
      TransactionId?: string;
      InvoiceStatus?: string;
      ValidationErrors?: string | null;
    };

    if (data.StatusCode !== 0) {
      const rawMsg =
        data.StatusDescription ||
        data.ValidationErrors ||
        `E-Dahab error: ${data.StatusCode}`;
      console.error("[create-invoice] E-Dahab rejected:", {
        StatusCode: data.StatusCode,
        StatusDescription: data.StatusDescription,
        ValidationErrors: data.ValidationErrors,
        requestKeys: Object.keys(requestBody),
      });
      // Make generic "Validation Error" more helpful
      const msg =
        rawMsg === "Validation Error"
          ? "Payment provider validation failed. Please check your E-Dahab number (6XXXXXXX) and try again."
          : rawMsg;
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const invoiceId = data.InvoiceId != null ? String(data.InvoiceId) : "";
    if (!invoiceId) {
      return NextResponse.json(
        { error: "No invoice ID in response" },
        { status: 500 }
      );
    }

    // Store registration data - member created only when payment succeeds
    const phoneStored = phone.startsWith("252") ? phone : "252" + phone;
    const regPhone = String(phoneInput ?? phoneStored).replace(/\D/g, "");
    const regPhoneFull = regPhone.startsWith("252") ? regPhone : "252" + regPhone;
    const waDigits = whatsappPhone?.trim() ? String(whatsappPhone).replace(/\D/g, "") : null;

    const planValue = typeof plan === "string" && (plan === "monthly" || plan === "yearly") ? plan : "monthly";

    // Fallback registration strategy:
    // Create member as Pending now, so registration is never lost even when gateway callback/verification fails.
    let memberId: number | null = null;
    const existingMember = await prisma.member.findFirst({
      where: {
        phone: regPhoneFull,
        name: name.trim(),
      },
      orderBy: { id: "desc" },
    });
    if (existingMember) {
      memberId = existingMember.id;
    } else {
      const referralCodeForMember = await ensureUniqueReferralCode();
      const referredById = await findReferrerByCode(body.referralCode?.trim() || "");
      const newMember = await prisma.member.create({
        data: {
          name: name.trim(),
          phone: regPhoneFull,
          referralCode: referralCodeForMember,
          referredById: referredById ?? undefined,
          status: "Pending",
        },
      });
      memberId = newMember.id;
    }

    await prisma.paymentInvoice.create({
      data: {
        memberId,
        invoiceId,
        amount,
        status: "Pending",
        plan: planValue,
        registrationName: name.trim(),
        registrationPhone: regPhoneFull,
        registrationWhatsapp: waDigits && waDigits !== regPhoneFull ? waDigits : null,
        registrationReferralCode: body.referralCode?.trim() || null,
      },
    });

    const paymentUrl = `${PAYMENT_URL}?invoiceId=${encodeURIComponent(invoiceId)}`;

    return NextResponse.json({
      success: true,
      paymentUrl,
      invoiceId,
      transactionId: data.TransactionId,
      invoiceStatus: data.InvoiceStatus,
      referralDiscountRatePercent: getReferralDiscountRatePercent(),
    });
  } catch (e) {
    console.error("E-Dahab create invoice error:", e);
    return NextResponse.json(
      { error: "Failed to create payment" },
      { status: 500 }
    );
  }
}
