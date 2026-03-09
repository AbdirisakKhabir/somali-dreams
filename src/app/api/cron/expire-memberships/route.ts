import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Expire memberships where membershipEndDate has passed.
 * Set status to "Pending" so they need to renew.
 * Call via: GET /api/cron/expire-memberships
 * Secure with CRON_SECRET in production (e.g. Vercel cron).
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const result = await prisma.member.updateMany({
      where: {
        status: "Active",
        membershipEndDate: { lt: now },
      },
      data: { status: "Pending" },
    });

    return NextResponse.json({
      success: true,
      expired: result.count,
      message: `Expired ${result.count} membership(s)`,
    });
  } catch (e) {
    console.error("[expire-memberships] Error:", e);
    return NextResponse.json(
      { error: "Failed to expire memberships" },
      { status: 500 }
    );
  }
}
