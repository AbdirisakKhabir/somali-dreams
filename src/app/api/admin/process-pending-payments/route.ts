import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { processPaidInvoice } from "@/lib/process-paid-invoice";

const EDAHAB_CHECK_URL = "https://edahab.net/api/api/CheckInvoiceStatus";

/**
 * Admin endpoint: process pending E-Dahab payments and create members.
 * E-Dahab does not redirect to our return URL, so run this after payments.
 * Requires admin auth.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const hasPermission =
      auth.permissions?.includes("members.create") ||
      auth.permissions?.includes("members.view") ||
      auth.permissions?.includes("dashboard.view");
    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const apiKey = process.env.EDAHAB_API_KEY;
    const secret = process.env.EDAHAB_SECRET;
    const amount = Number(process.env.EDAHAB_AMOUNT ?? "500");

    if (!apiKey || !secret) {
      return NextResponse.json(
        { error: "E-Dahab is not configured" },
        { status: 500 }
      );
    }

    const pending = await prisma.paymentInvoice.findMany({
      where: { status: "Pending" },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    let processed = 0;
    const results: { invoiceId: string; status: string }[] = [];

    for (const pi of pending) {
      const requestBody = { apiKey, invoiceId: pi.invoiceId };
      const bodyString = JSON.stringify(requestBody);
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
        results.push({ invoiceId: pi.invoiceId, status: "check_failed" });
        continue;
      }

      const invoiceStatus = (data.InvoiceStatus || "").toLowerCase();
      const statusDesc = (data.StatusDescription || "").toLowerCase();
      const isPaid =
        invoiceStatus === "paid" ||
        invoiceStatus === "success" ||
        statusDesc === "success";

      if (!isPaid) {
        results.push({ invoiceId: pi.invoiceId, status: "still_pending" });
        continue;
      }

      const result = await processPaidInvoice(pi.invoiceId, amount);
      if (result.success) {
        processed++;
        results.push({ invoiceId: pi.invoiceId, status: "member_created" });

        const member = await prisma.member.findUnique({
          where: { id: result.memberId! },
        });
        if (member) {
          const waPhone = pi.registrationWhatsapp || member.phone;
          const membersUrl =
            process.env.SOMALI_DREAMS_MEMBERS_URL || "https://somalidreams.com/members";
          const payBase =
            process.env.SOMALI_DREAMS_PAY_URL || "https://app.somalidreams.com/pay";
          const referralLink = member.referralCode
            ? `${payBase}?ref=${encodeURIComponent(member.referralCode)}`
            : membersUrl;

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
            await sendWhatsAppMessage(waPhone, msg);
          } catch (waErr) {
            console.error("[process-pending-payments] WhatsApp error:", waErr);
          }
        }
      } else {
        results.push({ invoiceId: pi.invoiceId, status: `failed: ${result.error}` });
      }
    }

    return NextResponse.json({
      success: true,
      checked: pending.length,
      processed,
      results,
    });
  } catch (e) {
    console.error("[process-pending-payments] Error:", e);
    return NextResponse.json(
      { error: "Failed to process pending payments" },
      { status: 500 }
    );
  }
}
