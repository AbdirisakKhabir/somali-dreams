import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [
      membersCount,
      activeCount,
      pendingCount,
      totalPayments,
      recentMembers,
    ] = await Promise.all([
      prisma.member.count(),
      prisma.member.count({ where: { status: "Active" } }),
      prisma.member.count({ where: { status: "Pending" } }),
      prisma.membershipPayment.aggregate({ _sum: { amount: true } }),
      prisma.member.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          phone: true,
          referralCode: true,
          status: true,
          createdAt: true,
          referredBy: { select: { name: true, referralCode: true } },
          _count: { select: { referrals: true } },
        },
      }),
    ]);

    return NextResponse.json({
      counts: {
        members: membersCount,
        active: activeCount,
        pending: pendingCount,
        totalRevenue: totalPayments._sum.amount ?? 0,
      },
      recentMembers,
    });
  } catch (e) {
    console.error("Dashboard stats error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
