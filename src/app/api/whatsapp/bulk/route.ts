import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

// Send custom WhatsApp message to multiple members
// Uses shared lib directly (no HTTP self-call) to avoid "fetch failed"
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { memberIds, message } = body;

    const ids = Array.isArray(memberIds)
      ? [...new Set(memberIds)].map((id) => parseInt(String(id), 10)).filter((id) => !isNaN(id) && id > 0)
      : [];

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "At least one member is required" },
        { status: 400 }
      );
    }

    if (!message?.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const members = await prisma.member.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, phone: true },
    });

    if (members.length === 0) {
      return NextResponse.json(
        { error: "No valid members found" },
        { status: 400 }
      );
    }

    const results: { id: number; name: string; success: boolean; error?: string }[] = [];
    for (const m of members) {
      const result = await sendWhatsAppMessage(m.phone, message.trim());
      results.push({
        id: m.id,
        name: m.name,
        success: result.success,
        error: result.success ? undefined : result.error,
      });
    }

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: failedCount === 0,
      sent: successCount,
      failed: failedCount,
      total: results.length,
      results,
    });
  } catch (e) {
    console.error("WhatsApp bulk send error:", e);
    return NextResponse.json(
      { error: "Failed to send messages" },
      { status: 500 }
    );
  }
}
