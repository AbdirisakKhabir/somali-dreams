import { NextRequest, NextResponse } from "next/server";

// Bawa.app WhatsApp API - Somali Dreams
// Trim to handle .env entries with spaces (e.g. "BAWA_TOKEN = value")
const BAWA_TOKEN = (process.env.BAWA_TOKEN || process.env["BAWA_TOKEN "] || "").trim();
const INSTANCE_ID = (process.env.BAWA_INSTANCE_ID || process.env["BAWA_INSTANCE_ID "] || "").trim();

// Format phone for WhatsApp (handles Somalia 252 and international)
function formatPhone(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  if (clean.startsWith("+")) clean = clean.slice(1);
  if (clean.startsWith("0")) clean = clean.slice(1);
  // Already has country code (e.g. 252, 254, 255)
  if (clean.length >= 12 && /^2\d{2}/.test(clean)) return clean;
  if (clean.length >= 9 && clean.startsWith("6")) return "252" + clean;
  if (!clean.startsWith("252")) return "252" + clean;
  return clean;
}

// Somali Dreams WhatsApp message templates (Somali + English)
function getSomaliDreamsMessage(
  template: string,
  data: Record<string, string | undefined>
): string {
  const templates: Record<string, string> = {
    // Sent when payment is confirmed - includes referral link for friends to register
    payment_confirmation: `Hambalyo! Ku Soo dhawoow Somali Dreams! 🎉

**Lacag bixintaada waa la aqbalay.** Waxaad hadda kamid tahay Somali Dreams.

**Referral Code-kaaga:** ${data.referralCode || "N/A"}

**Xiriirka ku wadaag asxaabtaada** (si ay ugu biiraan Somali Dreams. Marka ay bixiyaan, waxaad ku heleysaa liiska saaxiibadaada):
${data.referralLink || "N/A"}

**Members Area:**
${data.membersAreaUrl || "https://somalidreams.com/members"}

Mahadsanid! Somali Dreams`,

    // Welcome message - sent after registration with link to members area
    welcome: `Kusoo dhawoow Somali Dreams! 🎉

**Referral Code-kaaga:** ${data.referralCode || "N/A"}

**Xiriirka ku wadaag asxaabtaada** (si ay ugu biiraan):
${data.referralLink || "N/A"}

**Members Area:**
${data.membersAreaUrl || "https://somalidreams.com/members"}

Mahadsanid! Somali Dreams`,

    // Referral code only - when we just need to send the code
    referral_code: `Somali Dreams - Referral Code-kaaga

**Code-kaaga:** ${data.referralCode || "N/A"}

**Xiriirka ku wadaag asxaabtaada** (si ay ugu biiraan Somali Dreams):
${data.referralLink || "N/A"}

Mahadsanid! Somali Dreams`,

    default: `Somali Dreams

${data.message || "Wax cusboonaysiino ah."}

Mahadsanid!`,
  };

  return templates[template] || templates.default;
}

export async function POST(req: NextRequest) {
  try {
    if (!BAWA_TOKEN || !INSTANCE_ID) {
      return NextResponse.json(
        { success: false, error: "WhatsApp API not configured" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const {
      phone,
      message,
      template = "default",
      referralCode,
      membersAreaUrl,
      ...rest
    } = body;

    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Phone number is required" },
        { status: 400 }
      );
    }

    const membersUrl =
      membersAreaUrl ||
      process.env.SOMALI_DREAMS_MEMBERS_URL ||
      "https://somalidreams.com/members";

    let finalMessage = message;
    if (!message) {
      finalMessage = getSomaliDreamsMessage(template, {
        referralCode,
        referralLink: rest.referralLink,
        membersAreaUrl: membersUrl,
        ...rest,
      });
    }

    const formattedPhone = formatPhone(phone);
    const jid = `${formattedPhone}@s.whatsapp.net`;
    const apiUrl = `https://bawa.app/api/v1/send-text?token=${BAWA_TOKEN}&instance_id=${INSTANCE_ID}&jid=${jid}&msg=${encodeURIComponent(finalMessage)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": "SomaliDreams/1.0" },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get("content-type");
    let responseData: {
      status?: string;
      success?: boolean;
      message?: string;
      error?: string;
      rawResponse?: string;
    };
    if (contentType?.includes("application/json")) {
      responseData = await response.json();
    } else {
      const text = await response.text();
      try {
        responseData = JSON.parse(text);
      } catch {
        responseData = { status: response.ok ? "success" : "error", rawResponse: text };
      }
    }

    if (
      response.ok &&
      (responseData.status === "success" || responseData.success)
    ) {
      return NextResponse.json({
        success: true,
        message: "WhatsApp sent successfully",
        recipient: formattedPhone,
        template,
      });
    }

    throw new Error(
      responseData.message ||
        responseData.error ||
        `HTTP ${response.status}: ${response.statusText}`
    );
  } catch (error) {
    const err = error as Error;
    if (err.name === "AbortError") {
      return NextResponse.json(
        { success: false, error: "Request timeout" },
        { status: 504 }
      );
    }
    console.error("WhatsApp API error:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to send WhatsApp message",
        details: err.message,
      },
      { status: 500 }
    );
  }
}
