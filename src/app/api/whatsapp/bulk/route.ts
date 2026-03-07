import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Send custom WhatsApp message to multiple members
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

    const baseUrl =
      process.env.NEXTAUTH_URL?.trim() ||
      process.env.SITE_URL?.trim() ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const apiUrl = `${baseUrl.replace(/\/$/, "")}/api/whatsapp`;

    const results: { id: number; name: string; success: boolean; error?: string }[] = [];
    for (const m of members) {
      try {
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: m.phone,
            message: message.trim(),
          }),
        });
        const data = await res.json();
        results.push({
          id: m.id,
          name: m.name,
          success: res.ok && (data.success || data.message?.includes("successfully")),
          error: data.error || (res.ok ? undefined : data.details || "Failed"),
        });
      } catch (err) {
        results.push({
          id: m.id,
          name: m.name,
          success: false,
          error: (err as Error).message,
        });
      }
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
