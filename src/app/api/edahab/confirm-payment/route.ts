import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { processPaidInvoice } from "@/lib/process-paid-invoice";

const EDAHAB_CHECK_URL = "https://edahab.net/api/api/CheckInvoiceStatus";

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

    const processResult = await processPaidInvoice(invoiceId, amount);
    if (!processResult.success) {
      throw new Error(processResult.error || "Failed to process payment");
    }

    const member = await prisma.member.findUnique({
      where: { id: processResult.memberId! },
    });

    return NextResponse.json({
      success: true,
      paid: true,
      approvalPending: true,
      message: "Payment received. Membership is pending team approval.",
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
