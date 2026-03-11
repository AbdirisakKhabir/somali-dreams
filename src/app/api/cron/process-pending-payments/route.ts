import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { processPaidInvoice } from "@/lib/process-paid-invoice";

const EDAHAB_CHECK_URL = "https://edahab.net/api/api/CheckInvoiceStatus";

/**
 * Process pending payment invoices: check E-Dahab status, create members for paid ones.
 * E-Dahab does not redirect to our return URL, so we run this periodically.
 * Call via: GET /api/cron/process-pending-payments
 * Secure with CRON_SECRET in production.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
        results.push({ invoiceId: pi.invoiceId, status: "member_created_pending_approval" });
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
    const err = e as Error;
    console.error("[process-pending-payments] Error:", err);
    return NextResponse.json(
      {
        error: "Failed to process pending payments",
        detail: err.message || String(e),
      },
      { status: 500 }
    );
  }
}
