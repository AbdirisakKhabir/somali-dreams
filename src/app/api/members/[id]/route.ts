import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = parseInt((await params).id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const member = await prisma.member.findUnique({
      where: { id },
      include: {
        referredBy: { select: { id: true, name: true, phone: true, referralCode: true } },
        referrals: { select: { id: true, name: true, phone: true, referralCode: true, createdAt: true } },
        membershipPayments: { orderBy: { paidAt: "desc" } },
        referralCommissions: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { referredMember: { select: { id: true, name: true, referralCode: true } } },
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    return NextResponse.json(member);
  } catch (e) {
    console.error("Get member error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = parseInt((await params).id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await req.json();
    const { name, phone, email, status } = body;

    const member = await prisma.member.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(phone !== undefined && { phone: String(phone).trim() }),
        ...(email !== undefined && { email: email ? String(email).trim() : null }),
        ...(status !== undefined && { status: String(status) }),
      },
      include: {
        referredBy: { select: { id: true, name: true, referralCode: true } },
        referrals: { select: { id: true, name: true, phone: true, referralCode: true } },
      },
    });

    return NextResponse.json(member);
  } catch (e) {
    console.error("Update member error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = parseInt((await params).id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    await prisma.member.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Delete member error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
