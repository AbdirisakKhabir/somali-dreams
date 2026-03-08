/**
 * Bawa.app WhatsApp API - shared send logic
 * Used by /api/whatsapp, /api/whatsapp/bulk, confirm-payment, etc.
 */

const BAWA_TOKEN = (process.env.BAWA_TOKEN || process.env["BAWA_TOKEN "] || "").trim();
const INSTANCE_ID = (process.env.BAWA_INSTANCE_ID || process.env["BAWA_INSTANCE_ID "] || "").trim();

export function formatPhoneForWhatsApp(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  if (clean.startsWith("+")) clean = clean.slice(1);
  if (clean.startsWith("0")) clean = clean.slice(1);
  if (clean.length >= 12 && /^2\d{2}/.test(clean)) return clean;
  if (clean.length >= 9 && clean.startsWith("6")) return "252" + clean;
  if (!clean.startsWith("252")) return "252" + clean;
  return clean;
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(BAWA_TOKEN && INSTANCE_ID);
}

export type SendWhatsAppResult =
  | { success: true; recipient: string }
  | { success: false; error: string };

/**
 * Send a WhatsApp text message via Bawa.app API.
 * Call this directly instead of fetching /api/whatsapp to avoid "fetch failed" on self-calls.
 */
export async function sendWhatsAppMessage(
  phone: string,
  message: string
): Promise<SendWhatsAppResult> {
  if (!BAWA_TOKEN || !INSTANCE_ID) {
    return { success: false, error: "WhatsApp API not configured" };
  }

  const formattedPhone = formatPhoneForWhatsApp(phone);
  const jid = `${formattedPhone}@s.whatsapp.net`;
  const params = new URLSearchParams({
    token: BAWA_TOKEN,
    instance_id: INSTANCE_ID,
    jid,
    msg: message,
  });
  const apiUrl = `https://bawa.app/api/v1/send-text?${params.toString()}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": "SomaliDreams/1.0" },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get("content-type");
    let responseData: { status?: string; success?: boolean; message?: string; error?: string };
    if (contentType?.includes("application/json")) {
      responseData = await response.json();
    } else {
      const text = await response.text();
      try {
        responseData = JSON.parse(text);
      } catch {
        responseData = { status: "error", error: text || `HTTP ${response.status}` };
      }
    }

    if (response.ok && (responseData.status === "success" || responseData.success)) {
      return { success: true, recipient: formattedPhone };
    }

    return {
      success: false,
      error: responseData.message || responseData.error || `HTTP ${response.status}`,
    };
  } catch (error) {
    const err = error as Error;
    if (err.name === "AbortError") {
      return { success: false, error: "Request timeout" };
    }
    const msg = err.message || "fetch failed";
    console.error("[whatsapp] Bawa API error:", msg, err.cause);
    return { success: false, error: msg };
  }
}
